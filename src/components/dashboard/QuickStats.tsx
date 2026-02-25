import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, CalendarClock, Flame, Snowflake } from "lucide-react";
import type { QuickStats as QuickStatsType } from "@/lib/portfolio-calculations";

interface Props {
  stats: QuickStatsType;
}

export function QuickStats({ stats }: Props) {
  const items = [
    { label: "This Month", value: stats.thisMonthTrades, icon: CalendarDays },
    { label: "This Week", value: stats.thisWeekTrades, icon: CalendarClock },
    { label: "Consec. Wins", value: stats.consecutiveWins, icon: Flame },
    { label: "Consec. Losses", value: stats.consecutiveLosses, icon: Snowflake },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
