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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Auth: accept either Bearer JWT or x-api-key header with user email+password flow
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header. Use 'Bearer <access_token>'" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getUser(token);
    if (claimsErr || !claimsData?.user) {
      return json({ error: "Invalid or expired token" }, 401);
    }
    const userId = claimsData.user.id;

    const body = await req.json();

    // Validate payload
    if (!body.broker_account_id || typeof body.broker_account_id !== "string") {
      return json({ error: "broker_account_id is required" }, 400);
    }
    if (!Array.isArray(body.trades) || body.trades.length === 0) {
      return json({ error: "trades array is required and must not be empty" }, 400);
    }
    if (body.trades.length > 500) {
      return json({ error: "Maximum 500 trades per request" }, 400);
    }

    // Verify account ownership
    const { data: account } = await supabase
      .from("broker_accounts")
      .select("id, user_id")
      .eq("id", body.broker_account_id)
      .eq("user_id", userId)
      .single();

    if (!account) {
      return json({ error: "Broker account not found or not owned by you" }, 404);
    }

    let ingested = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const t of body.trades) {
      // Validate each trade
      if (!t.symbol || !t.direction || !t.entry_time || !t.exit_time) {
        errors.push(`Trade missing required fields: ${JSON.stringify(t).slice(0, 100)}`);
        continue;
      }

      const brokerTradeId = t.broker_trade_id || `mt5_${t.ticket || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Check for duplicates
      const { data: existing } = await supabase
        .from("trades")
        .select("id")
        .eq("user_id", userId)
        .eq("broker_trade_id", brokerTradeId)
        .maybeSingle();

      if (existing) {
        duplicates++;
        continue;
      }

      const { error: insertErr } = await supabase.from("trades").insert({
        user_id: userId,
        broker_account_id: body.broker_account_id,
        broker_trade_id: brokerTradeId,
        symbol: String(t.symbol).toUpperCase().trim().slice(0, 20),
        direction: t.direction === "Buy" || t.direction === "Long" ? "Long" : "Short",
        entry_time: t.entry_time,
        entry_price: Number(t.entry_price) || 0,
        exit_time: t.exit_time,
        exit_price: Number(t.exit_price) || 0,
        position_size: Number(t.position_size) || Number(t.volume) || 0,
        total_fees: Number(t.total_fees) || Number(t.fees) || 0,
        pnl: Number(t.pnl) || Number(t.profit) || 0,
        tags: [],
      });

      if (insertErr) {
        errors.push(`Insert error for ${brokerTradeId}: ${insertErr.message}`);
      } else {
        ingested++;
      }
    }

    // Update account sync timestamp + balance
    const nextSync = new Date(Date.now() + 15 * 60_000).toISOString();
    const updatePayload: any = {
      last_sync_at: new Date().toISOString(),
      connection_status: "connected",
      last_sync_error: null,
      next_sync_at: nextSync,
      retry_count: 0,
    };
    if (body.balance != null && typeof body.balance === "number") {
      updatePayload.balance = body.balance;
    }
    await supabase.from("broker_accounts").update(updatePayload).eq("id", body.broker_account_id);

    // Log the sync
    await supabase.from("sync_logs").insert({
      broker_account_id: body.broker_account_id,
      user_id: userId,
      status: errors.length > 0 ? "partial" : "success",
      trades_synced: ingested,
      error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    });

    return json({
      success: true,
      trades_ingested: ingested,
      duplicates_skipped: duplicates,
      errors: errors.slice(0, 5),
    });
  } catch (e) {
    console.error("trade-push error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal server error" }, 500);
  }
});
