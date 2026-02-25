import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ImportResult {
  success: boolean;
  imported?: number;
  duplicates_skipped?: number;
  errors?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CSVImportDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  function reset() {
    setFile(null);
    setResult(null);
    setImporting(false);
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const csvText = await file.text();
      const { data, error } = await supabase.functions.invoke("trade-sync/import-csv", {
        body: { csv: csvText },
      });

      if (error) throw error;

      const res = data as ImportResult;
      setResult(res);

      if (res.success || (res.imported && res.imported > 0)) {
        toast({
          title: `Imported ${res.imported} trade${res.imported === 1 ? "" : "s"}`,
          description: res.duplicates_skipped
            ? `${res.duplicates_skipped} duplicates skipped`
            : undefined,
        });
        qc.invalidateQueries({ queryKey: ["trades"] });
      } else {
        toast({
          title: "Import failed",
          description: res.errors?.[0] ?? "Unknown error",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Import error",
        description: e.message ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Trades from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your trades. Required columns: symbol, direction, entry_time, entry_price, position_size.
            Optional: exit_time, exit_price, fees, pnl, strategy, broker_trade_id.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select a CSV file
                </p>
              </>
            )}
          </div>

          {/* Sample format */}
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium mb-1">Expected CSV format:</p>
            <code className="text-[10px] text-muted-foreground block whitespace-pre leading-relaxed">
              symbol,direction,entry_time,entry_price,exit_time,exit_price,position_size,fees{"\n"}
              AAPL,long,2024-02-25 09:30,185.50,2024-02-25 14:45,188.75,100,5.00
            </code>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded-md p-3 text-sm ${
                result.success
                  ? "bg-gain/10 text-gain"
                  : "bg-loss/10 text-loss"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {result.success ? "Import complete" : "Import had errors"}
                </span>
              </div>
              {result.imported != null && (
                <p className="text-xs">Imported: {result.imported}</p>
              )}
              {result.duplicates_skipped != null && result.duplicates_skipped > 0 && (
                <p className="text-xs">
                  Duplicates skipped: {result.duplicates_skipped}
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-1 max-h-24 overflow-auto">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs">{e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-xs">...and {result.errors.length - 5} more errors</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import Trades
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
