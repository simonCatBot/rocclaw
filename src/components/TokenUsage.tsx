"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, AlertCircle, TrendingUp, Users, Cpu } from "lucide-react";

interface TokenMetrics {
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  costEstimate: {
    total: number;
    currency: string;
  };
  byAgent: {
    agentId: string;
    agentName: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    percentage: number;
  }[];
  byModel: {
    model: string;
    tokens: number;
    percentage: number;
  }[];
  todayUsage: {
    input: number;
    output: number;
    total: number;
    cost: number;
  };
  sessionUsage: {
    input: number;
    output: number;
    total: number;
    cost: number;
  };
  ratePerMinute: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(4)}`;
}

export function TokenUsage() {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenMetrics = useCallback(async () => {
    try {
      // Mock data - in production this would come from an API
      const mockData: TokenMetrics = {
        totalTokens: {
          input: 2847291,
          output: 1458293,
          total: 4305584
        },
        costEstimate: {
          total: 4.87,
          currency: "USD"
        },
        byAgent: [
          { agentId: "developer", agentName: "Developer", inputTokens: 892341, outputTokens: 452891, cost: 1.52, percentage: 35 },
          { agentId: "social", agentName: "Social", inputTokens: 672109, outputTokens: 321456, cost: 1.18, percentage: 28 },
          { agentId: "work", agentName: "Work", inputTokens: 1283841, outputTokens: 683946, cost: 2.17, percentage: 37 }
        ],
        byModel: [
          { model: "kimi-k2.5", tokens: 2150292, percentage: 50 },
          { model: "deepseek-coder", tokens: 1290175, percentage: 30 },
          { model: "qwen2.5", tokens: 645088, percentage: 15 },
          { model: "others", tokens: 215029, percentage: 5 }
        ],
        todayUsage: {
          input: 452891,
          output: 228456,
          total: 681347,
          cost: 0.78
        },
        sessionUsage: {
          input: 89341,
          output: 45234,
          total: 134575,
          cost: 0.15
        },
        ratePerMinute: 1250
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
  const budgetUsed = (metrics.todayUsage.cost / dailyBudget) * 100;

  return (
    <div className="ui-panel ui-depth-workspace p-4 space-y-4">
      { /* Header */ }
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Coins className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Token Usage</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Total: {formatCost(metrics.costEstimate.total)}
        </span>
      </div>

      { /* Summary Cards */ }
      <div className="grid grid-cols-2 gap-2">
        <div className="ui-panel p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(metrics.todayUsage.total)}</p>
          <p className="text-xs text-muted-foreground">{formatCost(metrics.todayUsage.cost)} • {formatNumber(metrics.todayUsage.input)} in / {formatNumber(metrics.todayUsage.output)} out</p>
        </div>
        
        <div className="ui-panel p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Session</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(metrics.sessionUsage.total)}</p>
          <p className="text-xs text-muted-foreground">{formatCost(metrics.sessionUsage.cost)} • {formatNumber(metrics.sessionUsage.input)} in / {formatNumber(metrics.sessionUsage.output)} out</p>
        </div>
      </div>

      { /* Total Stats */ }
      <div className="ui-panel p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">All Time</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatNumber(metrics.totalTokens.total)}</p>
            <p className="text-xs text-muted-foreground">{formatNumber(metrics.totalTokens.input)} in / {formatNumber(metrics.totalTokens.output)} out</p>
          </div>
        </div>
      </div>

      { /* Budget Progress */ }
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Daily Budget</span>
          <span className={budgetUsed > 80 ? "text-red-500 font-medium" : "text-muted-foreground"}>
            {budgetUsed.toFixed(0)}% used
          </span>
        </div>
        <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetUsed > 80 ? "bg-red-500" : budgetUsed > 50 ? "bg-yellow-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(budgetUsed, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatCost(metrics.todayUsage.cost)}</span>
          <span>{formatCost(dailyBudget)}</span>
        </div>
      </div>

      { /* By Agent */ }
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-muted-foreground" />
          <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            By Agent
          </h3>
        </div>
        <div className="space-y-1">
          {metrics.byAgent.map((agent) => (
            <div key={agent.agentId} className="flex items-center justify-between p-2 rounded-lg bg-surface-1/50">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: agent.agentId === 'developer' ? '#3b82f6' : 
                                   agent.agentId === 'social' ? '#22c55e' : '#f59e0b' 
                  }}
                />
                <span className="text-sm text-foreground">{agent.agentName}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-[10px] text-muted-foreground">
                  {formatNumber(agent.inputTokens + agent.outputTokens)}
                </span>
                <span className="text-xs font-medium text-foreground w-14">
                  {formatCost(agent.cost)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      { /* By Model */ }
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            By Model
          </h3>
        </div>
        <div className="space-y-2">
          {metrics.byModel.map((model) => (
            <div key={model.model} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground capitalize">{model.model}</span>
                <span className="text-foreground font-medium">{model.percentage}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all duration-500"
                  style={{ width: `${model.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      { /* Rate */ }
      <div className="pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Rate</span>
          <span className="text-foreground font-medium font-mono">
            {formatNumber(metrics.ratePerMinute)}/min
          </span>
        </div>
      </div>
    </div>
  );
}
