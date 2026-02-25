import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const META_API_BASE = "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";
const META_API_PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

// ── Provision MT5 account on MetaAPI ───────────────────────────
async function provisionAccount(
  token: string,
  name: string,
  login: string,
  password: string,
  server: string,
  platform: string = "mt5"
): Promise<{ id: string } | { error: string }> {
  const res = await fetch(`${META_API_PROVISIONING}/users/current/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({
      name,
      login,
      password,
      server,
      platform,
      type: "cloud",
      magic: 0,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { error: data.message || `MetaAPI error: ${res.status}` };
  }
  return { id: data.id };
}

// ── Deploy and wait for account to connect ─────────────────────
async function deployAccount(token: string, accountId: string): Promise<boolean> {
  await fetch(`${META_API_PROVISIONING}/users/current/accounts/${accountId}/deploy`, {
    method: "POST",
    headers: { "auth-token": token },
  });

  // Wait up to 60s for connection
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${META_API_PROVISIONING}/users/current/accounts/${accountId}`, {
      headers: { "auth-token": token },
    });
    const data = await res.json();
    if (data.state === "DEPLOYED" && data.connectionStatus === "CONNECTED") {
      return true;
    }
  }
  return false;
}

// ── Fetch trade history from MetaAPI ───────────────────────────
interface MetaApiDeal {
  id: string;
  type: string; // DEAL_TYPE_BUY, DEAL_TYPE_SELL
  symbol: string;
  time: string;
  price: number;
  volume: number;
  profit: number;
  commission: number;
  swap: number;
  entryType: string; // DEAL_ENTRY_IN, DEAL_ENTRY_OUT
  positionId: string;
}

