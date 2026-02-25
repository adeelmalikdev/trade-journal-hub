import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Snowflake, Clock, Moon, CalendarDays } from "lucide-react";
import type { ConsistencyMetrics } from "@/lib/analytics-calculations";

interface Props {
  metrics: ConsistencyMetrics;
}

export function ConsistencyTab({ metrics }: Props) {
  const items = [
    { label: "Max Consecutive Wins", value: metrics.maxConsecutiveWins, icon: Flame, color: "text-gain" },
    { label: "Max Consecutive Losses", value: metrics.maxConsecutiveLosses, icon: Snowflake, color: "text-loss" },
    {
      label: "Avg Trade Duration",
      value:
        metrics.avgTradeDurationMinutes < 60
          ? `${metrics.avgTradeDurationMinutes.toFixed(0)} min`
          : metrics.avgTradeDurationMinutes < 1440
          ? `${(metrics.avgTradeDurationMinutes / 60).toFixed(1)} hrs`
          : `${(metrics.avgTradeDurationMinutes / 1440).toFixed(1)} days`,
      icon: Clock,
      color: "text-primary",
    },
    { label: "Held Overnight", value: `${metrics.overnightPercent.toFixed(1)}%`, icon: Moon, color: "text-muted-foreground" },
    { label: "Best Day of Week", value: metrics.bestDayOfWeek, icon: CalendarDays, color: "text-gain" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
