import { Card, CardContent } from "@/components/ui/card";
import type { PerformanceSummary } from "@/lib/analytics-calculations";
import { formatCurrency } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface Props {
  current: PerformanceSummary;
  previous: PerformanceSummary | null;
}

function Delta({ current, previous, suffix = "", invert = false }: { current: number; previous: number; suffix?: string; invert?: boolean }) {
  if (!previous) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const positive = invert ? diff < 0 : diff > 0;
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px]", positive ? "text-gain" : "text-loss")}>
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(diff).toFixed(1)}{suffix}
    </span>
  );
}

export function PerformanceSummaryCards({ current, previous }: Props) {
  const metrics = [
    { label: "Win Rate", value: `${current.winRate.toFixed(1)}%`, prev: previous?.winRate, suffix: "%", color: current.winRate >= 50 },
    { label: "Profit Factor", value: current.profitFactor === Infinity ? "∞" : current.profitFactor.toFixed(2), prev: previous?.profitFactor, color: current.profitFactor >= 1 },
    { label: "Sharpe Ratio", value: current.sharpeRatio.toFixed(2), prev: previous?.sharpeRatio, color: current.sharpeRatio > 0 },
    { label: "Avg Trade P&L", value: formatCurrency(current.avgTradePnL), prev: previous?.avgTradePnL, color: current.avgTradePnL >= 0 },
    { label: "Best Trade", value: formatCurrency(current.bestTrade), color: true },
    { label: "Worst Trade", value: formatCurrency(current.worstTrade), color: false },
    { label: "Avg Win", value: formatCurrency(current.avgWin), prev: previous?.avgWin, color: true },
    { label: "Avg Loss", value: formatCurrency(-current.avgLoss), prev: previous ? previous.avgLoss : undefined, invert: true, color: false },
    { label: "Risk/Reward", value: current.riskRewardRatio === Infinity ? "∞" : current.riskRewardRatio.toFixed(2), prev: previous?.riskRewardRatio, color: current.riskRewardRatio >= 1 },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
            <p className={cn("text-lg font-bold", m.color ? "text-gain" : "text-loss")}>{m.value}</p>
            {m.prev !== undefined && previous && (
              <Delta current={typeof m.prev === "number" ? (m.label.includes("Avg Trade") ? current.avgTradePnL : 0) : 0} previous={0} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
