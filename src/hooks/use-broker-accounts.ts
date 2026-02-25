import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const STALE_TIME = 5 * 60 * 1000;

export interface BrokerAccount {
  id: string;
  user_id: string;
  broker_name: string;
  account_number: string;
  account_type: string;
  api_key_masked: string | null;
  connection_status: string;
  sync_frequency: number;
  last_sync_at: string | null;
  last_sync_error: string | null;
  next_sync_at: string | null;
  sync_in_progress: boolean | null;
  auto_sync_enabled: boolean | null;
  retry_count: number | null;
  balance: number | null;
  is_active: boolean | null;
  created_at: string | null;
  meta_api_account_id?: string | null;
  broker_server?: string | null;
}

export interface SyncLog {
  id: string;
  broker_account_id: string;
  user_id: string;
  status: string;
  trades_synced: number;
  error_message: string | null;
  synced_at: string;
}

function maskValue(val: string): string {
  if (val.length <= 4) return "****";
  return val.slice(0, 3) + "****..." + val.slice(-3);
}

export function useBrokerAccountsFull() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["broker_accounts"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BrokerAccount[];
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  // Realtime subscription for broker account status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("broker-accounts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broker_accounts", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const createAccount = useMutation({
    mutationFn: async (input: {
      broker_name: string;
      account_number: string;
      account_type: string;
      api_key: string;
      api_secret: string;
      broker_server?: string;
    }) => {
      const masked = maskValue(input.api_key);
      const nextSync = new Date(Date.now() + 15 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("broker_accounts")
        .insert({
          user_id: user!.id,
          broker_name: input.broker_name,
          account_number: input.account_number,
          account_type: input.account_type,
          api_key_masked: masked,
          connection_status: "connected",
          is_active: true,
          auto_sync_enabled: true,
          next_sync_at: nextSync,
          broker_server: input.broker_server || null,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // If MT5 broker, provision with MetaAPI
      const isMT5 = input.broker_name.toLowerCase().includes("mt5") ||
                     input.broker_name.toLowerCase().includes("metatrader");
      if (isMT5 && input.broker_server) {
        try {
          const { data: session } = await supabase.auth.getSession();
          const provisionRes = await supabase.functions.invoke("mt5-sync/provision", {
            body: {
              broker_account_id: data.id,
              login: input.api_key,
              password: input.api_secret,
              server: input.broker_server,
              platform: "mt5",
            },
          });

          if (provisionRes.error) {
            console.error("MetaAPI provision failed:", provisionRes.error);
            toast({
              title: "Broker added, but MetaAPI setup failed",
              description: "You can retry syncing later.",
              variant: "destructive",
            });
          }
        } catch (e) {
          console.error("Provision error:", e);
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Broker connected successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to connect broker", description: err.message, variant: "destructive" });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BrokerAccount> & { id: string }) => {
      const { data, error } = await supabase
        .from("broker_accounts")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Account updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const disconnectAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("broker_accounts")
        .update({ connection_status: "disconnected", is_active: false, auto_sync_enabled: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Broker disconnected" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broker_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Broker account removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  const syncAccount = useMutation({
    mutationFn: async (id: string) => {
      const account = query.data?.find((a) => a.id === id);
      
      // Mark as syncing
      await supabase
        .from("broker_accounts")
        .update({ sync_in_progress: true, connection_status: "syncing" } as any)
        .eq("id", id);

      // If account has MetaAPI, do real sync
      if (account?.meta_api_account_id) {
        const res = await supabase.functions.invoke("mt5-sync/fetch-trades", {
          body: {
            broker_account_id: id,
            since: account.last_sync_at,
          },
        });

        const nextSync = new Date(Date.now() + (account.sync_frequency ?? 15) * 60_000).toISOString();

        if (res.error) {
          await supabase
            .from("broker_accounts")
            .update({
              connection_status: "error",
              sync_in_progress: false,
              last_sync_error: res.error.message,
            } as any)
            .eq("id", id);
          throw new Error(res.error.message);
        }

        const data = res.data as any;
        await supabase
          .from("broker_accounts")
          .update({
            last_sync_at: new Date().toISOString(),
            connection_status: "connected",
            sync_in_progress: false,
            last_sync_error: null,
            next_sync_at: nextSync,
            retry_count: 0,
          } as any)
          .eq("id", id);

        await supabase.from("sync_logs").insert({
          broker_account_id: id,
          user_id: user!.id,
          status: "success",
          trades_synced: data.trades_ingested ?? 0,
        });

        return data.trades_ingested ?? 0;
      }

      // Fallback: simulated sync for non-MT5 accounts
      await new Promise((r) => setTimeout(r, 2000));
      const tradesCount = 0;
      const nextSync = new Date(Date.now() + 15 * 60_000).toISOString();

      await supabase
        .from("broker_accounts")
        .update({
          last_sync_at: new Date().toISOString(),
          connection_status: "connected",
          sync_in_progress: false,
          last_sync_error: null,
          next_sync_at: nextSync,
          retry_count: 0,
        } as any)
        .eq("id", id);

      await supabase.from("sync_logs").insert({
        broker_account_id: id,
        user_id: user!.id,
        status: "success",
        trades_synced: tradesCount,
      });

      return tradesCount;
    },
    onSuccess: (tradesCount) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["sync_logs"] });
      qc.invalidateQueries({ queryKey: ["trades"] });
      toast({ title: `Synced ${tradesCount} trades` });
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleAutoSync = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const updates: any = { auto_sync_enabled: enabled };
      if (enabled) {
        updates.next_sync_at = new Date(Date.now() + 15 * 60_000).toISOString();
        updates.retry_count = 0;
        updates.last_sync_error = null;
      } else {
        updates.next_sync_at = null;
      }
      const { error } = await supabase
        .from("broker_accounts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Auto-sync updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update auto-sync", description: err.message, variant: "destructive" });
    },
  });

  return {
    accounts: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    createAccount,
    updateAccount,
    disconnectAccount,
    deleteAccount,
    syncAccount,
    toggleAutoSync,
  };
}

export function useSyncLogs(brokerAccountId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sync_logs", brokerAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("broker_account_id", brokerAccountId!)
        .order("synced_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as SyncLog[];
    },
    enabled: !!user && !!brokerAccountId,
    staleTime: 60_000,
  });

  // Realtime for sync logs
  useEffect(() => {
    if (!user || !brokerAccountId) return;
    const channel = supabase
      .channel(`sync-logs-${brokerAccountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_logs", filter: `broker_account_id=eq.${brokerAccountId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["sync_logs", brokerAccountId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, brokerAccountId, qc]);

  return query;
}
