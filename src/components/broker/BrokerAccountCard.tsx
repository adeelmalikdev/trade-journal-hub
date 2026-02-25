import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Eye, Loader2, Zap, ZapOff } from "lucide-react";
import type { BrokerAccount } from "@/hooks/use-broker-accounts";

interface Props {
  account: BrokerAccount;
  isSyncing: boolean;
  onSync: () => void;
  onSelect: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-gain",
  syncing: "bg-primary animate-pulse",
  error: "bg-destructive",
  retry_pending: "bg-yellow-500",
  disconnected: "bg-muted-foreground",
};

export function BrokerAccountCard({ account, isSyncing, onSync, onSelect }: Props) {
  const maskedAcct = "..." + account.account_number.slice(-4);
  const dotColor = STATUS_COLORS[account.connection_status] ?? "bg-muted-foreground";
  const isAutoSync = account.auto_sync_enabled ?? true;

  return (
    <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{account.broker_name}</h3>
              <Badge variant={account.account_type === "demo" ? "secondary" : "default"} className="text-[10px] px-1.5 py-0 capitalize">
                {account.account_type}
              </Badge>
              {isAutoSync ? (
                <Zap className="h-3 w-3 text-gain" />
              ) : (
                <ZapOff className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{maskedAcct}</p>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              <span className="text-xs text-muted-foreground capitalize">{account.connection_status}</span>
            </div>
            {account.last_sync_at && (
              <p className="text-[11px] text-muted-foreground">
                Last sync: {formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true })}
              </p>
            )}
            {account.last_sync_error && (
              <p className="text-[11px] text-destructive truncate" title={account.last_sync_error}>
                Error: {account.last_sync_error}
              </p>
            )}
            {account.balance != null && (
              <p className="text-xs font-medium">${Number(account.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onSync(); }} disabled={isSyncing || account.connection_status === "disconnected"}>
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
