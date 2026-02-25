import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

// ─── Broker Accounts ───────────────────────────────────────────────

export function useBrokerAccounts() {
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
      return data;
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  const createAccount = useMutation({
    mutationFn: async (input: { broker_name: string; account_number: string }) => {
      const { data, error } = await supabase
        .from("broker_accounts")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Broker account added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add broker", description: err.message, variant: "destructive" });
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
      toast({ title: "Failed to remove broker", description: err.message, variant: "destructive" });
    },
  });

  return {
    accounts: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    createAccount,
    deleteAccount,
  };
}

// ─── Trades ────────────────────────────────────────────────────────

export function useTrades() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["trades"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const allTrades: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("trades")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allTrades.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return allTrades;
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("trades-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const createTrade = useMutation({
    mutationFn: async (input: Omit<TablesInsert<"trades">, "user_id">) => {
      const { data, error } = await supabase
        .from("trades")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Trade added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add trade", description: err.message, variant: "destructive" });
    },
  });

  const updateTrade = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"trades"> & { id: string }) => {
      const { data, error } = await supabase
        .from("trades")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Trade updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update trade", description: err.message, variant: "destructive" });
    },
  });

  const deleteTrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Trade deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete trade", description: err.message, variant: "destructive" });
    },
  });

  return {
    trades: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    createTrade,
    updateTrade,
    deleteTrade,
  };
}

// ─── Portfolio ─────────────────────────────────────────────────────

export function usePortfolio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["portfolio"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("portfolio-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portfolio_snapshots", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: key });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return {
    snapshot: query.data,
    loading: query.isLoading,
    error: query.error,
  };
}
