import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function MonthlyPerformanceTable({ trades }: { trades: Trade[] }) {
  const months = useMemo(() => {
    const closed = trades.filter((t) => t.pnl !== null && t.exit_time);
    const map = new Map<string, Trade[]>();
    for (const t of closed) {
      const key = format(new Date(t.exit_time!), "yyyy-MM");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }

    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, monthTrades]) => {
        const wins = monthTrades.filter((t) => (t.pnl ?? 0) > 0);
        const pnl = monthTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
        return {
          month: format(parseISO(`${month}-01`), "MMM yyyy"),
          total: monthTrades.length,
          wins: wins.length,
          winRate: ((wins.length / monthTrades.length) * 100).toFixed(1),
          pnl,
        };
      });
  }, [trades]);

  if (months.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Wins</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => (
              <TableRow key={m.month}>
                <TableCell className="font-medium">{m.month}</TableCell>
                <TableCell className="text-right">{m.total}</TableCell>
                <TableCell className="text-right">{m.wins}</TableCell>
                <TableCell className="text-right">{m.winRate}%</TableCell>
                <TableCell className={cn("text-right font-medium", m.pnl >= 0 ? "text-positive" : "text-negative")}>
                  {fmt(m.pnl)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
