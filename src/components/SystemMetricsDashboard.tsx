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
  Video,
  Gauge,
  Thermometer,
  Zap,
  BrainCircuit,
  AlertTriangle
} from "lucide-react";
import { GpuMetricsPanel } from "./GpuMetricsPanel";

interface SystemMetrics {
  cpu: {
    name: string;
    usage: number;
    cores: number;
    temperature: number | null;
    speed: number;
    loadAvg: [number, number, number];
    coreLoads: number[];
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
    // ROCm-specific fields
    vendor?: string;
    gfxVersion?: string;
    computeUnits?: number;
    maxClockMHz?: number;
    power?: number;
    deviceType?: string;
    // Extended ROCm info
    deviceId?: string;
    driverVersion?: string;
    vbiosVersion?: string;
    deviceRev?: string;
    subsystemId?: string;
    guid?: string;
    pciBus?: string;
    currentClockMHz?: number;
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

function ProminentCard({ 
  icon: Icon, 
  title, 
  name,
  subtitle,
  badge,
  children 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string;
  name: string;
  subtitle: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 p-4 bg-surface-1 border border-border rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 bg-primary/20 rounded-md">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          </div>
        </div>
        {badge && (
          <div className="ml-2">{badge}</div>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {subtitle}
      </div>
      {children}
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
  const formatMHz = (mhz: number | null | undefined) => {
    if (mhz === null || mhz === undefined) return "N/A";
    if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
    return `${mhz} MHz`;
  };

  // Extract processor company + product line (e.g. "AMD Ryzen", "Intel Core", "Intel Xeon")
  const getProcessorLabel = (name: string) => {
    const parts = name.split(" ");
    // AMD Ryzen / AMD EPYC / Intel Core / Intel Xeon / Apple Silicon
    if (parts[0] === "AMD" && parts[1]) return `${parts[0]} ${parts[1]}`;
    if (parts[0] === "Intel" && parts[1]) return `${parts[0]} ${parts[1]}`;
    return parts[0];
  };
  const getTrainingStatus = (gpu: typeof primaryGpu) => {
    if (!gpu || gpu.usage === null || gpu.memory?.used === null) return null;
    const highUtil = gpu.usage > 70;
    const highVram = gpu.memory.total && (gpu.memory.used / gpu.memory.total) > 0.6;
    if (highUtil && highVram) return { label: "Inference", color: "text-green-500", icon: BrainCircuit, bg: "bg-green-500/20" };
    if (highUtil) return { label: "Computing", color: "text-blue-500", icon: Activity, bg: "bg-blue-500/20" };
    if (gpu.usage > 10) return { label: "Active", color: "text-yellow-500", icon: Zap, bg: "bg-yellow-500/20" };
    return { label: "Idle", color: "text-muted-foreground", icon: Clock, bg: "bg-surface-2" };
  };

  const getVramStatus = (used: number | null | undefined, total: number | null | undefined) => {
    if (!used || !total) return { percent: 0, status: "unknown", color: "text-muted-foreground" };
    const percent = Math.round((used / total) * 100);
    if (percent > 95) return { percent, status: "CRITICAL", color: "text-red-500", bgColor: "bg-red-500" };
    if (percent > 85) return { percent, status: "WARNING", color: "text-orange-500", bgColor: "bg-orange-500" };
    if (percent > 70) return { percent, status: "ELEVATED", color: "text-yellow-500", bgColor: "bg-yellow-500" };
    return { percent, status: "OK", color: "text-green-500", bgColor: "bg-green-500" };
  };

  const primaryGpu = metrics.gpu.length > 0 ? metrics.gpu[0] : null;

  return (
    <div className="ui-panel ui-depth-workspace p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
        <Server className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">System Metrics</h2>
        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {Math.floor(metrics.uptime / 3600)}h {Math.floor((metrics.uptime % 3600) / 60)}m
        </span>
      </div>

      {/* CPU Card - Prominent Display */}
      <ProminentCard
        icon={Cpu}
        title="Processor"
        name={metrics.cpu.name}
        subtitle={
          <>
            <span>{getProcessorLabel(metrics.cpu.name)}</span>
            <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
            <span>{metrics.cpu.cores} Cores</span>
            {metrics.cpu.speed > 0 && (
              <>
                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                <span>{Math.round(metrics.cpu.speed)} MHz</span>
              </>
            )}
          </>
        }
      >
        <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
          {/* CPU Usage Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">CPU Usage</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-surface-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    metrics.cpu.usage > 80 ? 'bg-red-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(metrics.cpu.usage, 100)}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${metrics.cpu.usage > 80 ? 'text-red-500' : 'text-foreground'}`}>
                {Math.round(metrics.cpu.usage)}%
              </span>
            </div>
          </div>

          {/* CPU Frequency Details */}
          {metrics.cpu.speed > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{metrics.cpu.cores} Cores</span>
              <span>{Math.round(metrics.cpu.speed)} MHz</span>
            </div>
          )}

          {/* CPU Stats Row */}
          <div className="flex flex-wrap gap-4 pt-1">
            {metrics.cpu.temperature !== null && metrics.cpu.temperature > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Thermometer className="w-3 h-3" />
                <span>{formatTemp(metrics.cpu.temperature)}</span>
              </div>
            )}
            {metrics.cpu.speed > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>{Math.round(metrics.cpu.speed)} MHz</span>
              </div>
            )}
            {metrics.cpu.loadAvg[0] > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="w-3 h-3" />
                <span>Load: {metrics.cpu.loadAvg[0].toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* CPU Stats Row — mirrors GPU layout */}
          <div className="flex flex-wrap gap-4 pt-1">
            {metrics.cpu.temperature !== null && metrics.cpu.temperature > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Thermometer className="w-3 h-3" />
                <span>{formatTemp(metrics.cpu.temperature)}</span>
              </div>
            )}
            {metrics.cpu.speed > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>{Math.round(metrics.cpu.speed)} MHz</span>
              </div>
            )}
            {metrics.cpu.loadAvg[0] > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="w-3 h-3" />
                <span>Load: {metrics.cpu.loadAvg[0].toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Per-Core Load Grid */}
          {metrics.cpu.coreLoads.length > 0 && (
            <div className="pt-2 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                Per-Core Usage
              </p>
              <div className="grid grid-cols-4 gap-2">
                {metrics.cpu.coreLoads.map((load, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>C{i}</span>
                      <span className={load > 80 ? 'text-red-500 font-bold' : ''}>{load}%</span>
                    </div>
                    <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          load > 80 ? 'bg-red-500' : load > 50 ? 'bg-yellow-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(load, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ProminentCard>

      {/* System Memory - positioned between CPU and GPU */}
      <MetricRow
        icon={MemoryStick}
        label="System Memory"
        value={`${Math.round(metrics.memory.usage)}%`}
        subtext={`${formatGB(metrics.memory.used)} / ${formatGB(metrics.memory.total)} • Swap: ${formatGB(metrics.memory.swapUsed)}`}
        alert={metrics.memory.usage > 80}
      />

      {/* GPU Card - Prominent Display (if available) */}
      {primaryGpu && (
        <ProminentCard
          icon={Video}
          title="Graphics Processor"
          name={primaryGpu.name}
          subtitle={
            <>
              <span>{primaryGpu.vendor || "AMD"}</span>
              {primaryGpu.gfxVersion && (
                <>
                  <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                  <span className="font-mono">{primaryGpu.gfxVersion}</span>
                </>
              )}
              {primaryGpu.computeUnits !== undefined && primaryGpu.computeUnits > 0 && (
                <>
                  <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                  <span>{primaryGpu.computeUnits} CUs</span>
                </>
              )}
            </>
          }
          badge={(() => {
            const status = getTrainingStatus(primaryGpu);
            if (!status) return null;
            const StatusIcon = status.icon;
            return (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg} border border-border/50`}>
                <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
              </div>
            );
          })()}
        >
          {/* GPU Usage Bar */}
          <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
            {primaryGpu.usage !== null && primaryGpu.usage !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">GPU Usage</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        primaryGpu.usage > 80 ? 'bg-red-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(primaryGpu.usage, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${primaryGpu.usage > 80 ? 'text-red-500' : 'text-foreground'}`}>
                    {primaryGpu.usage}%
                  </span>
                </div>
              </div>
            )}

            {/* VRAM Usage Bar with ML-specific warnings */}
            {primaryGpu.memory.total !== null && primaryGpu.memory.total !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">VRAM</span>
                  {(() => {
                    const vramStatus = getVramStatus(primaryGpu.memory.used, primaryGpu.memory.total);
                    if (vramStatus.status === "CRITICAL") {
                      return <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />;
                    }
                    return null;
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const vramStatus = getVramStatus(primaryGpu.memory.used, primaryGpu.memory.total);
                    return (
                      <>
                        <div className="w-32 h-2 bg-surface-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${vramStatus.bgColor}`}
                            style={{ width: `${Math.min(vramStatus.percent, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${vramStatus.color}`}>
                          {vramStatus.percent}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* VRAM Details - ML Focus */}
            {primaryGpu.memory.total !== null && primaryGpu.memory.total !== undefined && (
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Used: {formatGB(primaryGpu.memory.used || 0)}</span>
                <span>Total: {formatGB(primaryGpu.memory.total)}</span>
                {(() => {
                  const vramStatus = getVramStatus(primaryGpu.memory.used, primaryGpu.memory.total);
                  if (vramStatus.status !== "OK") {
                    return <span className={vramStatus.color}>{vramStatus.status}</span>;
                  }
                  return null;
                })()}
              </div>
            )}

            {/* GPU Stats Row — temperature alongside frequency, then power */}
            <div className="flex flex-wrap gap-4 pt-2">
              {(primaryGpu.temperature !== null && primaryGpu.temperature !== undefined && primaryGpu.temperature > 0) ||
               (primaryGpu.currentClockMHz !== undefined && primaryGpu.currentClockMHz > 0) ? (
                <div className="flex items-center gap-3">
                  {primaryGpu.temperature !== null && primaryGpu.temperature !== undefined && primaryGpu.temperature > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Thermometer className="w-3 h-3" />
                      <span>{formatTemp(primaryGpu.temperature)}</span>
                    </div>
                  )}
                  {primaryGpu.currentClockMHz !== undefined && primaryGpu.currentClockMHz > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3" />
                      <span>{formatMHz(primaryGpu.currentClockMHz)}</span>
                    </div>
                  )}
                </div>
              ) : null}
              {primaryGpu.power !== undefined && primaryGpu.power > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Activity className="w-3 h-3" />
                  <span>{primaryGpu.power.toFixed(1)}W</span>
                </div>
              )}
            </div>

            {/* GPU Hardware Details */}
            {(primaryGpu.deviceId || primaryGpu.driverVersion || primaryGpu.vbiosVersion) && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  Hardware Details
                </p>
                <div className="space-y-1 text-xs">
                  {primaryGpu.deviceId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device ID:</span>
                      <span className="font-mono text-foreground">{primaryGpu.deviceId}</span>
                    </div>
                  )}
                  {primaryGpu.driverVersion && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Driver:</span>
                      <span className="font-mono text-foreground">{primaryGpu.driverVersion}</span>
                    </div>
                  )}
                  {primaryGpu.vbiosVersion && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VBIOS:</span>
                      <span className="font-mono text-foreground">{primaryGpu.vbiosVersion}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ProminentCard>
      )}

      {/* Main Metrics List */}
      <div className="space-y-2">
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
      </div>

      {/* GPU Details Section - Additional GPUs */}
      {metrics.gpu.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Video className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Additional GPUs
            </h3>
          </div>
          <GpuMetricsPanel gpus={metrics.gpu.slice(1)} />
        </div>
      )}
    </div>
  );
}
