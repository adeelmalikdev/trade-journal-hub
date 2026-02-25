import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingUp, Target, Activity,
  DollarSign, TrendingDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

interface Props {
  trades: Trade[];
  loading: boolean;
  totalBalance: number | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function PortfolioStatsCards({ trades, loading, totalBalance }: Props) {
  const closedTrades = trades.filter((t) => t.pnl !== null);
  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closedTrades.filter((t) => (t.pnl ?? 0) < 0);

  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgTrade = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  const pnls = closedTrades.map((t) => t.pnl ?? 0);
  const largestWin = pnls.length > 0 ? Math.max(...pnls, 0) : 0;
  const largestLoss = pnls.length > 0 ? Math.min(...pnls, 0) : 0;

  // Max drawdown from cumulative equity
  let peak = 0;
  let maxDd = 0;
  let cumPnl = 0;
  for (const p of pnls) {
    cumPnl += p;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDd) maxDd = dd;
  }
  const maxDdPct = peak > 0 ? -(maxDd / peak) * 100 : 0;

  const metrics = [
    {
      title: "Total Balance",
      value: totalBalance !== null ? fmt(totalBalance) : "—",
      icon: Wallet,
      positive: totalBalance !== null ? totalBalance >= 0 : null,
    },
    {
      title: "Total P&L",
      value: fmt(totalPnl),
      icon: TrendingUp,
      positive: totalPnl >= 0,
      sub: pct(totalPnl),
    },
    {
      title: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      icon: Target,
      positive: winRate >= 50,
      sub: `${wins.length}/${closedTrades.length} trades`,
    },
    {
      title: "Profit Factor",
      value: profitFactor === Infinity ? "∞" : profitFactor.toFixed(2),
      icon: Activity,
      positive: profitFactor >= 1,
    },
    {
      title: "Avg Trade",
      value: fmt(avgTrade),
      icon: DollarSign,
      positive: avgTrade >= 0,
    },
    {
      title: "Max Drawdown",
      value: pct(maxDdPct),
      icon: TrendingDown,
      positive: false,
    },
    {
      title: "Largest Win",
      value: fmt(largestWin),
      icon: ArrowUp,
      positive: true,
    },
    {
      title: "Largest Loss",
      value: fmt(largestLoss),
      icon: ArrowDown,
      positive: false,
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-7 w-32" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
            <m.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", m.positive === true && "text-positive", m.positive === false && "text-negative")}>
              {m.value}
            </div>
            {m.sub && (
              <p className={cn("text-xs mt-1", m.positive ? "text-positive" : "text-negative")}>{m.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
