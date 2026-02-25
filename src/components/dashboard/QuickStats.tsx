import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isThisMonth, isThisWeek } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

export function QuickStats({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => {
    const thisMonth = trades.filter((t) => t.created_at && isThisMonth(new Date(t.created_at))).length;
    const thisWeek = trades.filter((t) => t.created_at && isThisWeek(new Date(t.created_at), { weekStartsOn: 1 })).length;

    // Consecutive wins/losses from most recent
    const sorted = [...trades].filter((t) => t.pnl !== null).sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
    let consWins = 0;
    let consLosses = 0;
    for (const t of sorted) {
      if ((t.pnl ?? 0) > 0) { consWins++; } else break;
    }
    if (consWins === 0) {
      for (const t of sorted) {
        if ((t.pnl ?? 0) <= 0) { consLosses++; } else break;
      }
    }

    return [
      { label: "This Month", value: thisMonth },
      { label: "This Week", value: thisWeek },
      { label: "Consecutive Wins", value: consWins },
      { label: "Consecutive Losses", value: consLosses },
    ];
  }, [trades]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
