import { useAuth } from "@/contexts/AuthContext";
import { useTrades } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { EquityCurveChart } from "@/components/dashboard/EquityCurveChart";
import { MonthlyPerformanceTable } from "@/components/dashboard/MonthlyPerformanceTable";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { QuickStats } from "@/components/dashboard/QuickStats";
import {
  computeMetrics,
  computeEquityCurve,
  computeMonthlyPerformance,
  computeQuickStats,
} from "@/lib/portfolio-calculations";
import { useMemo } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const { trades, loading } = useTrades();

  const metrics = useMemo(() => computeMetrics(trades), [trades]);
  const equityData = useMemo(() => computeEquityCurve(trades), [trades]);
  const monthlyData = useMemo(() => computeMonthlyPerformance(trades), [trades]);
  const quickStats = useMemo(() => computeQuickStats(trades), [trades]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.email}</p>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.email}</p>
      </div>

      <MetricCards metrics={metrics} />

      <EquityCurveChart data={equityData} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyPerformanceTable data={monthlyData} />
        </div>
        <div className="space-y-6">
          <QuickStats stats={quickStats} />
          <RecentTrades trades={trades} />
        </div>
      </div>
    </div>
  );
}
