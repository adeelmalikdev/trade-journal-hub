import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { useBrokerAccounts } from "@/hooks/use-api";

const STRATEGIES = ["Scalping", "Day Trading", "Swing Trading", "Breakout", "Reversal", "Momentum", "Other"];
const EMOTIONS = ["confident", "uncertain", "greedy", "fearful"];

export interface TradeFormData {
  broker_account_id?: string | null;
  symbol: string;
  direction: string;
  entry_time: string;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  position_size: number;
  total_fees: number;
  strategy: string;
  tags: string[];
  emotion: string;
  notes: string;
  pnl: number;
}

interface TradeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TradeFormData) => void;
  isPending: boolean;
  initialData?: Partial<TradeFormData> & { id?: string };
  mode: "add" | "edit";
}

export function TradeFormDialog({ open, onOpenChange, onSubmit, isPending, initialData, mode }: TradeFormDialogProps) {
  const { accounts } = useBrokerAccounts();

  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("Long");
  const [entryDate, setEntryDate] = useState<Date | undefined>();
  const [entryTime, setEntryTime] = useState("09:30");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitDate, setExitDate] = useState<Date | undefined>();
  const [exitTime, setExitTime] = useState("16:00");
  const [exitPrice, setExitPrice] = useState("");
  const [positionSize, setPositionSize] = useState("");
  const [fees, setFees] = useState("0");
  const [strategy, setStrategy] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [emotion, setEmotion] = useState("");
  const [notes, setNotes] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill on edit
  useEffect(() => {
    if (initialData && open) {
      setSymbol(initialData.symbol ?? "");
      setDirection(initialData.direction ?? "Long");
      if (initialData.entry_time) {
        const d = new Date(initialData.entry_time);
        setEntryDate(d);
        setEntryTime(format(d, "HH:mm"));
      }
      setEntryPrice(initialData.entry_price?.toString() ?? "");
      if (initialData.exit_time) {
        const d = new Date(initialData.exit_time);
        setExitDate(d);
        setExitTime(format(d, "HH:mm"));
      }
      setExitPrice(initialData.exit_price?.toString() ?? "");
      setPositionSize(initialData.position_size?.toString() ?? "");
      setFees(initialData.total_fees?.toString() ?? "0");
      setStrategy(initialData.strategy ?? "");
      setTagsInput((initialData.tags ?? []).join(", "));
      setEmotion(initialData.emotion ?? "");
      setNotes(initialData.notes ?? "");
      setBrokerId(initialData.broker_account_id ?? "");
    } else if (!open) {
      // reset on close
      setSymbol(""); setDirection("Long"); setEntryDate(undefined); setEntryTime("09:30");
      setEntryPrice(""); setExitDate(undefined); setExitTime("16:00"); setExitPrice("");
      setPositionSize(""); setFees("0"); setStrategy(""); setTagsInput("");
      setEmotion(""); setNotes(""); setBrokerId(""); setErrors({});
    }
  }, [initialData, open]);

  // Auto-calc P&L
  const pnl = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const ps = parseFloat(positionSize);
    const f = parseFloat(fees) || 0;
    if (isNaN(ep) || isNaN(xp) || isNaN(ps)) return null;
    const multiplier = direction === "Short" ? -1 : 1;
    return (xp - ep) * ps * multiplier - f;
  }, [entryPrice, exitPrice, positionSize, fees, direction]);

  const pnlPercent = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const ps = parseFloat(positionSize);
    if (pnl === null || isNaN(ep) || isNaN(ps) || ep * ps === 0) return null;
    return (pnl / (ep * ps)) * 100;
  }, [pnl, entryPrice, positionSize]);

  function buildEntryTimestamp(): Date | null {
    if (!entryDate) return null;
    const [h, m] = entryTime.split(":").map(Number);
    const d = new Date(entryDate);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function buildExitTimestamp(): Date | null {
    if (!exitDate) return null;
    const [h, m] = exitTime.split(":").map(Number);
    const d = new Date(exitDate);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!symbol.trim()) errs.symbol = "Required";
    if (!entryPrice || parseFloat(entryPrice) <= 0) errs.entryPrice = "Must be > 0";
    if (!exitPrice || parseFloat(exitPrice) <= 0) errs.exitPrice = "Must be > 0";
    if (!positionSize || parseFloat(positionSize) <= 0) errs.positionSize = "Must be > 0";
    if (!entryDate) errs.entryDate = "Required";
    if (!exitDate) errs.exitDate = "Required";
    const et = buildEntryTimestamp();
    const xt = buildExitTimestamp();
    if (et && xt && xt <= et) errs.exitDate = "Must be after entry";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({
      broker_account_id: brokerId || null,
      symbol: symbol.trim().toUpperCase(),
      direction,
      entry_time: buildEntryTimestamp()!.toISOString(),
      entry_price: parseFloat(entryPrice),
      exit_time: buildExitTimestamp()!.toISOString(),
      exit_price: parseFloat(exitPrice),
      position_size: parseFloat(positionSize),
      total_fees: parseFloat(fees) || 0,
      strategy,
      tags,
      emotion,
      notes,
      pnl: pnl ?? 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Trade" : "Edit Trade"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Broker */}
          {accounts.length > 0 && (
            <div className="space-y-1">
              <Label>Broker Account</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger><SelectValue placeholder="Select broker (optional)" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.broker_name} – {a.account_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Symbol + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Symbol *</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" disabled={mode === "edit"} />
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol}</p>}
            </div>
            <div className="space-y-1">
              <Label>Direction *</Label>
              <div className="flex gap-2 pt-1">
                {["Long", "Short"].map((d) => (
                  <Button key={d} type="button" size="sm" variant={direction === d ? "default" : "outline"} onClick={() => setDirection(d)} className="flex-1">
                    {d}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Entry date/time + price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Entry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !entryDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {entryDate ? format(entryDate, "PP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={entryDate} onSelect={setEntryDate} className="p-3 pointer-events-auto" disabled={mode === "edit"} />
                </PopoverContent>
              </Popover>
              {errors.entryDate && <p className="text-xs text-destructive">{errors.entryDate}</p>}
            </div>
            <div className="space-y-1">
              <Label>Entry Time</Label>
              <Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} disabled={mode === "edit"} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Entry Price *</Label>
            <Input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" />
            {errors.entryPrice && <p className="text-xs text-destructive">{errors.entryPrice}</p>}
          </div>

          {/* Exit date/time + price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Exit Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !exitDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exitDate ? format(exitDate, "PP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={exitDate} onSelect={setExitDate} className="p-3 pointer-events-auto" disabled={mode === "edit"} />
                </PopoverContent>
              </Popover>
              {errors.exitDate && <p className="text-xs text-destructive">{errors.exitDate}</p>}
            </div>
            <div className="space-y-1">
              <Label>Exit Time</Label>
              <Input type="time" value={exitTime} onChange={(e) => setExitTime(e.target.value)} disabled={mode === "edit"} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Exit Price *</Label>
            <Input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="0.00" />
            {errors.exitPrice && <p className="text-xs text-destructive">{errors.exitPrice}</p>}
          </div>

          {/* Position size + fees */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Position Size *</Label>
              <Input type="number" step="any" value={positionSize} onChange={(e) => setPositionSize(e.target.value)} placeholder="100" />
              {errors.positionSize && <p className="text-xs text-destructive">{errors.positionSize}</p>}
            </div>
            <div className="space-y-1">
              <Label>Fees</Label>
              <Input type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* P&L preview */}
          {pnl !== null && (
            <div className={cn("rounded-md p-3 text-sm font-medium", pnl >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
              P&L: ${pnl.toFixed(2)} {pnlPercent !== null && `(${pnlPercent.toFixed(2)}%)`}
            </div>
          )}

          {/* Strategy + Emotion */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Strategy</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Emotion</Label>
              <Select value={emotion} onValueChange={setEmotion}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <Label>Tags</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="earnings, gap-up, pre-market" />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trade notes..." rows={3} />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving..." : mode === "add" ? "Add Trade" : "Update Trade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
