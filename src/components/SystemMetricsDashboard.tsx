"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Activity, 
  Server, 
  Clock,
  Wifi,
  Zap
} from "lucide-react";

interface SystemMetrics {
  cpu: {
    name: string;
    usage: number;
    cores: number;
    temperature: number | null;
    speed: number;
    loadAvg: [number, number, number];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    swapTotal: number;
    swapUsed: number;
    swapFree: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  gpu: {
    name: string;
    usage: number | null;
    temperature: number | null;
    memory: {
      total: number | null;
      used: number | null;
    };
  }[];
  network: {
    rxSec: number;
    txSec: number;
    rxTotal: number;
    txTotal: number;
  };
  processes: {
    running: number;
    blocked: number;
    sleeping: number;
    total: number;
  };
  uptime: number;
  hostname: string;
  platform: string;
}

function MetricRow({ 
  icon: Icon, 
  label, 
  value, 
  subtext,
  alert 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string;
  value: string; 
  subtext: string;
  alert?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      alert ? "bg-red-500/10 border-red-500/30" : "bg-surface-1 border-border"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md ${alert ? "bg-red-500/20" : "bg-surface-2"}`}>
          <Icon className={`w-4 h-4 ${alert ? "text-red-500" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${alert ? "text-red-500" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground font-mono">{value}</span>
    </div>
  );
}

export function SystemMetricsDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/system/metrics");
      const result = await response.json();
      if (result.success) {
        setMetrics(result.data);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch metrics");
      }
    } catch (err) {
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
      <div className="ui-panel ui-depth-workspace p-4 h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-panel ui-depth-workspace p-4 h-full">
        <div className="flex items-center gap-2 text-red-500">
          <Activity className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const formatGB = (gb: number) => `${gb.toFixed(1)} GB`;
  const formatTemp = (temp: number | null) => temp !== null ? `${temp}°C` : "N/A";
  const formatSpeed = (kbps: number) => kbps > 1024 ? `${(kbps/1024).toFixed(1)} MB/s` : `${kbps} KB/s`;

  return (
    <div className="ui-panel ui-depth-workspace p-4 h-full overflow-y-auto">
      { /* Header */ }
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
        <Server className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">System Metrics</h2>
        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {Math.floor(metrics.uptime / 3600)}h {Math.floor((metrics.uptime % 3600) / 60)}m
        </span>
      </div>

      { /* Processor Info - Prominent Display */ }
      <div className="mb-4 p-4 bg-surface-1 border border-border rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/20 rounded-md">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Processor</p>
            <p className="text-sm font-semibold text-foreground">{metrics.cpu.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{metrics.cpu.cores} Cores</span>
          <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
          <span>{Math.round(metrics.cpu.speed)} MHz</span>
          <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
          <span>Load: {metrics.cpu.loadAvg[0].toFixed(2)}</span>
        </div>
      </div>

      { /* Main Metrics */ }
      <div className="space-y-2">
        <MetricRow
          icon={Cpu}
          label="CPU Usage"
          value={`${Math.round(metrics.cpu.usage)}%`}
          subtext={`${metrics.cpu.cores} cores • Load: ${metrics.cpu.loadAvg[0].toFixed(2)} • ${formatTemp(metrics.cpu.temperature)}`}
          alert={metrics.cpu.usage > 80}
        />

        <MetricRow
          icon={MemoryStick}
          label="Memory"
          value={`${Math.round(metrics.memory.usage)}%`}
          subtext={`${formatGB(metrics.memory.used)} / ${formatGB(metrics.memory.total)} • Swap: ${formatGB(metrics.memory.swapUsed)}`}
          alert={metrics.memory.usage > 80}
        />

        <MetricRow
          icon={HardDrive}
          label="Disk"
          value={`${Math.round(metrics.disk.usage)}%`}
          subtext={`${formatGB(metrics.disk.used)} / ${formatGB(metrics.disk.total)}`}
          alert={metrics.disk.usage > 80}
        />

        <MetricRow
          icon={Wifi}
          label="Network"
          value={`${formatSpeed(metrics.network.rxSec + metrics.network.txSec)}`}
          subtext={`↓ ${formatSpeed(metrics.network.rxSec)} / ↑ ${formatSpeed(metrics.network.txSec)} • Total: ${formatGB(metrics.network.rxTotal + metrics.network.txTotal)}`}
        />

        {metrics.gpu.length > 0 && metrics.gpu[0]?.usage !== null && (
          <MetricRow
            icon={Activity}
            label="GPU"
            name={truncateName(metrics.gpu[0].name)}
            value={`${Math.round(metrics.gpu[0].usage || 0)}%`}
            subtext={metrics.gpu[0]?.memory.used ? 
              `${formatGB(metrics.gpu[0].memory.used)} / ${formatGB(metrics.gpu[0].memory.total || 0)} • ${formatTemp(metrics.gpu[0]?.temperature)}` :
              formatTemp(metrics.gpu[0]?.temperature)
            }
            alert={(metrics.gpu[0].usage || 0) > 80}
          />
        )}
      </div>

      { /* Processes */ }
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3 h-3 text-muted-foreground" />
          <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Processes
          </h3>
        </div>
        <div className="ui-panel p-3">
          <InfoRow label="Running" value={metrics.processes.running.toString()} />
          <InfoRow label="Sleeping" value={metrics.processes.sleeping.toString()} />
          <InfoRow label="Blocked" value={metrics.processes.blocked.toString()} />
          <InfoRow label="Total" value={metrics.processes.total.toString()} />
        </div>
      </div>

      { /* System Info */ }
      <div className="mt-4 pt-4 border-t border-border">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          System Info
        </h3>
        <div className="ui-panel p-3">
          <InfoRow label="Hostname" value={metrics.hostname} />
          <InfoRow label="Platform" value={metrics.platform} />
          <InfoRow label="CPU Cores" value={`${metrics.cpu.cores}`} />
        </div>
      </div>
    </div>
  );
}
