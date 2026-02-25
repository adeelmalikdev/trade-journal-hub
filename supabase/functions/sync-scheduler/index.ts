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

const MAX_RETRIES = 3;
const RETRY_DELAY_MIN = 5;
const MAX_CONCURRENT = 10;
const MIN_SYNC_INTERVAL_SEC = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Find all accounts due for sync
    const { data: dueAccounts, error: fetchErr } = await supabase
      .from("broker_accounts")
      .select("*")
      .eq("is_active", true)
      .eq("auto_sync_enabled", true)
      .eq("sync_in_progress", false)
      .lte("next_sync_at", new Date().toISOString())
      .lt("retry_count", MAX_RETRIES)
      .limit(MAX_CONCURRENT);

    if (fetchErr) {
      console.error("Failed to fetch due accounts:", fetchErr);
      return json({ success: false, error: fetchErr.message }, 500);
    }

    if (!dueAccounts || dueAccounts.length === 0) {
      return json({ success: true, message: "No accounts due for sync", processed: 0 });
    }

    console.log(`Processing ${dueAccounts.length} account(s) for sync`);

    const results: Array<{ account_id: string; status: string; trades?: number; error?: string }> = [];

    await Promise.all(
      dueAccounts.map(async (account) => {
        const accountId = account.id;
        const userId = account.user_id;

        // Rate limit: skip if last sync was less than 60s ago
        if (account.last_sync_at) {
          const elapsed = (Date.now() - new Date(account.last_sync_at).getTime()) / 1000;
          if (elapsed < MIN_SYNC_INTERVAL_SEC) {
            results.push({ account_id: accountId, status: "skipped", error: "Rate limited" });
            return;
          }
        }

        // Mark as syncing
        await supabase
          .from("broker_accounts")
          .update({ sync_in_progress: true, connection_status: "syncing" })
          .eq("id", accountId);

        try {
          let tradesCount = 0;

          // Check if account has MetaAPI provisioned
          if ((account as any).meta_api_account_id) {
            // Real MT5 sync via mt5-sync edge function
            const syncRes = await fetch(`${supabaseUrl}/functions/v1/mt5-sync/fetch-trades`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                broker_account_id: accountId,
                since: account.last_sync_at,
              }),
            });

            const syncData = await syncRes.json();
            if (!syncRes.ok) throw new Error(syncData.error || "MT5 sync failed");
            tradesCount = syncData.trades_ingested ?? 0;
          } else {
            // Simulated sync for non-MT5 accounts (placeholder)
            await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
            tradesCount = 0; // No real trades from simulated sync
          }

          // Update account: success
          const nextSync = new Date(
            Date.now() + account.sync_frequency * 60_000
          ).toISOString();

          await supabase
            .from("broker_accounts")
            .update({
              connection_status: "connected",
              last_sync_at: new Date().toISOString(),
              last_sync_error: null,
              next_sync_at: nextSync,
              sync_in_progress: false,
              retry_count: 0,
            })
            .eq("id", accountId);

          // Log success
          await supabase.from("sync_logs").insert({
            broker_account_id: accountId,
            user_id: userId,
            status: "success",
            trades_synced: tradesCount,
            error_message: null,
          });

          results.push({ account_id: accountId, status: "success", trades: tradesCount });
          console.log(`Sync success for ${accountId}: ${tradesCount} trades`);
        } catch (syncErr: unknown) {
          const errMsg = syncErr instanceof Error ? syncErr.message : "Unknown error";
          const newRetryCount = (account.retry_count ?? 0) + 1;
          const isMaxRetries = newRetryCount >= MAX_RETRIES;

          const nextSync = isMaxRetries
            ? null
            : new Date(Date.now() + RETRY_DELAY_MIN * 60_000).toISOString();

          await supabase
            .from("broker_accounts")
            .update({
              connection_status: isMaxRetries ? "error" : "retry_pending",
              last_sync_error: errMsg,
              next_sync_at: nextSync,
              sync_in_progress: false,
              retry_count: newRetryCount,
            })
            .eq("id", accountId);

          await supabase.from("sync_logs").insert({
            broker_account_id: accountId,
            user_id: userId,
            status: "failed",
            trades_synced: 0,
            error_message: errMsg,
          });

          results.push({ account_id: accountId, status: "failed", error: errMsg });
          console.error(`Sync failed for ${accountId} (retry ${newRetryCount}/${MAX_RETRIES}): ${errMsg}`);
        }
      })
    );

    return json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (e) {
    console.error("Scheduler error:", e);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
