import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";

interface Props {
  trades: Tables<"trades">[];
}

export function RecentTrades({ trades }: Props) {
  const recent = trades
    .filter((t) => t.pnl != null)
    .sort(
      (a, b) =>
        new Date(b.exit_time ?? b.created_at!).getTime() -
        new Date(a.exit_time ?? a.created_at!).getTime()
    )
    .slice(0, 5);

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-center py-8">
          No trades yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Trades</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/journal">
            View All <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <Badge
                variant={t.direction === "long" ? "default" : "secondary"}
                className="text-[10px] uppercase"
              >
                {t.direction}
              </Badge>
              <div>
                <p className="text-sm font-medium">{t.symbol ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{t.strategy ?? "—"}</p>
              </div>
            </div>
            <span
              className={cn(
                "text-sm font-semibold",
                t.pnl! > 0 ? "text-gain" : t.pnl! < 0 ? "text-loss" : "text-muted-foreground"
              )}
            >
              {formatCurrency(t.pnl!)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
