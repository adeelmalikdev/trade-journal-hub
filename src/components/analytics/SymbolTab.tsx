import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SymbolBreakdown } from "@/lib/analytics-calculations";
import { formatCurrency } from "@/lib/portfolio-calculations";
import { cn } from "@/lib/utils";

interface Props {
  data: SymbolBreakdown[];
  onSelectSymbol?: (symbol: string) => void;
}

export function SymbolTab({ data, onSelectSymbol }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No symbol data yet.
        </CardContent>
      </Card>
    );
  }

  const topProfit = data.filter((s) => s.totalPnL > 0).slice(0, 10);
  const topLoss = [...data].filter((s) => s.totalPnL < 0).sort((a, b) => a.totalPnL - b.totalPnL).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm text-gain">Top 10 by Profit</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topProfit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No profitable symbols yet</p>
            ) : (
              topProfit.map((s) => (
                <div key={s.symbol} className="flex items-center justify-between rounded border p-2 cursor-pointer hover:bg-muted/50" onClick={() => onSelectSymbol?.(s.symbol)}>
                  <span className="text-sm font-medium">{s.symbol}</span>
                  <span className="text-sm font-semibold text-gain">{formatCurrency(s.totalPnL)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-loss">Top 10 by Loss</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topLoss.length === 0 ? (
              <p className="text-sm text-muted-foreground">No losing symbols yet</p>
            ) : (
              topLoss.map((s) => (
                <div key={s.symbol} className="flex items-center justify-between rounded border p-2 cursor-pointer hover:bg-muted/50" onClick={() => onSelectSymbol?.(s.symbol)}>
                  <span className="text-sm font-medium">{s.symbol}</span>
                  <span className="text-sm font-semibold text-loss">{formatCurrency(s.totalPnL)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right"># Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Total P&L</TableHead>
                <TableHead className="text-right">Best</TableHead>
                <TableHead className="text-right">Worst</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.symbol} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectSymbol?.(row.symbol)}>
                  <TableCell className="font-medium">{row.symbol}</TableCell>
                  <TableCell className="text-right">{row.trades}</TableCell>
                  <TableCell className="text-right">{row.winRate.toFixed(1)}%</TableCell>
                  <TableCell className={cn("text-right font-medium", row.totalPnL > 0 ? "text-gain" : "text-loss")}>
                    {formatCurrency(row.totalPnL)}
                  </TableCell>
                  <TableCell className="text-right text-gain">{formatCurrency(row.bestTrade)}</TableCell>
                  <TableCell className="text-right text-loss">{formatCurrency(row.worstTrade)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
