import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

export interface PortfolioMetrics {
  totalBalance: number;
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  avgTrade: number;
  maxDrawdown: number;
  largestWin: number;
  largestLoss: number;
  totalTrades: number;
  winningTrades: number;
}

export interface MonthlyPerformance {
  month: string; // YYYY-MM
  label: string;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  profit: number;
  pnlPercent: number;
}

export interface EquityPoint {
  date: string;
  balance: number;
}

export interface QuickStats {
  thisMonthTrades: number;
  thisWeekTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

const STARTING_CAPITAL = 50000;

export function computeMetrics(trades: Trade[]): PortfolioMetrics {
  const closed = trades.filter((t) => t.pnl != null);
  const totalTrades = closed.length;
  if (totalTrades === 0) {
    return {
      totalBalance: STARTING_CAPITAL,
      totalPnL: 0,
      winRate: 0,
      profitFactor: 0,
      avgTrade: 0,
      maxDrawdown: 0,
      largestWin: 0,
      largestLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
    };
  }

  const pnls = closed.map((t) => t.pnl!);
  const totalPnL = pnls.reduce((s, v) => s + v, 0);
  const winningTrades = pnls.filter((p) => p > 0).length;
  const winRate = (winningTrades / totalTrades) * 100;

  const grossProfit = pnls.filter((p) => p > 0).reduce((s, v) => s + v, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((s, v) => s + v, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgTrade = totalPnL / totalTrades;
  const largestWin = Math.max(0, ...pnls);
  const largestLoss = Math.min(0, ...pnls);

  // Max drawdown from equity curve
  const sorted = [...closed].sort(
    (a, b) => new Date(a.exit_time ?? a.created_at!).getTime() - new Date(b.exit_time ?? b.created_at!).getTime()
  );
  let peak = STARTING_CAPITAL;
  let maxDD = 0;
  let equity = STARTING_CAPITAL;
  for (const t of sorted) {
    equity += t.pnl!;
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalBalance: STARTING_CAPITAL + totalPnL,
    totalPnL,
    winRate,
    profitFactor,
    avgTrade,
    maxDrawdown: -maxDD,
    largestWin,
    largestLoss,
    totalTrades,
    winningTrades,
  };
}

export function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  const closed = trades.filter((t) => t.pnl != null);
  const sorted = [...closed].sort(
    (a, b) => new Date(a.exit_time ?? a.created_at!).getTime() - new Date(b.exit_time ?? b.created_at!).getTime()
  );

  const points: EquityPoint[] = [{ date: "Start", balance: STARTING_CAPITAL }];
  let balance = STARTING_CAPITAL;
  for (const t of sorted) {
    balance += t.pnl!;
    const d = t.exit_time ?? t.created_at!;
    points.push({
      date: new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      balance: Math.round(balance * 100) / 100,
    });
  }
  return points;
}

export function computeMonthlyPerformance(trades: Trade[]): MonthlyPerformance[] {
  const closed = trades.filter((t) => t.pnl != null);
  const byMonth = new Map<string, Trade[]>();

  for (const t of closed) {
    const d = new Date(t.exit_time ?? t.created_at!);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(t);
  }

  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, monthTrades]) => {
      const pnls = monthTrades.map((t) => t.pnl!);
      const profit = pnls.reduce((s, v) => s + v, 0);
      const wins = pnls.filter((p) => p > 0).length;
      const totalInvested = monthTrades.reduce(
        (s, t) => s + (t.entry_price ?? 0) * (t.position_size ?? 0),
        0
      );
      return {
        month,
        label: new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        totalTrades: monthTrades.length,
        winningTrades: wins,
        winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0,
        profit,
        pnlPercent: totalInvested > 0 ? (profit / totalInvested) * 100 : 0,
      };
    });
}

export function computeQuickStats(trades: Trade[]): QuickStats {
  const closed = trades.filter((t) => t.pnl != null);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const thisMonthTrades = closed.filter(
    (t) => new Date(t.exit_time ?? t.created_at!) >= startOfMonth
  ).length;
  const thisWeekTrades = closed.filter(
    (t) => new Date(t.exit_time ?? t.created_at!) >= startOfWeek
  ).length;

  // Consecutive streaks (most recent first)
  const sorted = [...closed].sort(
    (a, b) => new Date(b.exit_time ?? b.created_at!).getTime() - new Date(a.exit_time ?? a.created_at!).getTime()
  );

  let consecutiveWins = 0;
  let consecutiveLosses = 0;
  if (sorted.length > 0) {
    const firstPnl = sorted[0].pnl!;
    if (firstPnl > 0) {
      for (const t of sorted) {
        if (t.pnl! > 0) consecutiveWins++;
        else break;
      }
    } else if (firstPnl < 0) {
      for (const t of sorted) {
        if (t.pnl! < 0) consecutiveLosses++;
        else break;
      }
    }
  }

  return { thisMonthTrades, thisWeekTrades, consecutiveWins, consecutiveLosses };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
