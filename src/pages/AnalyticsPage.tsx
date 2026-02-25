import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/use-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp } from "lucide-react";
import { PerformanceSummaryCards } from "@/components/analytics/PerformanceSummaryCards";
import { StrategyTab } from "@/components/analytics/StrategyTab";
import { TimeTab } from "@/components/analytics/TimeTab";
import { SymbolTab } from "@/components/analytics/SymbolTab";
import { DrawdownTab } from "@/components/analytics/DrawdownTab";
import { ConsistencyTab } from "@/components/analytics/ConsistencyTab";
import {
  type Period,
  filterByPeriod,
  getPreviousPeriodTrades,
  computePerformanceSummary,
  computeStrategyBreakdown,
  computeHourBreakdown,
  computeSymbolBreakdown,
  computeDrawdownAnalysis,
  computeConsistencyMetrics,
} from "@/lib/analytics-calculations";
import { useNavigate } from "react-router-dom";

const periods: { label: string; value: Period }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All Time", value: "all" },
];

export default function AnalyticsPage() {
  const { trades, loading } = useTrades();
  const [period, setPeriod] = useState<Period>("all");
  const navigate = useNavigate();

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const prevFiltered = useMemo(() => getPreviousPeriodTrades(trades, period), [trades, period]);

  const summary = useMemo(() => computePerformanceSummary(filtered), [filtered]);
  const prevSummary = useMemo(
    () => (prevFiltered.length > 0 ? computePerformanceSummary(prevFiltered) : null),
    [prevFiltered]
  );
  const strategyData = useMemo(() => computeStrategyBreakdown(filtered), [filtered]);
  const hourData = useMemo(() => computeHourBreakdown(filtered), [filtered]);
  const symbolData = useMemo(() => computeSymbolBreakdown(filtered), [filtered]);
  const drawdownData = useMemo(() => computeDrawdownAnalysis(filtered), [filtered]);
  const consistencyData = useMemo(() => computeConsistencyMetrics(filtered), [filtered]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-1">No trades to analyze</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Start adding trades in the Journal to see performance analytics, strategy breakdowns, and more.
          </p>
          <Button onClick={() => navigate("/journal")}>
            <TrendingUp className="mr-2 h-4 w-4" /> Go to Journal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {periods.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "default" : "ghost"}
              className="text-xs h-7"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <PerformanceSummaryCards current={summary} previous={prevSummary} />

      <Tabs defaultValue="strategy">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="strategy">By Strategy</TabsTrigger>
          <TabsTrigger value="time">By Time</TabsTrigger>
          <TabsTrigger value="symbol">By Symbol</TabsTrigger>
          <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
          <TabsTrigger value="consistency">Consistency</TabsTrigger>
        </TabsList>
        <TabsContent value="strategy" className="mt-4">
          <StrategyTab data={strategyData} onSelectStrategy={(s) => navigate(`/journal?strategy=${s}`)} />
        </TabsContent>
        <TabsContent value="time" className="mt-4">
          <TimeTab data={hourData} />
        </TabsContent>
        <TabsContent value="symbol" className="mt-4">
          <SymbolTab data={symbolData} onSelectSymbol={(s) => navigate(`/journal?symbol=${s}`)} />
        </TabsContent>
        <TabsContent value="drawdown" className="mt-4">
          <DrawdownTab analysis={drawdownData} />
        </TabsContent>
        <TabsContent value="consistency" className="mt-4">
          <ConsistencyTab metrics={consistencyData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
