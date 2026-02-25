import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { DrawdownAnalysis } from "@/lib/analytics-calculations";
import { formatCurrency } from "@/lib/portfolio-calculations";

interface Props {
  analysis: DrawdownAnalysis;
}

export function DrawdownTab({ analysis }: Props) {
  const { points, currentDrawdown, maxDrawdown, maxDrawdownPeriod } = analysis;

  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No drawdown data yet. Add trades to see analysis.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Current Drawdown</p>
            <p className="text-xl font-bold text-loss">{currentDrawdown.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Max Drawdown</p>
            <p className="text-xl font-bold text-loss">{maxDrawdown.toFixed(2)}%</p>
          </CardContent>
        </Card>
        {maxDrawdownPeriod && (
          <>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Max DD Start</p>
                <p className="text-lg font-semibold">{maxDrawdownPeriod.start}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Max DD End</p>
                <p className="text-lg font-semibold">{maxDrawdownPeriod.end}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Balance vs Peak</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--loss))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--loss))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }}
                  formatter={(value: number, name: string) => [name === "peak" ? formatCurrency(value) : formatCurrency(value), name === "peak" ? "Peak" : "Balance"]}
                />
                <Area type="monotone" dataKey="peak" stroke="hsl(var(--muted-foreground))" fill="none" strokeDasharray="5 5" strokeWidth={1.5} />
                <Area type="monotone" dataKey="balance" stroke="hsl(var(--loss))" fill="url(#ddGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Drawdown %</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "Drawdown"]}
                />
                <Area type="monotone" dataKey="drawdown" stroke="hsl(var(--loss))" fill="hsl(var(--loss) / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
