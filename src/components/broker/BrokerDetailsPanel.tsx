import { formatDistanceToNow, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Unplug, Loader2, CheckCircle2, XCircle, X, AlertTriangle, Clock } from "lucide-react";
import type { BrokerAccount, SyncLog } from "@/hooks/use-broker-accounts";
import { useSyncLogs, useBrokerAccountsFull } from "@/hooks/use-broker-accounts";

interface Props {
  account: BrokerAccount;
  isSyncing: boolean;
  onSync: () => void;
  onClose: () => void;
}

const FREQ_OPTIONS = [
  { label: "5 min", value: "5" },
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "60 min", value: "60" },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return <Badge variant="outline" className="text-gain border-gain/30 text-[10px]">Connected</Badge>;
    case "syncing":
      return <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">Syncing...</Badge>;
    case "error":
      return <Badge variant="destructive" className="text-[10px]">Error</Badge>;
    case "retry_pending":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-[10px]">Retry Pending</Badge>;
    case "disconnected":
      return <Badge variant="secondary" className="text-[10px]">Disconnected</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px] capitalize">{status}</Badge>;
  }
}

export function BrokerDetailsPanel({ account, isSyncing, onSync, onClose }: Props) {
  const { disconnectAccount, updateAccount, toggleAutoSync } = useBrokerAccountsFull();
  const { data: syncLogs = [], isLoading: logsLoading } = useSyncLogs(account.id);
  const isConnected = account.connection_status === "connected";
  const isAutoSync = account.auto_sync_enabled ?? true;

  const handleFreqChange = (val: string) => {
    const freq = parseInt(val);
    const nextSync = new Date(Date.now() + freq * 60_000).toISOString();
    updateAccount.mutate({ id: account.id, sync_frequency: freq, next_sync_at: nextSync } as any);
  };

  const nextSyncLabel = (() => {
    if (!isAutoSync) return "Auto-sync disabled";
    if (!account.next_sync_at) return "Pending";
    const nextDate = new Date(account.next_sync_at);
    if (nextDate <= new Date()) return "Due now";
    return formatDistanceToNow(nextDate, { addSuffix: true });
  })();

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{account.broker_name}</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Account</span>
            <p className="font-mono">...{account.account_number.slice(-4)}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Type</span>
            <p className="capitalize">{account.account_type}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Status</span>
            <StatusBadge status={account.connection_status} />
          </div>
          <div>
            <span className="text-muted-foreground text-xs">API Key</span>
            <p className="font-mono text-xs">{account.api_key_masked ?? "N/A"}</p>
          </div>
          {account.last_sync_at && (
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs">Last Sync</span>
              <p>{format(new Date(account.last_sync_at), "MMM d, yyyy h:mm a")}</p>
            </div>
          )}
          {account.balance != null && (
            <div>
              <span className="text-muted-foreground text-xs">Balance</span>
              <p className="font-medium">${Number(account.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>

        {/* Error display */}
        {account.last_sync_error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">Sync Error</p>
              <p className="text-muted-foreground mt-0.5">{account.last_sync_error}</p>
              {(account.retry_count ?? 0) > 0 && (
                <p className="text-muted-foreground mt-1">Retry {account.retry_count}/3</p>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Auto-sync</Label>
            <p className="text-xs text-muted-foreground">Automatically sync trades on schedule</p>
          </div>
          <Switch
            checked={isAutoSync}
            onCheckedChange={(checked) => toggleAutoSync.mutate({ id: account.id, enabled: checked })}
            disabled={!isConnected && account.connection_status !== "error"}
          />
        </div>

        {/* Sync settings */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Sync Frequency</Label>
            <Select value={String(account.sync_frequency)} onValueChange={handleFreqChange}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQ_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Next sync: {nextSyncLabel}</span>
          </div>
          <Button variant="outline" className="w-full" onClick={onSync} disabled={isSyncing || account.connection_status === "disconnected"}>
            {isSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Manual Sync
          </Button>
        </div>

        <Separator />

        {/* Sync logs */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Syncs</h4>
          {logsLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : syncLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sync history yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {syncLogs.map((log: SyncLog) => (
                <div key={log.id} className="flex items-center justify-between text-xs rounded-md border border-border px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-gain" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span>{log.trades_synced} trades</span>
                  </div>
                  <span className="text-muted-foreground">{format(new Date(log.synced_at), "MMM d, h:mm a")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Disconnect */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={account.connection_status === "disconnected"}>
              <Unplug className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Broker?</AlertDialogTitle>
              <AlertDialogDescription>
                This will stop syncing trades from {account.broker_name}. Your existing trades will not be deleted. You can reconnect later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { disconnectAccount.mutate(account.id); onClose(); }}>
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
