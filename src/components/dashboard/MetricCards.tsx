import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Award,
} from "lucide-react";
import type { PortfolioMetrics } from "@/lib/portfolio-calculations";
import { formatCurrency, formatPercent } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";

interface Props {
  metrics: PortfolioMetrics;
}

export function MetricCards({ metrics }: Props) {
  const cards = [
    {
      label: "Total Balance",
      value: formatCurrency(metrics.totalBalance),
      icon: Wallet,
      color: "text-primary",
    },
    {
      label: "Total P&L",
      value: formatCurrency(metrics.totalPnL),
      icon: TrendingUp,
      color: metrics.totalPnL >= 0 ? "text-gain" : "text-loss",
      sub: formatPercent(
        metrics.totalBalance > 0
          ? (metrics.totalPnL / (metrics.totalBalance - metrics.totalPnL)) * 100
          : 0
      ),
    },
    {
      label: "Win Rate",
      value: `${metrics.winRate.toFixed(1)}%`,
      icon: Target,
      color: metrics.winRate >= 50 ? "text-gain" : "text-loss",
    },
    {
      label: "Profit Factor",
      value: metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2),
      icon: BarChart3,
      color: metrics.profitFactor >= 1 ? "text-gain" : "text-loss",
    },
    {
      label: "Avg Trade",
      value: formatCurrency(metrics.avgTrade),
      icon: metrics.avgTrade >= 0 ? ArrowUpRight : ArrowDownRight,
      color: metrics.avgTrade >= 0 ? "text-gain" : "text-loss",
    },
    {
      label: "Max Drawdown",
      value: formatPercent(metrics.maxDrawdown),
      icon: TrendingDown,
      color: "text-loss",
    },
    {
      label: "Largest Win",
      value: formatCurrency(metrics.largestWin),
      icon: Award,
      color: "text-gain",
    },
    {
      label: "Largest Loss",
      value: formatCurrency(metrics.largestLoss),
      icon: ArrowDownRight,
      color: "text-loss",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <p className={cn("text-xl font-bold tracking-tight", c.color)}>{c.value}</p>
            {c.sub && (
              <p className={cn("text-xs mt-0.5", c.color)}>{c.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
