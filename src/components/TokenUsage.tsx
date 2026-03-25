"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Coins, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  AlertCircle
} from "lucide-react";

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
  }[];
  byModel: {
    model: string;
    tokens: number;
    percentage: number;
  }[];
  todayUsage: {
    input: number;
    output: number;
    cost: number;
  };
  sessionUsage: {
    input: number;
    output: number;
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

interface MetricCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  alert?: boolean;
}

function MetricCard({ label, value, subtext, icon, trend, alert }: MetricCardProps) {
  return (
    <div className={`ui-panel p-3 relative overflow-hidden ${alert ? "border-amber-500/50" : ""}`}>
      {alert && (
        <div className="absolute top-2 right-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {trend && (
          trend === "up" ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : trend === "down" ? (
            <TrendingDown className="w-4 h-4 text-green-500" />
          ) : null
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">{subtext}</span>
    </div>
  );
}

export function TokenUsage() {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTokenMetrics = useCallback(async () => {
    try {
      // For now, generate realistic mock data
      // In production, this would fetch from /api/tokens/metrics or similar
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
          { agentId: "developer", agentName: "Developer", inputTokens: 892341, outputTokens: 452891, cost: 1.52 },
          { agentId: "social", agentName: "Social", inputTokens: 672109, outputTokens: 321456, cost: 1.18 },
          { agentId: "work", agentName: "Work", inputTokens: 1283841, outputTokens: 683946, cost: 2.17 }
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
          cost: 0.78
        },
        sessionUsage: {
          input: 89341,
          output: 45234,
          cost: 0.15
        },
        ratePerMinute: 1250
      };
      
      setMetrics(mockData);
      setError(null);
    } catch (err) {
      setError("Failed to load token metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenMetrics();
    const interval = setInterval(fetchTokenMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchTokenMetrics]);

  if (loading) {
    return (
      <div className="ui-panel p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Coins className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading token usage...</span>
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

  const dailyBudget = 10.00; // Configurable daily budget
  const budgetUsedPercent = (metrics.todayUsage.cost / dailyBudget) * 100;

  return (
    <div className="ui-panel ui-depth-workspace p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Coins className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Token Usage</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Est. {formatCost(metrics.costEstimate.total)} {metrics.costEstimate.currency}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Today"
          value={formatNumber(metrics.todayUsage.input + metrics.todayUsage.output)}
          subtext={`${formatCost(metrics.todayUsage.cost)} spent`}
          icon={<TrendingUp className="w-3 h-3 text-primary" />}
          trend="up"
          alert={budgetUsedPercent > 80}
        />
        <MetricCard
          label="Session"
          value={formatNumber(metrics.sessionUsage.input + metrics.sessionUsage.output)}
          subtext={`${formatCost(metrics.sessionUsage.cost)} spent`}
          icon={<BarChart3 className="w-3 h-3 text-primary" />}
        />
      </div>

      {/* Budget Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Daily Budget</span>
          <span className={budgetUsedPercent > 80 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
            {budgetUsedPercent.toFixed(0)}% used
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetUsedPercent > 80 ? "bg-amber-500" : budgetUsedPercent > 50 ? "bg-yellow-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground">
          {formatCost(metrics.todayUsage.cost)} / {formatCost(dailyBudget)}
        </div>
      </div>

      {/* Per-Agent Breakdown */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          By Agent
        </h3>
        {metrics.byAgent.map((agent) => (
          <div key={agent.agentId} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
              <span className="text-foreground">{agent.agentName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">
                {formatNumber(agent.inputTokens + agent.outputTokens)}
              </span>
              <span className="text-[10px] font-medium text-foreground w-12 text-right">
                {formatCost(agent.cost)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Model Distribution */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          By Model
        </h3>
        <div className="space-y-1.5">
          {metrics.byModel.map((model) => (
            <div key={model.model} className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground capitalize">{model.model}</span>
                <span className="text-foreground">{model.percentage}%</span>
              </div>
              <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full"
                  style={{ width: `${model.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Indicator */}
      <div className="pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Current Rate</span>
          <span className="text-foreground font-medium">
            {formatNumber(metrics.ratePerMinute)}/min
          </span>
        </div>
      </div>
    </div>
  );
}
