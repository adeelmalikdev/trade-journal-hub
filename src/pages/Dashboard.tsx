import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, Wallet } from "lucide-react";

const stats = [
  { title: "Total Trades", value: "0", icon: TrendingUp, description: "All time" },
  { title: "Win Rate", value: "—", icon: Target, description: "No trades yet" },
  { title: "Total P&L", value: "$0.00", icon: DollarSign, description: "All time" },
  { title: "Account Balance", value: "—", icon: Wallet, description: "Connect a broker" },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.email}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Get Started</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Connect a broker account in Settings or start adding trades to your journal to see your performance metrics here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
