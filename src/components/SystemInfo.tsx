"use client";

import { useEffect, useState, useCallback } from "react";
import { Cpu, MemoryStick, HardDrive, Activity, Server } from "lucide-react";

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

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  usage: number;
  detail: string;
  color: string;
}

function MetricCard({ icon, title, usage, detail, color }: MetricCardProps) {
  return (
    <div className="glass-panel ui-panel p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`${color}`}>{icon}</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{usage}%</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
      <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            usage > 80 ? "bg-red-500" : usage > 60 ? "bg-yellow-500" : color.replace("text-", "bg-")
          }`}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SystemInfoPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/system/metrics?includeBasicGpu=true");
      const result = await response.json();
      if (result.success) {
        setMetrics(result.data);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch metrics");
      }
    } catch {
      setError("Network error fetching metrics");
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (!metrics && !error) {
    return (
      <div className="glass-panel ui-panel p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-xs">Loading system info...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel ui-panel p-3">
        <div className="flex items-center gap-2 text-red-500">
          <Activity className="w-4 h-4" />
          <span className="text-xs">{error}</span>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const formatGB = (gb: number) => `${gb.toFixed(1)} GB`;
  const formatTemp = (temp: number | null) =>
    temp !== null ? `${temp}°C` : "N/A";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Server className="w-4 h-4" />
          <span className="uppercase tracking-wider">System Info</span>
          <span className="text-[10px] opacity-60">
            {metrics.hostname} • {metrics.platform}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <MetricCard
            icon={<Cpu className="w-4 h-4" />}
            title="CPU"
            usage={metrics.cpu.usage}
            detail={`${metrics.cpu.cores} cores • ${formatTemp(metrics.cpu.temperature)}`}
            color="text-blue-500"
          />
          <MetricCard
            icon={<MemoryStick className="w-4 h-4" />}
            title="RAM"
            usage={metrics.memory.usage}
            detail={`${formatGB(metrics.memory.used)} / ${formatGB(metrics.memory.total)}`}
            color="text-green-500"
          />
          <MetricCard
            icon={<HardDrive className="w-4 h-4" />}
            title="Disk"
            usage={metrics.disk.usage}
            detail={`${formatGB(metrics.disk.used)} / ${formatGB(metrics.disk.total)}`}
            color="text-purple-500"
          />
          {metrics.gpu.length > 0 ? (
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
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
          ) : (
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              title="GPU"
              usage={0}
              detail="No GPU detected"
              color="text-gray-500"
            />
          )}
        </div>
      )}

      {!isExpanded && (
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            {metrics.cpu.usage}%
          </span>
          <span className="flex items-center gap-1">
            <MemoryStick className="w-3 h-3" />
            {metrics.memory.usage}%
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {metrics.disk.usage}%
          </span>
          {metrics.gpu.length > 0 && metrics.gpu[0]?.usage !== null && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              GPU {metrics.gpu[0].usage}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
