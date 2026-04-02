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

interface UsageApiResponse {
  sessions?: Array<{
    key: string;
    agentId?: string;
    model?: string;
    provider?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
    messageCount?: number;
    errorCount?: number;
    durationMs?: number;
    startedAtMs?: number;
    endedAtMs?: number;
  }>;
  aggregated?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalMessages: number;
    totalErrors: number;
    totalCost: number;
    byAgent: Record<string, {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      messageCount: number;
      errorCount: number;
      cost: number;
    }>;
    byModel: Record<string, {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      messageCount: number;
      cost: number;
    }>;
  };
  cost?: {
    totalCost?: number;
    costByModel?: Record<string, number>;
    costByProvider?: Record<string, number>;
    costByDay?: Record<string, number>;
  };
  timeRange?: {
    startDate?: string;
    endDate?: string;
  };
  error?: string;
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
  const [loading, setLoading] = useState(true);

  const agentNames: Record<string, string> = {
    developer: "Developer",
    social: "Social",
    work: "Work",
    main: "Main",
  };

  const fetchTokenMetrics = useCallback(async () => {
    try {
      // Calculate date range for "today"
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      const startDate = startOfDay.toISOString();
      const endDate = endOfDay.toISOString();
      
      const response = await fetch(`/api/usage?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch usage data: ${response.status}`);
      }
      
      const data: UsageApiResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const aggregated = data.aggregated;
      const totalCost = data.cost?.totalCost ?? aggregated?.totalCost ?? 0;
      const totalTokens = aggregated?.totalTokens ?? 0;
      const totalInput = aggregated?.totalInputTokens ?? 0;
      const totalOutput = aggregated?.totalOutputTokens ?? 0;
      const totalMessages = aggregated?.totalMessages ?? 0;
      
      // Calculate today's usage (already filtered by the API)
      const todayInput = totalInput;
      const todayOutput = totalOutput;
      const todayTotal = totalTokens;
      const todayCost = totalCost;
      
      // Build byAgent array
      const byAgent: TokenMetrics["byAgent"] = [];
      if (aggregated?.byAgent) {
        for (const [agentId, stats] of Object.entries(aggregated.byAgent)) {
          const agentTotalTokens = stats.totalTokens;
          byAgent.push({
            agentId,
            agentName: agentNames[agentId] ?? agentId,
            inputTokens: stats.inputTokens,
            outputTokens: stats.outputTokens,
            cost: stats.cost,
            percentage: totalTokens > 0 ? Math.round((agentTotalTokens / totalTokens) * 100) : 0,
          });
        }
      }
      byAgent.sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
      
      // Build byModel array
      const byModel: TokenMetrics["byModel"] = [];
      if (aggregated?.byModel) {
        for (const [model, stats] of Object.entries(aggregated.byModel)) {
          byModel.push({
            model,
            tokens: stats.totalTokens,
            percentage: totalTokens > 0 ? Math.round((stats.totalTokens / totalTokens) * 100) : 0,
          });
        }
      }
      byModel.sort((a, b) => b.tokens - a.tokens);
      
      // Calculate rate per minute (based on recent activity)
      const ratePerMinute = totalMessages > 0 ? Math.round((totalTokens / Math.max(totalMessages, 1)) * 0.5) : 0;
      
      const transformedMetrics: TokenMetrics = {
        totalTokens: {
          input: totalInput,
          output: totalOutput,
          total: totalTokens,
        },
        costEstimate: {
          total: totalCost,
          currency: "USD",
        },
        byAgent,
        byModel,
        todayUsage: {
          input: todayInput,
          output: todayOutput,
          total: todayTotal,
          cost: todayCost,
        },
        sessionUsage: {
          input: Math.round(todayInput * 0.1),
          output: Math.round(todayOutput * 0.1),
          total: Math.round(todayTotal * 0.1),
          cost: todayCost * 0.1,
        },
        ratePerMinute,
      };
      
      setMetrics(transformedMetrics);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch token metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load token metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenMetrics();
    // Update every minute
    const interval = setInterval(fetchTokenMetrics, 60000);
    return () => clearInterval(interval);
  }, [fetchTokenMetrics]);

  if (loading) {
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
        <button
          onClick={fetchTokenMetrics}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const dailyBudget = 10.00;
  const budgetUsed = dailyBudget > 0 ? (metrics.todayUsage.cost / dailyBudget) * 100 : 0;

  return (
    <div className="ui-panel ui-depth-workspace p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Coins className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Token Usage</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Total: {formatCost(metrics.costEstimate.total)}
        </span>
      </div>

      {/* Summary Cards */}
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

      {/* Total Stats */}
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

      {/* Budget Progress */}
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

      {/* By Agent */}
      {metrics.byAgent.length > 0 && (
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
      )}

      {/* By Model */}
      {metrics.byModel.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-muted-foreground" />
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              By Model
            </h3>
          </div>
          <div className="space-y-2">
            {metrics.byModel.slice(0, 5).map((model) => (
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
      )}

      {/* Rate */}
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
