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

// ── Trade validation ───────────────────────────────────────────
interface RawTrade {
  broker_trade_id?: string;
  symbol: string;
  direction: string;
  entry_time: string;
  entry_price: number;
  exit_time?: string;
  exit_price?: number;
  position_size: number;
  fees?: number;
  pnl?: number;
  strategy?: string;
  tags?: string[];
  emotion?: string;
  notes?: string;
}

const VALID_DIRECTIONS = ["long", "short", "buy", "sell"];

function validateTrade(t: RawTrade, index: number): string | null {
  if (!t.symbol || typeof t.symbol !== "string" || t.symbol.trim().length === 0)
    return `[${index}] symbol is required`;
  if (t.symbol.length > 20) return `[${index}] symbol too long (max 20 chars)`;

  const dir = (t.direction ?? "").toLowerCase();
  if (!VALID_DIRECTIONS.includes(dir))
    return `[${index}] direction must be long/short/buy/sell`;

  if (!t.entry_time) return `[${index}] entry_time is required`;
  const entryDate = new Date(t.entry_time);
  if (isNaN(entryDate.getTime())) return `[${index}] entry_time is not a valid date`;

  if (typeof t.entry_price !== "number" || t.entry_price <= 0)
    return `[${index}] entry_price must be > 0`;
  if (typeof t.position_size !== "number" || t.position_size <= 0)
    return `[${index}] position_size must be > 0`;

  if (t.exit_time) {
    const exitDate = new Date(t.exit_time);
    if (isNaN(exitDate.getTime())) return `[${index}] exit_time is not a valid date`;
    if (exitDate <= entryDate) return `[${index}] exit_time must be after entry_time`;
  }

  if (t.exit_price != null && (typeof t.exit_price !== "number" || t.exit_price <= 0))
    return `[${index}] exit_price must be > 0`;

  if (t.fees != null && (typeof t.fees !== "number" || t.fees < 0))
    return `[${index}] fees must be >= 0`;

  return null;
}

function normalizeDirection(dir: string): string {
  const lower = dir.toLowerCase();
  if (lower === "buy" || lower === "long") return "Long";
  return "Short";
}

function calcPnl(t: RawTrade): number {
  if (t.pnl != null) return t.pnl;
  if (t.exit_price == null) return 0;
  const dir = normalizeDirection(t.direction) === "Long" ? 1 : -1;
  return dir * (t.exit_price - t.entry_price) * t.position_size - (t.fees ?? 0);
}

// ── Fuzzy duplicate detection ──────────────────────────────────
async function isDuplicate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  t: RawTrade
): Promise<boolean> {
  // Exact match by broker_trade_id
  if (t.broker_trade_id) {
    const { data } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("broker_trade_id", t.broker_trade_id)
      .maybeSingle();
    if (data) return true;
  }

  // Fuzzy: same symbol, same direction, entry time within 2 seconds, price within 0.01%
  const entryTime = new Date(t.entry_time);
  const windowStart = new Date(entryTime.getTime() - 2000).toISOString();
  const windowEnd = new Date(entryTime.getTime() + 2000).toISOString();

  const { data: candidates } = await supabase
    .from("trades")
    .select("id, entry_price, position_size")
    .eq("user_id", userId)
    .eq("symbol", t.symbol.toUpperCase())
    .gte("entry_time", windowStart)
    .lte("entry_time", windowEnd)
    .limit(5);

  if (candidates && candidates.length > 0) {
    for (const c of candidates) {
      const priceDiff = Math.abs((c.entry_price ?? 0) - t.entry_price) / t.entry_price;
      const sizeDiff = Math.abs((c.position_size ?? 0) - t.position_size) / t.position_size;
      if (priceDiff < 0.0001 && sizeDiff < 0.01) return true;
    }
  }

  return false;
}

// ── CSV Parsing ────────────────────────────────────────────────
function parseCSV(text: string): RawTrade[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).filter(l => l.trim().length > 0).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = vals[i] ?? ""));
    return {
      symbol: obj.symbol ?? "",
      direction: obj.direction ?? "long",
      entry_time: obj.entry_time ?? "",
      entry_price: parseFloat(obj.entry_price) || 0,
      exit_time: obj.exit_time || undefined,
      exit_price: obj.exit_price ? parseFloat(obj.exit_price) : undefined,
      position_size: parseFloat(obj.position_size) || 0,
      fees: obj.fees ? parseFloat(obj.fees) : 0,
      pnl: obj.pnl ? parseFloat(obj.pnl) : undefined,
      strategy: obj.strategy || undefined,
      broker_trade_id: obj.broker_trade_id || undefined,
    };
  });
}

