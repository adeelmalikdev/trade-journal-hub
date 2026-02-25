import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Unplug, Loader2, CheckCircle2, XCircle, X, AlertTriangle, Clock, BarChart3, TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import type { BrokerAccount, SyncLog } from "@/hooks/use-broker-accounts";
import { useSyncLogs, useBrokerAccountsFull } from "@/hooks/use-broker-accounts";
import { useAccountSummary, type AccountSummaryData } from "@/hooks/use-account-summary";

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

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${color || ""}`} />
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${color || ""}`}>{value}</p>
    </div>
  );
}

function AccountSummaryView({ data }: { data: AccountSummaryData }) {
  const { account, analytics, open_positions, trade_history } = data;
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <Tabs defaultValue="overview" className="space-y-3">
      <TabsList className="grid w-full grid-cols-3 h-8">
        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
        <TabsTrigger value="positions" className="text-xs">Positions</TabsTrigger>
        <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-3 mt-0">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Balance" value={`${account.currency} ${fmt(account.balance)}`} icon={DollarSign} />
          <MetricCard label="Equity" value={`${account.currency} ${fmt(account.equity)}`} icon={DollarSign} />
          <MetricCard label="Margin" value={`${account.currency} ${fmt(account.margin)}`} icon={Activity} />
          <MetricCard label="Free Margin" value={`${account.currency} ${fmt(account.free_margin)}`} icon={Activity} />
          <MetricCard label="Leverage" value={`1:${account.leverage}`} icon={TrendingUp} />
          {account.margin_level != null && (
            <MetricCard label="Margin Level" value={pct(account.margin_level)} icon={BarChart3} />
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Server: {account.server} • Platform: {account.platform}</p>
          <p>Generated: {format(new Date(data.generated_at), "MMM d, h:mm:ss a")}</p>
        </div>
      </TabsContent>

      <TabsContent value="positions" className="space-y-2 mt-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{open_positions.count} open position{open_positions.count !== 1 ? "s" : ""}</span>
          <span className={open_positions.total_floating_pnl >= 0 ? "text-gain font-medium" : "text-loss font-medium"}>
            Floating: {fmt(open_positions.total_floating_pnl)}
          </span>
        </div>
        {open_positions.positions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No open positions</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {open_positions.positions.map((pos) => (
              <div key={pos.id} className="rounded-md border border-border px-3 py-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={pos.type === "Buy" ? "default" : "secondary"} className="text-[9px] px-1.5 py-0">
                      {pos.type}
                    </Badge>
                    <span className="font-medium">{pos.symbol}</span>
                    <span className="text-muted-foreground">{pos.volume} lots</span>
                  </div>
                  <span className={pos.floating_pnl >= 0 ? "text-gain font-medium" : "text-loss font-medium"}>
                    {pos.floating_pnl >= 0 ? "+" : ""}{fmt(pos.floating_pnl)}
                  </span>
                </div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>Entry: {pos.entry_price}</span>
                  <span>Current: {pos.current_price}</span>
                  {pos.stop_loss && <span>SL: {pos.stop_loss}</span>}
                  {pos.take_profit && <span>TP: {pos.take_profit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="analytics" className="space-y-3 mt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{analytics.totalTrades} trades analyzed</span>
          <span>{trade_history.period.from.slice(0, 10)} → {trade_history.period.to.slice(0, 10)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Net P&L" value={fmt(analytics.netPnL)} icon={DollarSign}
            color={analytics.netPnL >= 0 ? "text-gain" : "text-loss"} />
          <MetricCard label="Win Rate" value={pct(analytics.winRate)} icon={TrendingUp}
            color={analytics.winRate >= 50 ? "text-gain" : "text-loss"} />
          <MetricCard label="Profit Factor" value={analytics.profitFactor.toFixed(2)} icon={BarChart3}
            color={analytics.profitFactor >= 1 ? "text-gain" : "text-loss"} />
          <MetricCard label="Max Drawdown" value={fmt(analytics.maxDrawdown)} icon={TrendingDown} color="text-loss" />
          <MetricCard label="Avg Win" value={fmt(analytics.avgWin)} icon={TrendingUp} color="text-gain" />
          <MetricCard label="Avg Loss" value={fmt(analytics.avgLoss)} icon={TrendingDown} color="text-loss" />
          <MetricCard label="Largest Win" value={fmt(analytics.largestWin)} icon={TrendingUp} color="text-gain" />
          <MetricCard label="Largest Loss" value={fmt(analytics.largestLoss)} icon={TrendingDown} color="text-loss" />
          <MetricCard label="Risk:Reward" value={analytics.riskRewardRatio.toFixed(2)} icon={Activity} />
          <MetricCard label="Avg Trade" value={fmt(analytics.avgTradePnL)} icon={DollarSign}
            color={analytics.avgTradePnL >= 0 ? "text-gain" : "text-loss"} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md border border-border p-2">
            <p className="text-gain font-semibold">{analytics.winningTrades}</p>
            <p className="text-muted-foreground">Wins</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-loss font-semibold">{analytics.losingTrades}</p>
            <p className="text-muted-foreground">Losses</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="font-semibold">{analytics.breakEvenTrades}</p>
            <p className="text-muted-foreground">Break Even</p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function BrokerDetailsPanel({ account, isSyncing, onSync, onClose }: Props) {
  const { disconnectAccount, updateAccount, toggleAutoSync } = useBrokerAccountsFull();
  const { data: syncLogs = [], isLoading: logsLoading } = useSyncLogs(account.id);
  const { data: summaryData, loading: summaryLoading, fetchSummary } = useAccountSummary();
  const [symbolFilter, setSymbolFilter] = useState("");
  const isConnected = account.connection_status === "connected";
  const isAutoSync = account.auto_sync_enabled ?? true;
  const hasMeta = !!(account as any).meta_api_account_id;

  const handleFreqChange = (val: string) => {
    const freq = parseInt(val);
    const nextSync = new Date(Date.now() + freq * 60_000).toISOString();
    updateAccount.mutate({ id: account.id, sync_frequency: freq, next_sync_at: nextSync } as any);
  };

  const handleFetchSummary = () => {
    fetchSummary({
      broker_account_id: account.id,
      symbol: symbolFilter || undefined,
    });
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

        {/* Account Summary Section */}
        {hasMeta && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Summary</h4>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Filter by symbol (optional)"
                  value={symbolFilter}
                  onChange={(e) => setSymbolFilter(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleFetchSummary}
                  disabled={summaryLoading || account.connection_status === "disconnected"}
                >
                  {summaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                  <span className="ml-1">Fetch</span>
                </Button>
              </div>
              {summaryData && <AccountSummaryView data={summaryData} />}
            </div>
            <Separator />
          </>
        )}

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
