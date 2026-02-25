import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function RecentTrades({ trades }: { trades: Trade[] }) {
  const navigate = useNavigate();
  const recent = trades.slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Trades</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/journal")}>
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold">{t.symbol ?? "—"}</span>
              {t.strategy && (
                <Badge variant="secondary" className="text-xs">{t.strategy}</Badge>
              )}
            </div>
            <span className={cn("font-mono font-medium", (t.pnl ?? 0) >= 0 ? "text-positive" : "text-negative")}>
              {t.pnl !== null ? fmt(t.pnl) : "Open"}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
