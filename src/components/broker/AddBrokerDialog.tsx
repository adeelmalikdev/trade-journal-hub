import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldCheck, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useBrokerAccountsFull } from "@/hooks/use-broker-accounts";

const BROKERS = [
  "MetaTrader 5 (MT5)",
  "Interactive Brokers",
  "NinjaTrader",
  "Tradovate",
  "TradingView",
  "TD Ameritrade",
  "Other",
];

export function AddBrokerDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const { createAccount } = useBrokerAccountsFull();

  const [broker, setBroker] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountType, setAccountType] = useState("live");

  const reset = () => {
    setStep(1);
    setBroker("");
    setAccountNumber("");
    setApiKey("");
    setApiSecret("");
    setAccountType("live");
  };

  const canProceedStep1 = broker.length > 0;
  const canProceedStep2 = accountNumber.length > 0 && apiKey.length > 0 && apiSecret.length > 0;

  const handleConnect = () => {
    createAccount.mutate(
      { broker_name: broker, account_number: accountNumber, api_key: apiKey, api_secret: apiSecret, account_type: accountType },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      }
    );
  };

  const maskStr = (s: string) => (s.length <= 4 ? "****" : s.slice(0, 3) + "****..." + s.slice(-3));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Add Broker
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Broker Account</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                step >= s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Broker */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Broker</Label>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger><SelectValue placeholder="Choose your broker..." /></SelectTrigger>
                <SelectContent>
                  {BROKERS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Enter Credentials */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accNum">Account Number</Label>
              <Input id="accNum" placeholder="e.g. 12345678" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key / Login</Label>
              <Input id="apiKey" type="password" placeholder="Enter API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret / Password</Label>
              <Input id="apiSecret" type="password" placeholder="Enter API secret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <RadioGroup value={accountType} onValueChange={setAccountType} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="live" id="live" />
                  <Label htmlFor="live" className="cursor-pointer">Live</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="demo" id="demo" />
                  <Label htmlFor="demo" className="cursor-pointer">Demo</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Connect */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Broker</span><span className="font-medium">{broker}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="font-medium">...{accountNumber.slice(-4)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{accountType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">API Key</span><span className="font-mono text-xs">{maskStr(apiKey)}</span></div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Your API credentials are encrypted and stored securely. We never store plaintext passwords.</span>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleConnect} disabled={createAccount.isPending}>
                {createAccount.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Connect
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
