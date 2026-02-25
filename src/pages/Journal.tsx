import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Journal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trade Journal</h1>
        <p className="text-muted-foreground">Review and analyze your trading history</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No Trades Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Your trade journal is empty. Import trades from your broker or add them manually to start tracking your performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
