"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Activity, 
  Server, 
  Clock
} from "lucide-react";
import { TokenUsage } from "./TokenUsage";

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number | null;
    speed: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  gpu: {
    usage: number | null;
    temperature: number | null;
    memory: {
      total: number | null;
      used: number | null;
    };
  }[];
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  uptime: number;
  hostname: string;
  platform: string;
}

interface MetricsHistory {
  timestamps: string[];
  cpu: number[];
  memory: number[];
}

function LineChart({ data, color, height = 25 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} className="bg-surface-2/50 rounded" />;
  
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <div style={{ height }} className="relative overflow-hidden">
      <svg 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none" 
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill={`url(#gradient-${color})`}
          stroke={color}
          strokeWidth="2"
          points={points}
          className="drop-shadow-sm"
        />
      </svg>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, 
  title, 
  usage, 
  detail, 
  color,
  history,
  unit = "%"
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string; 
  usage: number; 
  detail: string; 
  color: string;
  history?: number[];
  unit?: string;
}) {
  return (
    <div className="ui-panel p-2 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-3 h-3 ${color}`} />
          <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
        </div>
        <span className="text-base font-bold text-foreground">
          {Math.round(usage)}{unit}
        </span>
      </div>
      
      {history && (
        <div className="h-[25px]">
          <LineChart data={history} color="currentColor" />
        </div>
      )}
      
      <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            usage > 80 ? "bg-red-500" : usage > 60 ? "bg-yellow-500" : color.replace("text-", "bg-")
          }`}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      
      <span className="text-[9px] text-muted-foreground">{detail}</span>
    </div>
  );
}

export function SystemDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MetricsHistory>({
    timestamps: [],
    cpu: [],
    memory: [],
  });
  const historyRef = useRef<MetricsHistory>({
    timestamps: [],
    cpu: [],
    memory: [],
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/system/metrics");
      const result = await response.json();
      if (result.success) {
        setMetrics(result.data);
        setError(null);
        
        const now = new Date().toLocaleTimeString("en-US", { 
          hour12: false, 
          hour: "2-digit", 
          minute: "2-digit",
          second: "2-digit"
        });
        
        historyRef.current = {
          timestamps: [...historyRef.current.timestamps.slice(-20), now],
          cpu: [...historyRef.current.cpu.slice(-20), result.data.cpu.usage],
          memory: [...historyRef.current.memory.slice(-20), result.data.memory.usage],
        };
        setHistory(historyRef.current);
      } else {
        setError(result.error || "Failed to fetch metrics");
      }
    } catch (err) {
      setError("Network error fetching metrics");
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (!metrics && !error) {
    return (
      <div className="ui-panel p-4 h-full overflow-y-auto">
        <TokenUsage />
        
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Loading system metrics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-panel p-4 h-full overflow-y-auto">
        <TokenUsage />
        
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-red-500">
            <Activity className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const formatGB = (gb: number) => `${gb.toFixed(1)} GB`;
  const formatTemp = (temp: number | null) =>
    temp !== null ? `${temp}°C` : "N/A";

  return (
    <div className="ui-panel ui-depth-workspace p-4 h-full overflow-y-auto">
      {/* Token Usage Section - At Top */}
      <TokenUsage />

      {/* System Metrics Section - At Bottom */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
          <Server className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">System Metrics</h2>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {metrics.hostname}
          </span>
        </div>

        <div className="space-y-2">
          <MetricCard
            icon={Cpu}
            title="CPU"
            usage={metrics.cpu.usage}
            detail={`${metrics.cpu.cores} cores • ${formatTemp(metrics.cpu.temperature)}`}
            color="text-blue-500"
            history={history.cpu}
          />

          <MetricCard
            icon={MemoryStick}
            title="RAM"
            usage={metrics.memory.usage}
            detail={`${formatGB(metrics.memory.used)} / ${formatGB(metrics.memory.total)}`}
            color="text-green-500"
            history={history.memory}
          />

          <MetricCard
            icon={HardDrive}
            title="Disk"
            usage={metrics.disk.usage}
            detail={`${formatGB(metrics.disk.used)} / ${formatGB(metrics.disk.total)}`}
            color="text-purple-500"
          />

          {metrics.gpu.length > 0 && metrics.gpu[0]?.usage !== null && (
            <MetricCard
              icon={Activity}
              title="GPU"
              usage={metrics.gpu[0]?.usage ?? 0}
              detail={
                metrics.gpu[0]?.memory.total
                  ? `${formatGB(metrics.gpu[0].memory.used ?? 0)} / ${formatGB(
                      metrics.gpu[0].memory.total
                    )}`
                  : formatTemp(metrics.gpu[0]?.temperature ?? null)
              }
              color="text-orange-500"
            />
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Platform: {metrics.platform}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
