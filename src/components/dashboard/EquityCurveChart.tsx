import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, subDays, isAfter } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Trade = Tables<"trades">;

const chartConfig: ChartConfig = {
  balance: { label: "Balance", color: "hsl(var(--primary))" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function EquityCurveChart({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  const data = useMemo(() => {
    const cutoff = subDays(new Date(), 90);
    const sorted = [...trades]
      .filter((t) => t.pnl !== null && t.exit_time)
      .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

    let cumulative = 0;
    const points: { date: string; balance: number }[] = [];
    for (const t of sorted) {
      cumulative += t.pnl ?? 0;
      const d = new Date(t.exit_time!);
      if (isAfter(d, cutoff)) {
        points.push({ date: format(d, "MMM dd"), balance: cumulative });
      }
    }
    return points;
  }, [trades]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Equity Curve</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle>Equity Curve</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          Need at least 2 closed trades to display the equity curve.
        </CardContent>
      </Card>
    );
  }

  const balances = data.map((d) => d.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Equity Curve (Last 90 Days)</CardTitle>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Min: {fmt(min)}</span>
          <span>Max: {fmt(max)}</span>
          <span>Current: {fmt(balances[balances.length - 1])}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="balance"
              type="monotone"
              fill="url(#fillBalance)"
              stroke="var(--color-balance)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
