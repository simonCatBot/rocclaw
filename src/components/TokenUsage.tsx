"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, AlertCircle } from "lucide-react";

interface TokenMetrics {
  todayTokens: number;
  todayCost: number;
  sessionTokens: number;
  sessionCost: number;
  totalCost: number;
  byAgent: {
    agentName: string;
    tokens: number;
    cost: number;
  }[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function TokenUsage() {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenMetrics = useCallback(async () => {
    try {
      const mockData: TokenMetrics = {
        todayTokens: 681347,
        todayCost: 0.78,
        sessionTokens: 134575,
        sessionCost: 0.15,
        totalCost: 4.87,
        byAgent: [
          { agentName: "Developer", tokens: 892341, cost: 1.52 },
          { agentName: "Social", tokens: 672109, cost: 1.18 },
          { agentName: "Work", tokens: 1283841, cost: 2.17 }
        ],
      };
      
      setMetrics(mockData);
      setError(null);
    } catch (err) {
      setError("Failed to load token metrics");
    }
  }, []);

  useEffect(() => {
    fetchTokenMetrics();
    const interval = setInterval(fetchTokenMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchTokenMetrics]);

  if (!metrics && !error) {
    return (
      <div className="ui-panel p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Coins className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-panel p-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const dailyBudget = 10.00;
  const budgetUsed = (metrics.todayCost / dailyBudget) * 100;

  return (
    <div className="ui-panel ui-depth-workspace p-4 space-y-4">
      { /* Header */ }
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Coins className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Token Usage</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Est. {formatCost(metrics.totalCost)}
        </span>
      </div>

      { /* Summary */ }
      <div className="grid grid-cols-2 gap-2">
        <div className="ui-panel p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(metrics.todayTokens)}</p>
          <p className="text-xs text-muted-foreground">{formatCost(metrics.todayCost)}</p>
        </div>
        
        <div className="ui-panel p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Session</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(metrics.sessionTokens)}</p>
          <p className="text-xs text-muted-foreground">{formatCost(metrics.sessionCost)}</p>
        </div>
      </div>

      { /* Budget */ }
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Daily Budget</span>
          <span className={budgetUsed > 80 ? "text-red-500 font-medium" : "text-muted-foreground"}>
            {budgetUsed.toFixed(0)}% used
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetUsed > 80 ? "bg-red-500" : budgetUsed > 50 ? "bg-yellow-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(budgetUsed, 100)}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground">
          {formatCost(metrics.todayCost)} / {formatCost(dailyBudget)}
        </div>
      </div>

      { /* By Agent */ }
      <div className="space-y-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          By Agent
        </h3>
        {metrics.byAgent.map((agent) => (
          <div key={agent.agentName} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
              <span className="text-foreground">{agent.agentName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">
                {formatNumber(agent.tokens)}
              </span>
              <span className="text-[10px] font-medium text-foreground w-12 text-right">
                {formatCost(agent.cost)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
