import { useState } from "react";
import { useBrokerAccountsFull } from "@/hooks/use-broker-accounts";
import { AddBrokerDialog } from "@/components/broker/AddBrokerDialog";
import { BrokerAccountCard } from "@/components/broker/BrokerAccountCard";
import { BrokerDetailsPanel } from "@/components/broker/BrokerDetailsPanel";
import { Cable } from "lucide-react";

export default function BrokerAccountsPage() {
  const { accounts, loading, syncAccount } = useBrokerAccountsFull();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? null;

  const handleSync = (id: string) => {
    setSyncingId(id);
    syncAccount.mutate(id, { onSettled: () => setSyncingId(null) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Broker Accounts</h1>
          <p className="text-muted-foreground">Manage your broker connections and sync settings</p>
        </div>
        <AddBrokerDialog />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading accounts...</p>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Cable className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No broker accounts</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
            Connect your first broker account to start syncing trades automatically.
          </p>
          <AddBrokerDialog />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => (
              <BrokerAccountCard
                key={account.id}
                account={account}
                isSyncing={syncingId === account.id}
                onSync={() => handleSync(account.id)}
                onSelect={() => setSelectedId(account.id)}
              />
            ))}
          </div>

          {selectedAccount && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <BrokerDetailsPanel
                account={selectedAccount}
                isSyncing={syncingId === selectedAccount.id}
                onSync={() => handleSync(selectedAccount.id)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
