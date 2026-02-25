import { useAuth } from "@/contexts/AuthContext";
import { useTrades, usePortfolio } from "@/hooks/use-api";
import { PortfolioStatsCards } from "@/components/dashboard/PortfolioStatsCards";
import { EquityCurveChart } from "@/components/dashboard/EquityCurveChart";
import { MonthlyPerformanceTable } from "@/components/dashboard/MonthlyPerformanceTable";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { QuickStats } from "@/components/dashboard/QuickStats";

export default function Dashboard() {
  const { user } = useAuth();
  const { trades, loading: tradesLoading } = useTrades();
  const { snapshot, loading: portfolioLoading } = usePortfolio();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.email}
        </p>
      </div>

      <PortfolioStatsCards
        trades={trades}
        loading={tradesLoading || portfolioLoading}
        totalBalance={snapshot?.total_balance ?? null}
      />

      <EquityCurveChart trades={trades} loading={tradesLoading} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyPerformanceTable trades={trades} />
        </div>
        <div className="space-y-6">
          <QuickStats trades={trades} />
          <RecentTrades trades={trades} />
        </div>
      </div>
    </div>
  );
}
