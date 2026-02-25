import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Trade {
  pnl: number | null;
  direction: string | null;
}

export function TradeStats({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => {
    const total = trades.length;
    const winners = trades.filter((t) => (t.pnl ?? 0) > 0).length;
    const winRate = total > 0 ? ((winners / total) * 100).toFixed(1) : "—";
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const avgPnl = total > 0 ? totalPnl / total : 0;

    return [
      { title: "Total Trades", value: String(total), icon: BarChart3 },
      { title: "Win Rate", value: total > 0 ? `${winRate}%` : "—", subtitle: total > 0 ? `${winners}W / ${total - winners}L` : undefined, icon: Target },
      { title: "Total P&L", value: `$${totalPnl.toFixed(2)}`, positive: totalPnl >= 0, icon: DollarSign },
      { title: "Avg P&L", value: total > 0 ? `$${avgPnl.toFixed(2)}` : "—", positive: avgPnl >= 0, icon: TrendingUp },
    ];
  }, [trades]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", "positive" in s && (s.positive ? "text-emerald-500" : "text-red-500"))}>
              {s.value}
            </div>
            {s.subtitle && <p className="text-xs text-muted-foreground">{s.subtitle}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