async function fetchDeals(
  token: string,
  accountId: string,
  startTime: string,
  endTime: string
): Promise<MetaApiDeal[]> {
  const params = new URLSearchParams({
    startTime,
    endTime,
    offset: "0",
    limit: "1000",
  });

  const res = await fetch(
    `${META_API_BASE}/users/current/accounts/${accountId}/history-deals/time?${params}`,
    { headers: { "auth-token": token } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MetaAPI deals error ${res.status}: ${body}`);
  }

  return await res.json();
}

// ── Fetch account info ─────────────────────────────────────────
async function fetchAccountInfo(
  token: string,
  accountId: string
): Promise<{ balance: number; equity: number; margin: number } | null> {
  const res = await fetch(
    `${META_API_BASE}/users/current/accounts/${accountId}/account-information`,
    { headers: { "auth-token": token } }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return {
    balance: data.balance ?? 0,
    equity: data.equity ?? 0,
    margin: data.margin ?? 0,
  };
}

// ── Match deals into trades ────────────────────────────────────
interface MatchedTrade {
  broker_trade_id: string;
  symbol: string;
  direction: string;
  entry_time: string;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  position_size: number;
  fees: number;
  pnl: number;
}

function matchDealsToTrades(deals: MetaApiDeal[]): MatchedTrade[] {
  // Group deals by positionId
  const positions = new Map<string, MetaApiDeal[]>();
  for (const deal of deals) {
    if (!deal.positionId || deal.type === "DEAL_TYPE_BALANCE") continue;
    const key = deal.positionId;
    if (!positions.has(key)) positions.set(key, []);
    positions.get(key)!.push(deal);
  }

  const trades: MatchedTrade[] = [];
  for (const [posId, posDeals] of positions) {
    const entries = posDeals.filter((d) => d.entryType === "DEAL_ENTRY_IN");
    const exits = posDeals.filter((d) => d.entryType === "DEAL_ENTRY_OUT");

    if (entries.length === 0 || exits.length === 0) continue;

    const entry = entries[0];
    const exit = exits[exits.length - 1];
    const totalProfit = posDeals.reduce((s, d) => s + (d.profit ?? 0), 0);
    const totalFees = posDeals.reduce(
      (s, d) => s + Math.abs(d.commission ?? 0) + Math.abs(d.swap ?? 0),
      0
    );

    const direction = entry.type === "DEAL_TYPE_BUY" ? "Long" : "Short";

    trades.push({
      broker_trade_id: `mt5_${posId}`,
      symbol: entry.symbol,
      direction,
      entry_time: entry.time,
      entry_price: entry.price,
      exit_time: exit.time,
      exit_price: exit.price,
      position_size: entry.volume,
      fees: totalFees,
      pnl: totalProfit - totalFees,
    });
  }

  return trades;
}

// ── Main Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const metaApiToken = Deno.env.get("META_API_TOKEN");
  if (!metaApiToken) return json({ error: "META_API_TOKEN not configured" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/mt5-sync\/?/, "");

  try {
    // ── POST /provision — Create MetaAPI account from MT5 credentials
    if (req.method === "POST" && path === "provision") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return json({ error: "Unauthorized" }, 401);

      const body = await req.json();
      const { broker_account_id, login, password, server, platform } = body;

      if (!broker_account_id || !login || !password || !server)
        return json({ error: "Missing required fields: broker_account_id, login, password, server" }, 400);

      // Verify broker account belongs to user
      const { data: account } = await supabase
        .from("broker_accounts")
        .select("*")
        .eq("id", broker_account_id)
        .eq("user_id", user.id)
        .single();
      if (!account) return json({ error: "Broker account not found" }, 404);

      // Provision on MetaAPI
      const result = await provisionAccount(
        metaApiToken,
        `TradeZella_${account.broker_name}_${login}`,
        login,
        password,
        server,
        platform || "mt5"
      );

      if ("error" in result) {
        await supabase
          .from("broker_accounts")
          .update({ connection_status: "error", last_sync_error: result.error } as any)
          .eq("id", broker_account_id);
        return json({ success: false, error: result.error }, 400);
      }

      // Deploy and wait
      await supabase
        .from("broker_accounts")
        .update({ connection_status: "syncing", meta_api_account_id: result.id } as any)
        .eq("id", broker_account_id);

      const connected = await deployAccount(metaApiToken, result.id);

      if (!connected) {
        await supabase
          .from("broker_accounts")
          .update({ connection_status: "error", last_sync_error: "MetaAPI account failed to connect within 60s" } as any)
          .eq("id", broker_account_id);
        return json({ success: false, error: "Account failed to connect. Check credentials." }, 408);
      }

      // Get account info
      const info = await fetchAccountInfo(metaApiToken, result.id);

      await supabase
        .from("broker_accounts")
        .update({
          connection_status: "connected",
          meta_api_account_id: result.id,
          balance: info?.balance ?? null,
          last_sync_error: null,
        } as any)
        .eq("id", broker_account_id);

      return json({ success: true, meta_api_account_id: result.id, balance: info?.balance });
    }

    // ── POST /fetch-trades — Fetch and ingest trades for a broker account
    if (req.method === "POST" && path === "fetch-trades") {
      // This can be called by sync-scheduler (service role) or by user
      const body = await req.json();
      const { broker_account_id, since } = body;

      if (!broker_account_id) return json({ error: "broker_account_id required" }, 400);

      const { data: account } = await supabase
        .from("broker_accounts")
        .select("*")
        .eq("id", broker_account_id)
        .single();

      if (!account) return json({ error: "Broker account not found" }, 404);
      if (!(account as any).meta_api_account_id) {
        return json({ error: "Account not provisioned with MetaAPI" }, 400);
      }

      const metaAccountId = (account as any).meta_api_account_id;
      const sinceTime = since || account.last_sync_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      // Update account info
      const info = await fetchAccountInfo(metaApiToken, metaAccountId);
      if (info) {
        await supabase
          .from("broker_accounts")
          .update({ balance: info.balance } as any)
          .eq("id", broker_account_id);
      }

      // Fetch deals from MetaAPI
      const deals = await fetchDeals(metaApiToken, metaAccountId, sinceTime, endTime);
      const matchedTrades = matchDealsToTrades(deals);

      if (matchedTrades.length === 0) {
        return json({ success: true, trades_ingested: 0, duplicates_skipped: 0 });
      }

      // Ingest trades with duplicate detection
      let ingested = 0;
      let duplicates = 0;

      for (const t of matchedTrades) {
        // Check duplicate by broker_trade_id
        const { data: existing } = await supabase
          .from("trades")
          .select("id")
          .eq("user_id", account.user_id)
          .eq("broker_trade_id", t.broker_trade_id)
          .maybeSingle();

        if (existing) { duplicates++; continue; }

        const { error } = await supabase.from("trades").insert({
          user_id: account.user_id,
          broker_account_id: broker_account_id,
          broker_trade_id: t.broker_trade_id,
          symbol: t.symbol.toUpperCase(),
          direction: t.direction,
          entry_time: t.entry_time,
          entry_price: t.entry_price,
          exit_time: t.exit_time,
          exit_price: t.exit_price,
          position_size: t.position_size,
          total_fees: t.fees,
          pnl: t.pnl,
          tags: [],
        });

        if (!error) ingested++;
        else console.error(`Insert error for ${t.broker_trade_id}:`, error.message);
      }

      return json({
        success: true,
        trades_ingested: ingested,
        duplicates_skipped: duplicates,
        deals_fetched: deals.length,
        trades_matched: matchedTrades.length,
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("mt5-sync error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