// ── Rate Limiter (in-memory, per-worker) ───────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string, limit = 100): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// ── Batch insert helper ────────────────────────────────────────
async function ingestTrades(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  trades: RawTrade[],
  brokerAccountId?: string
): Promise<{ ingested: number; duplicates: number; errors: string[] }> {
  const errors: string[] = [];
  let ingested = 0;
  let duplicates = 0;

  // Batch validation first
  const validTrades: { trade: RawTrade; index: number }[] = [];
  for (let i = 0; i < trades.length; i++) {
    const err = validateTrade(trades[i], i);
    if (err) {
      errors.push(err);
    } else {
      validTrades.push({ trade: trades[i], index: i });
    }
  }

  // Process valid trades
  for (const { trade: t, index: i } of validTrades) {
    const dup = await isDuplicate(supabase, userId, t);
    if (dup) { duplicates++; continue; }

    const pnl = calcPnl(t);
    const { error: insertErr } = await supabase.from("trades").insert({
      user_id: userId,
      broker_account_id: brokerAccountId ?? null,
      broker_trade_id: t.broker_trade_id ?? null,
      symbol: t.symbol.toUpperCase().trim(),
      direction: normalizeDirection(t.direction),
      entry_time: t.entry_time,
      entry_price: t.entry_price,
      exit_time: t.exit_time ?? null,
      exit_price: t.exit_price ?? null,
      position_size: t.position_size,
      total_fees: t.fees ?? 0,
      pnl,
      strategy: t.strategy ?? null,
      tags: t.tags ?? [],
      emotion: t.emotion ?? null,
      notes: t.notes ?? null,
    });

    if (insertErr) {
      errors.push(`[${i}] DB error: ${insertErr.message}`);
    } else {
      ingested++;
    }
  }

  return { ingested, duplicates, errors };
}

// ── Main Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/trade-sync\/?/, "");

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const userId = user.id;

  try {
    // ── POST /sync — Webhook trade ingestion ─────────────────
    if (req.method === "POST" && (path === "sync" || path === "")) {
      if (!checkRateLimit(userId)) {
        return json({ success: false, error: "Rate limit exceeded. Max 100 trades/min." }, 429);
      }

      const body = await req.json();
      const trades: RawTrade[] = body.trades ?? [body];
      const brokerAccountId: string | undefined = body.broker_account_id;

      const result = await ingestTrades(supabase, userId, trades, brokerAccountId);

      // Create sync log
      if (brokerAccountId) {
        await supabase.from("sync_logs").insert({
          user_id: userId,
          broker_account_id: brokerAccountId,
          status: result.errors.length > 0 ? (result.ingested > 0 ? "partial" : "failed") : "success",
          trades_synced: result.ingested,
          error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
        });
      }

      return json({
        success: result.errors.length === 0,
        trades_ingested: result.ingested,
        duplicates_skipped: result.duplicates,
        errors: result.errors,
      });
    }

    // ── POST /import-csv — CSV batch import ──────────────────
    if (req.method === "POST" && path === "import-csv") {
      if (!checkRateLimit(userId, 500)) {
        return json({ success: false, error: "Rate limit exceeded" }, 429);
      }

      let csvText: string;
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) return json({ success: false, error: "No CSV file provided" }, 400);
        csvText = await file.text();
      } else {
        const body = await req.json();
        csvText = body.csv;
        if (!csvText) return json({ success: false, error: "No CSV data provided" }, 400);
      }

      const trades = parseCSV(csvText);
      if (trades.length === 0) return json({ success: false, error: "No trades found in CSV" }, 400);

      const result = await ingestTrades(supabase, userId, trades);

      return json({
        success: result.errors.length === 0,
        imported: result.ingested,
        duplicates_skipped: result.duplicates,
        errors: result.errors,
      });
    }

    // ── GET /sync-status — Last sync per account ─────────────
    if (req.method === "GET" && path === "sync-status") {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*, broker_accounts(broker_name, account_number)")
        .eq("user_id", userId)
        .order("synced_at", { ascending: false })
        .limit(1);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, last_sync: data?.[0] ?? null });
    }

    // ── GET /sync-logs — Sync history ────────────────────────
    if (req.method === "GET" && path === "sync-logs") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("user_id", userId)
        .order("synced_at", { ascending: false })
        .limit(Math.min(limit, 100));
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, logs: data });
    }

    return json({ success: false, error: "Not found" }, 404);
  } catch (e) {
    console.error("trade-sync error:", e);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
