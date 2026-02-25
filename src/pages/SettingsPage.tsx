import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerAccounts } from "@/hooks/use-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { accounts: brokerAccounts, loading: isLoading, createAccount, deleteAccount } = useBrokerAccounts();
  const [brokerName, setBrokerName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and broker connections</p>
      </div>

      {/* Broker Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Broker Accounts</CardTitle>
          <CardDescription>Connect your brokerage accounts to import trades</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAccount.mutate(
                { broker_name: brokerName, account_number: accountNumber },
                { onSuccess: () => { setBrokerName(""); setAccountNumber(""); } }
              );
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="brokerName" className="sr-only">Broker Name</Label>
              <Input id="brokerName" placeholder="Broker name (e.g. TD Ameritrade)" value={brokerName} onChange={(e) => setBrokerName(e.target.value)} required />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="accountNum" className="sr-only">Account Number</Label>
              <Input id="accountNum" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
            </div>
            <Button type="submit" disabled={createAccount.isPending} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : brokerAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broker accounts connected yet.</p>
          ) : (
            <div className="space-y-2">
              {brokerAccounts.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium text-sm">{b.broker_name}</p>
                    <p className="text-xs text-muted-foreground">{b.account_number}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteAccount.mutate(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <Button variant="destructive" onClick={signOut}>Sign Out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
