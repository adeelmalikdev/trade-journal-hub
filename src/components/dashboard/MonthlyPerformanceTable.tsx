import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyPerformance } from "@/lib/portfolio-calculations";
import { formatCurrency, formatPercent } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";

interface Props {
  data: MonthlyPerformance[];
}

export function MonthlyPerformanceTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Performance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-center py-8">
          No monthly data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Wins</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead className="text-right">P&L %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.month}
                className={cn(
                  row.profit > 0
                    ? "bg-gain/5 hover:bg-gain/10"
                    : row.profit < 0
                    ? "bg-loss/5 hover:bg-loss/10"
                    : ""
                )}
              >
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right">{row.totalTrades}</TableCell>
                <TableCell className="text-right">{row.winningTrades}</TableCell>
                <TableCell className="text-right">{row.winRate.toFixed(1)}%</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    row.profit > 0 ? "text-gain" : row.profit < 0 ? "text-loss" : ""
                  )}
                >
                  {formatCurrency(row.profit)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    row.pnlPercent > 0 ? "text-gain" : row.pnlPercent < 0 ? "text-loss" : ""
                  )}
                >
                  {formatPercent(row.pnlPercent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
