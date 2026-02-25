import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetch as nodeFetch } from "npm:undici@^6";

// Use Node.js-based fetch for MetaAPI to avoid Deno TLS issues
function metaFetch(url: string, init?: RequestInit): Promise<Response> {
  return nodeFetch(url, init as any) as unknown as Promise<Response>;
}

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
  const res = await metaFetch(`${META_API_PROVISIONING}/users/current/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "auth-token": token },
    body: JSON.stringify({ name, login, password, server, platform, type: "cloud", magic: 0 }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.message || `MetaAPI error: ${res.status}` };
  return { id: data.id };
}

// ── Deploy and wait for account to connect ─────────────────────
async function deployAccount(token: string, accountId: string): Promise<boolean> {
  await metaFetch(`${META_API_PROVISIONING}/users/current/accounts/${accountId}/deploy`, {
    method: "POST",
    headers: { "auth-token": token },
  });
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await metaFetch(`${META_API_PROVISIONING}/users/current/accounts/${accountId}`, {
      headers: { "auth-token": token },
    });
    const data = await res.json();
    if (data.state === "DEPLOYED" && data.connectionStatus === "CONNECTED") return true;
  }
  return false;
}

// ── Fetch account info (balance, equity, margin, leverage) ─────
interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
  login: number;
  name: string;
  server: string;
  platform: string;
  type: string;
}

async function fetchAccountInfo(
  token: string,
  accountId: string
): Promise<AccountInfo | null> {
  const res = await metaFetch(
    `${META_API_BASE}/users/current/accounts/${accountId}/account-information`,
    { headers: { "auth-token": token } }
  );
  if (!res.ok) return null;
  const d = await res.json();
  return {
    balance: d.balance ?? 0,
    equity: d.equity ?? 0,
    margin: d.margin ?? 0,
    freeMargin: d.freeMargin ?? d.freeMargin ?? 0,
    leverage: d.leverage ?? 0,
    currency: d.currency ?? "USD",
    login: d.login ?? 0,
    name: d.name ?? "",
    server: d.server ?? "",
    platform: d.platform ?? "mt5",
    type: d.type ?? "",
  };
}

// ── Fetch open positions ───────────────────────────────────────
interface OpenPosition {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  commission: number;
  time: string;
  stopLoss: number | null;
  takeProfit: number | null;
  magic: number;
  comment: string;
}

async function fetchOpenPositions(
  token: string,
  accountId: string
): Promise<OpenPosition[]> {
  const res = await metaFetch(
    `${META_API_BASE}/users/current/accounts/${accountId}/positions`,
    { headers: { "auth-token": token } }
  );
  if (!res.ok) return [];
  const positions = await res.json();
  return (positions ?? []).map((p: any) => ({
    id: p.id ?? p.positionId ?? "",
    symbol: p.symbol ?? "",
    type: p.type === "POSITION_TYPE_BUY" ? "Buy" : p.type === "POSITION_TYPE_SELL" ? "Sell" : p.type,
    volume: p.volume ?? 0,
    openPrice: p.openPrice ?? 0,
    currentPrice: p.currentPrice ?? 0,
    profit: p.profit ?? 0,
    swap: p.swap ?? 0,
    commission: p.commission ?? 0,
    time: p.time ?? "",
    stopLoss: p.stopLoss ?? null,
    takeProfit: p.takeProfit ?? null,
    magic: p.magic ?? 0,
    comment: p.comment ?? "",
  }));
}

// ── Fetch trade history (deals) ────────────────────────────────
interface HistoricalDeal {
  ticket: string;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  comment: string;
  time: string;
  entryType: string;
  positionId: string;
}

async function fetchDeals(
  token: string,
  accountId: string,
  startTime: string,
  endTime: string
): Promise<HistoricalDeal[]> {
  const params = new URLSearchParams({ startTime, endTime, offset: "0", limit: "1000" });
  const res = await metaFetch(
    `${META_API_BASE}/users/current/accounts/${accountId}/history-deals/time?${params}`,
    { headers: { "auth-token": token } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MetaAPI deals error ${res.status}: ${body}`);
  }
  const deals = await res.json();
  return (deals ?? []).map((d: any) => ({
    ticket: d.id ?? "",
    symbol: d.symbol ?? "",
    type: d.type ?? "",
    volume: d.volume ?? 0,
    price: d.price ?? 0,
    profit: d.profit ?? 0,
    commission: d.commission ?? 0,
    swap: d.swap ?? 0,
    comment: d.comment ?? "",
    time: d.time ?? "",
    entryType: d.entryType ?? "",
    positionId: d.positionId ?? "",
  }));
}

