import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

// ─── Helpers ──────────────────────────────────────────────────────

function closed(trades: Trade[]) {
  return trades.filter((t) => t.pnl != null);
}

function pnls(trades: Trade[]) {
  return closed(trades).map((t) => t.pnl!);
}

function wins(p: number[]) {
  return p.filter((v) => v > 0);
}
function losses(p: number[]) {
  return p.filter((v) => v < 0);
}

function sum(arr: number[]) {
  return arr.reduce((s, v) => s + v, 0);
}
function mean(arr: number[]) {
  return arr.length ? sum(arr) / arr.length : 0;
}
function stdDev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((v) => (v - m) ** 2)) / (arr.length - 1));
}

// ─── Period Filter ───────────────────────────────────────────────

export type Period = "today" | "week" | "month" | "all";

export function filterByPeriod(trades: Trade[], period: Period): Trade[] {
  if (period === "all") return trades;
  const now = new Date();
  let start: Date;
  if (period === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return trades.filter((t) => new Date(t.exit_time ?? t.created_at!) >= start);
}

export function getPreviousPeriodTrades(trades: Trade[], period: Period): Trade[] {
  if (period === "all") return [];
  const now = new Date();
  let start: Date;
  let end: Date;
  if (period === "today") {
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start = new Date(end);
    start.setDate(start.getDate() - 1);
  } else if (period === "week") {
    end = new Date(now);
    end.setDate(now.getDate() - now.getDay());
    end.setHours(0, 0, 0, 0);
    start = new Date(end);
    start.setDate(start.getDate() - 7);
  } else {
    end = new Date(now.getFullYear(), now.getMonth(), 1);
    start = new Date(end);
    start.setMonth(start.getMonth() - 1);
  }
  return trades.filter((t) => {
    const d = new Date(t.exit_time ?? t.created_at!);
    return d >= start && d < end;
  });
}

// ─── Performance Summary ─────────────────────────────────────────

export interface PerformanceSummary {
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  avgTradePnL: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  riskRewardRatio: number;
  totalTrades: number;
  totalPnL: number;
}

const STARTING_CAPITAL = 50000;

export function computePerformanceSummary(trades: Trade[]): PerformanceSummary {
  const p = pnls(trades);
  const w = wins(p);
  const l = losses(p);

  const winRate = p.length ? (w.length / p.length) * 100 : 0;
  const grossProfit = sum(w);
  const grossLoss = Math.abs(sum(l));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const returns = p.map((v) => v / STARTING_CAPITAL);
  const sharpeRatio = stdDev(returns) > 0 ? (mean(returns) / stdDev(returns)) * Math.sqrt(252) : 0;

  const avgWin = w.length ? mean(w) : 0;
  const avgLoss = l.length ? Math.abs(mean(l)) : 0;
  const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  return {
    winRate,
    profitFactor,
    sharpeRatio,
    avgTradePnL: mean(p),
    bestTrade: p.length ? Math.max(...p) : 0,
    worstTrade: p.length ? Math.min(...p) : 0,
    avgWin,
    avgLoss,
    riskRewardRatio,
    totalTrades: p.length,
    totalPnL: sum(p),
  };
}

// ─── Strategy Breakdown ──────────────────────────────────────────

export interface StrategyBreakdown {
  strategy: string;
  trades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  profitFactor: number;
}

export function computeStrategyBreakdown(trades: Trade[]): StrategyBreakdown[] {
  const c = closed(trades);
  const byStrategy = new Map<string, Trade[]>();
  for (const t of c) {
    const s = t.strategy || "Unknown";
    if (!byStrategy.has(s)) byStrategy.set(s, []);
    byStrategy.get(s)!.push(t);
  }
  return Array.from(byStrategy.entries())
    .map(([strategy, stratTrades]) => {
      const p = pnls(stratTrades);
      const w = wins(p);
      const l = losses(p);
      const gp = sum(w);
      const gl = Math.abs(sum(l));
      return {
        strategy,
        trades: p.length,
        winRate: p.length ? (w.length / p.length) * 100 : 0,
        totalPnL: sum(p),
        avgPnL: mean(p),
        profitFactor: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0,
      };
    })
    .sort((a, b) => b.totalPnL - a.totalPnL);
}

// ─── Time Breakdown ──────────────────────────────────────────────

export interface HourBreakdown {
  hour: number;
  label: string;
  trades: number;
  winRate: number;
  totalPnL: number;
}

export function computeHourBreakdown(trades: Trade[]): HourBreakdown[] {
  const c = closed(trades);
  const byHour = new Map<number, Trade[]>();
  for (const t of c) {
    const h = new Date(t.entry_time ?? t.created_at!).getHours();
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(t);
  }
  return Array.from({ length: 24 }, (_, h) => {
    const hTrades = byHour.get(h) ?? [];
    const p = pnls(hTrades);
    const w = wins(p);
    return {
      hour: h,
      label: `${h.toString().padStart(2, "0")}:00`,
      trades: p.length,
      winRate: p.length ? (w.length / p.length) * 100 : 0,
      totalPnL: sum(p),
    };
  });
}

// ─── Symbol Breakdown ────────────────────────────────────────────

export interface SymbolBreakdown {
  symbol: string;
  trades: number;
  winRate: number;
  totalPnL: number;
  bestTrade: number;
  worstTrade: number;
}

export function computeSymbolBreakdown(trades: Trade[]): SymbolBreakdown[] {
  const c = closed(trades);
  const bySymbol = new Map<string, Trade[]>();
  for (const t of c) {
    const s = t.symbol || "Unknown";
    if (!bySymbol.has(s)) bySymbol.set(s, []);
    bySymbol.get(s)!.push(t);
  }
  return Array.from(bySymbol.entries())
    .map(([symbol, symTrades]) => {
      const p = pnls(symTrades);
      const w = wins(p);
      return {
        symbol,
        trades: p.length,
        winRate: p.length ? (w.length / p.length) * 100 : 0,
        totalPnL: sum(p),
        bestTrade: p.length ? Math.max(...p) : 0,
        worstTrade: p.length ? Math.min(...p) : 0,
      };
    })
    .sort((a, b) => b.totalPnL - a.totalPnL);
}

// ─── Drawdown ────────────────────────────────────────────────────

export interface DrawdownPoint {
  date: string;
  balance: number;
  peak: number;
  drawdown: number;
}

export interface DrawdownAnalysis {
  points: DrawdownPoint[];
  currentDrawdown: number;
  maxDrawdown: number;
  maxDrawdownPeriod: { start: string; end: string } | null;
}

export function computeDrawdownAnalysis(trades: Trade[]): DrawdownAnalysis {
  const c = closed(trades);
  const sorted = [...c].sort(
    (a, b) => new Date(a.exit_time ?? a.created_at!).getTime() - new Date(b.exit_time ?? b.created_at!).getTime()
  );

  const points: DrawdownPoint[] = [];
  let balance = STARTING_CAPITAL;
  let peak = STARTING_CAPITAL;
  let maxDD = 0;
  let maxDDStart = "";
  let maxDDEnd = "";
  let ddStartCandidate = "Start";

  for (const t of sorted) {
    balance += t.pnl!;
    const d = new Date(t.exit_time ?? t.created_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (balance > peak) {
      peak = balance;
      ddStartCandidate = d;
    }
    const dd = ((peak - balance) / peak) * 100;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDStart = ddStartCandidate;
      maxDDEnd = d;
    }
    points.push({ date: d, balance, peak, drawdown: -dd });
  }

  const currentDD = peak > 0 ? ((peak - balance) / peak) * 100 : 0;

  return {
    points,
    currentDrawdown: -currentDD,
    maxDrawdown: -maxDD,
    maxDrawdownPeriod: maxDDStart ? { start: maxDDStart, end: maxDDEnd } : null,
  };
}

// ─── Consistency Metrics ─────────────────────────────────────────

export interface ConsistencyMetrics {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDurationMinutes: number;
  overnightPercent: number;
  bestDayOfWeek: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function computeConsistencyMetrics(trades: Trade[]): ConsistencyMetrics {
  const c = closed(trades);
  const sorted = [...c].sort(
    (a, b) => new Date(a.exit_time ?? a.created_at!).getTime() - new Date(b.exit_time ?? b.created_at!).getTime()
  );

  // Consecutive streaks
  let maxWins = 0, maxLosses = 0, curWins = 0, curLosses = 0;
  for (const t of sorted) {
    if (t.pnl! > 0) { curWins++; curLosses = 0; maxWins = Math.max(maxWins, curWins); }
    else if (t.pnl! < 0) { curLosses++; curWins = 0; maxLosses = Math.max(maxLosses, curLosses); }
    else { curWins = 0; curLosses = 0; }
  }

  // Avg duration
  const withBothTimes = c.filter((t) => t.entry_time && t.exit_time);
  const avgDuration = withBothTimes.length
    ? mean(withBothTimes.map((t) => (new Date(t.exit_time!).getTime() - new Date(t.entry_time!).getTime()) / 60000))
    : 0;

  // Overnight %
  const overnight = withBothTimes.filter((t) => {
    const entry = new Date(t.entry_time!);
    const exit = new Date(t.exit_time!);
    return entry.getDate() !== exit.getDate();
  }).length;
  const overnightPercent = withBothTimes.length ? (overnight / withBothTimes.length) * 100 : 0;

  // Best day
  const byDay = new Map<number, number[]>();
  for (const t of c) {
    const d = new Date(t.entry_time ?? t.created_at!).getDay();
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(t.pnl!);
  }
  let bestDay = "—";
  let bestDayPnL = -Infinity;
  for (const [day, dayPnls] of byDay) {
    const total = sum(dayPnls);
    if (total > bestDayPnL) { bestDayPnL = total; bestDay = DAYS[day]; }
  }

  return {
    maxConsecutiveWins: maxWins,
    maxConsecutiveLosses: maxLosses,
    avgTradeDurationMinutes: avgDuration,
    overnightPercent,
    bestDayOfWeek: bestDay,
  };
}
