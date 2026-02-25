import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AccountSummaryData {
  success: boolean;
  generated_at: string;
  account: {
    login: number;
    name: string;
    server: string;
    platform: string;
    currency: string;
    leverage: number;
    balance: number;
    equity: number;
    margin: number;
    free_margin: number;
    margin_level: number | null;
  };
  open_positions: {
    count: number;
    total_floating_pnl: number;
    positions: {
      id: string;
      symbol: string;
      type: string;
      volume: number;
      entry_price: number;
      current_price: number;
      floating_pnl: number;
      swap: number;
      commission: number;
      opened_at: string;
      stop_loss: number | null;
      take_profit: number | null;
    }[];
  };
  trade_history: {
    period: { from: string; to: string };
    symbol_filter: string | null;
    total_deals: number;
    matched_trades: number;
    trades: {
      id: string;
      symbol: string;
      direction: string;
      entry_time: string;
      entry_price: number;
      exit_time: string;
      exit_price: number;
      volume: number;
      fees: number;
      pnl: number;
    }[];
  };
  analytics: {
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
  };
}

export function useAccountSummary() {
  const [data, setData] = useState<AccountSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSummary = async (params: {
    broker_account_id: string;
    from_date?: string;
    to_date?: string;
    symbol?: string;
  }) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await supabase.functions.invoke("mt5-sync/account-summary", {
        body: params,
      });

      if (res.error) throw new Error(res.error.message);
      const result = res.data as AccountSummaryData;
      if (!result.success) throw new Error("Failed to fetch account summary");

      setData(result);
      return result;
    } catch (e: any) {
      const msg = e?.message || "Failed to fetch account summary";
      setError(msg);
      toast({ title: "Account Summary Error", description: msg, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchSummary };
}