// ── Match deals into round-trip trades ─────────────────────────
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

function matchDealsToTrades(deals: HistoricalDeal[]): MatchedTrade[] {
  const positions = new Map<string, HistoricalDeal[]>();
  for (const deal of deals) {
    if (!deal.positionId || deal.type === "DEAL_TYPE_BALANCE") continue;
    if (!positions.has(deal.positionId)) positions.set(deal.positionId, []);
    positions.get(deal.positionId)!.push(deal);
  }
  const trades: MatchedTrade[] = [];
  for (const [posId, posDeals] of positions) {
    const entries = posDeals.filter((d) => d.entryType === "DEAL_ENTRY_IN");
    const exits = posDeals.filter((d) => d.entryType === "DEAL_ENTRY_OUT");
    if (entries.length === 0 || exits.length === 0) continue;
    const entry = entries[0];
    const exit = exits[exits.length - 1];
    const totalProfit = posDeals.reduce((s, d) => s + (d.profit ?? 0), 0);
    const totalFees = posDeals.reduce((s, d) => s + Math.abs(d.commission ?? 0) + Math.abs(d.swap ?? 0), 0);
    trades.push({
      broker_trade_id: `mt5_${posId}`,
      symbol: entry.symbol,
      direction: entry.type === "DEAL_TYPE_BUY" ? "Long" : "Short",
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

// ── Analytics Calculations ─────────────────────────────────────
interface AnalyticsSummary {
  totalProfit: number;
  totalLoss: number;
  netPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  largestWin: number;
  largestLoss: number;
  avgTradePnL: number;
  riskRewardRatio: number;
}

function computeAnalytics(trades: MatchedTrade[]): AnalyticsSummary {
  if (trades.length === 0) {
    return {
      totalProfit: 0, totalLoss: 0, netPnL: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0,
      totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
      largestWin: 0, largestLoss: 0, avgTradePnL: 0, riskRewardRatio: 0,
    };
  }

  const pnls = trades.map((t) => t.pnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const breakEvens = pnls.filter((p) => p === 0);

  const totalProfit = wins.reduce((s, v) => s + v, 0);
  const totalLoss = Math.abs(losses.reduce((s, v) => s + v, 0));
  const netPnL = totalProfit - totalLoss;
  const winRate = (wins.length / pnls.length) * 100;
  const avgWin = wins.length > 0 ? totalProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const avgTradePnL = pnls.reduce((s, v) => s + v, 0) / pnls.length;

  // Max drawdown from cumulative P&L
  let peak = 0;
  let cumulative = 0;
  let maxDD = 0;
  // Sort trades chronologically
  const sorted = [...trades].sort(
    (a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime()
  );
  for (const t of sorted) {
    cumulative += t.pnl;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalProfit: round(totalProfit),
    totalLoss: round(totalLoss),
    netPnL: round(netPnL),
    winRate: round(winRate),
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    profitFactor: profitFactor === Infinity ? 999.99 : round(profitFactor),
    maxDrawdown: round(maxDD),
    totalTrades: pnls.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: breakEvens.length,
    largestWin: round(Math.max(...pnls, 0)),
    largestLoss: round(Math.abs(Math.min(...pnls, 0))),
    avgTradePnL: round(avgTradePnL),
    riskRewardRatio: riskRewardRatio === Infinity ? 999.99 : round(riskRewardRatio),
  };
}

function round(val: number, decimals = 2): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

// ── Input Validation ───────────────────────────────────────────
function validateAccountSummaryInput(body: any): { valid: true } | { valid: false; error: string } {
  if (!body.broker_account_id || typeof body.broker_account_id !== "string") {
    return { valid: false, error: "broker_account_id is required" };
  }
  if (body.from_date && isNaN(Date.parse(body.from_date))) {
    return { valid: false, error: "from_date must be a valid ISO date string" };
  }
  if (body.to_date && isNaN(Date.parse(body.to_date))) {
    return { valid: false, error: "to_date must be a valid ISO date string" };
  }
  if (body.symbol && typeof body.symbol !== "string") {
    return { valid: false, error: "symbol must be a string" };
  }
  return { valid: true };
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

      const { data: account } = await supabase
        .from("broker_accounts").select("*").eq("id", broker_account_id).eq("user_id", user.id).single();
      if (!account) return json({ error: "Broker account not found" }, 404);

      const result = await provisionAccount(
        metaApiToken, `TradeZella_${account.broker_name}_${login}`, login, password, server, platform || "mt5"
      );
      if ("error" in result) {
        await supabase.from("broker_accounts")
          .update({ connection_status: "error", last_sync_error: result.error } as any).eq("id", broker_account_id);
        return json({ success: false, error: result.error }, 400);
      }

      await supabase.from("broker_accounts")
        .update({ connection_status: "syncing", meta_api_account_id: result.id } as any).eq("id", broker_account_id);

      const connected = await deployAccount(metaApiToken, result.id);
      if (!connected) {
        await supabase.from("broker_accounts")
          .update({ connection_status: "error", last_sync_error: "MetaAPI account failed to connect within 60s" } as any)
          .eq("id", broker_account_id);
        return json({ success: false, error: "Account failed to connect. Check credentials." }, 408);
      }

      const info = await fetchAccountInfo(metaApiToken, result.id);
      await supabase.from("broker_accounts")
        .update({
          connection_status: "connected", meta_api_account_id: result.id,
          balance: info?.balance ?? null, last_sync_error: null,
        } as any).eq("id", broker_account_id);

      return json({ success: true, meta_api_account_id: result.id, balance: info?.balance });
    }

    // ── POST /fetch-trades — Fetch and ingest trades for a broker account
    if (req.method === "POST" && path === "fetch-trades") {
      const body = await req.json();
      const { broker_account_id, since } = body;
      if (!broker_account_id) return json({ error: "broker_account_id required" }, 400);

      const { data: account } = await supabase
        .from("broker_accounts").select("*").eq("id", broker_account_id).single();
      if (!account) return json({ error: "Broker account not found" }, 404);
      if (!(account as any).meta_api_account_id)
        return json({ error: "Account not provisioned with MetaAPI" }, 400);

      const metaAccountId = (account as any).meta_api_account_id;
      const sinceTime = since || account.last_sync_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const info = await fetchAccountInfo(metaApiToken, metaAccountId);
      if (info) {
        await supabase.from("broker_accounts").update({ balance: info.balance } as any).eq("id", broker_account_id);
      }

      const deals = await fetchDeals(metaApiToken, metaAccountId, sinceTime, endTime);
      const matchedTrades = matchDealsToTrades(deals);

      if (matchedTrades.length === 0)
        return json({ success: true, trades_ingested: 0, duplicates_skipped: 0 });

      let ingested = 0, duplicates = 0;
      for (const t of matchedTrades) {
        const { data: existing } = await supabase.from("trades").select("id")
          .eq("user_id", account.user_id).eq("broker_trade_id", t.broker_trade_id).maybeSingle();
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
        success: true, trades_ingested: ingested, duplicates_skipped: duplicates,
        deals_fetched: deals.length, trades_matched: matchedTrades.length,
      });
    }

    // ── POST /account-summary — Full account summary with analytics
    if (req.method === "POST" && path === "account-summary") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return json({ error: "Unauthorized" }, 401);

      const body = await req.json();
      const validation = validateAccountSummaryInput(body);
      if (!validation.valid) return json({ error: validation.error }, 400);

      const { broker_account_id, from_date, to_date, symbol } = body;

      // Verify ownership
      const { data: account } = await supabase
        .from("broker_accounts").select("*").eq("id", broker_account_id).eq("user_id", user.id).single();
      if (!account) return json({ error: "Broker account not found" }, 404);

      const metaAccountId = (account as any).meta_api_account_id;
      if (!metaAccountId) return json({ error: "Account not provisioned with MetaAPI. Connect your MT5 first." }, 400);

      // Fetch all data in parallel
      const startTime = from_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = to_date || new Date().toISOString();

      const [accountInfo, positions, rawDeals] = await Promise.all([
        fetchAccountInfo(metaApiToken, metaAccountId),
        fetchOpenPositions(metaApiToken, metaAccountId),
        fetchDeals(metaApiToken, metaAccountId, startTime, endTime),
      ]);

      if (!accountInfo)
        return json({ error: "Failed to fetch account information. Terminal may be offline." }, 503);

      // Update balance in DB
      await supabase.from("broker_accounts")
        .update({ balance: accountInfo.balance } as any).eq("id", broker_account_id);

      // Match deals to trades
      let matchedTrades = matchDealsToTrades(rawDeals);

      // Optional symbol filter
      if (symbol) {
        const upperSymbol = symbol.toUpperCase();
        matchedTrades = matchedTrades.filter((t) => t.symbol.toUpperCase().includes(upperSymbol));
      }

      // Compute analytics
      const analytics = computeAnalytics(matchedTrades);

      // Filter positions by symbol if requested
      let filteredPositions = positions;
      if (symbol) {
        const upperSymbol = symbol.toUpperCase();
        filteredPositions = positions.filter((p) => p.symbol.toUpperCase().includes(upperSymbol));
      }

      // Build response
      const response = {
        success: true,
        generated_at: new Date().toISOString(),
        account: {
          login: accountInfo.login,
          name: accountInfo.name,
          server: accountInfo.server,
          platform: accountInfo.platform,
          currency: accountInfo.currency,
          leverage: accountInfo.leverage,
          balance: accountInfo.balance,
          equity: accountInfo.equity,
          margin: accountInfo.margin,
          free_margin: accountInfo.freeMargin,
          margin_level: accountInfo.margin > 0
            ? round((accountInfo.equity / accountInfo.margin) * 100)
            : null,
        },
        open_positions: {
          count: filteredPositions.length,
          total_floating_pnl: round(filteredPositions.reduce((s, p) => s + p.profit, 0)),
          positions: filteredPositions.map((p) => ({
            id: p.id,
            symbol: p.symbol,
            type: p.type,
            volume: p.volume,
            entry_price: p.openPrice,
            current_price: p.currentPrice,
            floating_pnl: round(p.profit),
            swap: round(p.swap),
            commission: round(p.commission),
            opened_at: p.time,
            stop_loss: p.stopLoss,
            take_profit: p.takeProfit,
          })),
        },
        trade_history: {
          period: { from: startTime, to: endTime },
          symbol_filter: symbol || null,
          total_deals: rawDeals.length,
          matched_trades: matchedTrades.length,
          trades: matchedTrades.map((t) => ({
            id: t.broker_trade_id,
            symbol: t.symbol,
            direction: t.direction,
            entry_time: t.entry_time,
            entry_price: t.entry_price,
            exit_time: t.exit_time,
            exit_price: t.exit_price,
            volume: t.position_size,
            fees: round(t.fees),
            pnl: round(t.pnl),
          })),
        },
        analytics,
      };

      return json(response);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("mt5-sync error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal server error" }, 500);
  }
});
