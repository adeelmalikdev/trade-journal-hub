import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { StrategyBreakdown } from "@/lib/analytics-calculations";
import { formatCurrency } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";

interface Props {
  data: StrategyBreakdown[];
  onSelectStrategy?: (strategy: string) => void;
}

export function StrategyTab({ data, onSelectStrategy }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No strategy data yet. Add a strategy to your trades to see breakdowns.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">P&L by Strategy</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="strategy" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v: number) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }}
                  formatter={(value: number) => [formatCurrency(value), "P&L"]}
                />
                <Bar dataKey="totalPnL" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right"># Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Total P&L</TableHead>
                <TableHead className="text-right">Avg P&L</TableHead>
                <TableHead className="text-right">Profit Factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.strategy}
                  className={cn("cursor-pointer", row.totalPnL > 0 ? "hover:bg-gain/5" : "hover:bg-loss/5")}
                  onClick={() => onSelectStrategy?.(row.strategy)}
                >
                  <TableCell className="font-medium">{row.strategy}</TableCell>
                  <TableCell className="text-right">{row.trades}</TableCell>
                  <TableCell className="text-right">{row.winRate.toFixed(1)}%</TableCell>
                  <TableCell className={cn("text-right font-medium", row.totalPnL > 0 ? "text-gain" : "text-loss")}>
                    {formatCurrency(row.totalPnL)}
                  </TableCell>
                  <TableCell className={cn("text-right", row.avgPnL > 0 ? "text-gain" : "text-loss")}>
                    {formatCurrency(row.avgPnL)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.profitFactor === Infinity ? "∞" : row.profitFactor.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
