import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { HourBreakdown } from "@/lib/analytics-calculations";
import { formatCurrency } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";

interface Props {
  data: HourBreakdown[];
}

export function TimeTab({ data }: Props) {
  const active = data.filter((h) => h.trades > 0);

  if (active.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No time data yet. Add trades with entry times to see hourly analysis.
        </CardContent>
      </Card>
    );
  }

  const maxTrades = Math.max(...data.map((h) => h.trades));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">P&L by Hour</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={active} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
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

      {/* Heat Map */}
      <Card>
        <CardHeader><CardTitle className="text-base">Trading Hour Heat Map</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
            {data.map((h) => {
              const intensity = maxTrades > 0 ? h.trades / maxTrades : 0;
              const isProfit = h.totalPnL > 0;
              return (
                <div
                  key={h.hour}
                  className="rounded-sm p-2 text-center text-[10px] border"
                  style={{
                    backgroundColor: h.trades === 0
                      ? "hsl(var(--muted))"
                      : isProfit
                      ? `hsl(var(--gain) / ${0.15 + intensity * 0.55})`
                      : `hsl(var(--loss) / ${0.15 + intensity * 0.55})`,
                  }}
                  title={`${h.label}: ${h.trades} trades, ${formatCurrency(h.totalPnL)}`}
                >
                  <span className="font-medium">{h.hour}</span>
                  {h.trades > 0 && <p className="text-[9px]">{h.trades}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hour</TableHead>
                <TableHead className="text-right"># Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Total P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((row) => (
                <TableRow key={row.hour}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">{row.trades}</TableCell>
                  <TableCell className="text-right">{row.winRate.toFixed(1)}%</TableCell>
                  <TableCell className={cn("text-right font-medium", row.totalPnL > 0 ? "text-gain" : "text-loss")}>
                    {formatCurrency(row.totalPnL)}
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
