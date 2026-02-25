import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useTrades } from "@/hooks/use-api";
import { TradeStats } from "@/components/journal/TradeStats";
import { TradeFormDialog, type TradeFormData } from "@/components/journal/TradeFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, BookOpen, ArrowUpDown, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "symbol" | "entry_time" | "pnl" | "created_at";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export default function Journal() {
  const { trades, loading, createTrade, updateTrade, deleteTrade } = useTrades();

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState<(TradeFormData & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("all");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Unique strategies for filter
  const strategies = useMemo(() => {
    const set = new Set(trades.map((t) => t.strategy).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [trades]);

  // Filtered + sorted trades
  const processedTrades = useMemo(() => {
    let result = [...trades];

    if (filterSymbol) {
      const q = filterSymbol.toUpperCase();
      result = result.filter((t) => t.symbol?.toUpperCase().includes(q));
    }
    if (filterStrategy && filterStrategy !== "all") {
      result = result.filter((t) => t.strategy === filterStrategy);
    }

    result.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "symbol": av = a.symbol ?? ""; bv = b.symbol ?? ""; break;
        case "entry_time": av = a.entry_time ?? ""; bv = b.entry_time ?? ""; break;
        case "pnl": av = a.pnl ?? 0; bv = b.pnl ?? 0; break;
        case "created_at": av = a.created_at ?? ""; bv = b.created_at ?? ""; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [trades, filterSymbol, filterStrategy, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedTrades.length / PAGE_SIZE));
  const pagedTrades = processedTrades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleAdd(data: TradeFormData) {
    createTrade.mutate(data as any, { onSuccess: () => setAddOpen(false) });
  }

  function handleEdit(data: TradeFormData) {
    if (!editData) return;
    updateTrade.mutate({ id: editData.id, ...data } as any, { onSuccess: () => setEditData(null) });
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteTrade.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  }

  // Empty state
  if (!loading && trades.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trade Journal</h1>
            <p className="text-muted-foreground">Review and analyze your trading history</p>
          </div>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No Trades Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Start tracking your performance by adding your first trade.
            </p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Your First Trade
            </Button>
          </CardContent>
        </Card>
        <TradeFormDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleAdd} isPending={createTrade.isPending} mode="add" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-muted-foreground">Review and analyze your trading history</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Trade
        </Button>
      </div>

      {/* Stats */}
      <TradeStats trades={trades} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Filter by symbol..."
          value={filterSymbol}
          onChange={(e) => { setFilterSymbol(e.target.value); setPage(0); }}
          className="sm:max-w-[200px]"
        />
        <Select value={filterStrategy} onValueChange={(v) => { setFilterStrategy(v); setPage(0); }}>
          <SelectTrigger className="sm:max-w-[200px]">
            <SelectValue placeholder="All strategies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All strategies</SelectItem>
            {strategies.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                Symbol <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("entry_time")}>
                Entry Time <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Exit Price</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pnl")}>
                P&L <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead className="cursor-pointer select-none hidden md:table-cell" onClick={() => toggleSort("created_at")}>
                Created <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : pagedTrades.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No trades match filters</TableCell></TableRow>
            ) : (
              pagedTrades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={t.direction === "Long" ? "default" : "secondary"} className={cn("text-xs", t.direction === "Long" ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30" : "bg-red-500/20 text-red-500 hover:bg-red-500/30")}>
                      {t.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{t.entry_time ? format(new Date(t.entry_time), "MMM d, HH:mm") : "—"}</TableCell>
                  <TableCell>${t.entry_price?.toFixed(2) ?? "—"}</TableCell>
                  <TableCell>${t.exit_price?.toFixed(2) ?? "—"}</TableCell>
                  <TableCell className={cn("font-medium", (t.pnl ?? 0) >= 0 ? "text-emerald-500" : "text-red-500")}>
                    ${(t.pnl ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">{t.strategy ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {t.created_at ? format(new Date(t.created_at), "MMM d") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditData({
                        id: t.id,
                        symbol: t.symbol ?? "",
                        direction: t.direction ?? "Long",
                        entry_time: t.entry_time ?? "",
                        entry_price: t.entry_price ?? 0,
                        exit_time: t.exit_time ?? "",
                        exit_price: t.exit_price ?? 0,
                        position_size: t.position_size ?? 0,
                        total_fees: t.total_fees ?? 0,
                        strategy: t.strategy ?? "",
                        tags: (t as any).tags ?? [],
                        emotion: (t as any).emotion ?? "",
                        notes: t.notes ?? "",
                        pnl: t.pnl ?? 0,
                        broker_account_id: t.broker_account_id,
                      })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, processedTrades.length)} of {processedTrades.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TradeFormDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleAdd} isPending={createTrade.isPending} mode="add" />
      <TradeFormDialog
        open={!!editData}
        onOpenChange={(open) => { if (!open) setEditData(null); }}
        onSubmit={handleEdit}
        isPending={updateTrade.isPending}
        initialData={editData ?? undefined}
        mode="edit"
      />
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trade</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
