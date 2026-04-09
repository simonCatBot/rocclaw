// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { Activity, Cpu, Zap, Thermometer, Gauge, MemoryStick } from "lucide-react";

interface GPUMetric {
  name: string;
  usage: number | null;
  temperature: number | null;
  memory: {
    total: number | null;
    used: number | null;
  };
  vendor?: string;
  gfxVersion?: string;
  computeUnits?: number;
  maxClockMHz?: number;
  power?: number;
  deviceType?: string;
}

interface GpuMetricsPanelProps {
  gpus: GPUMetric[];
}

function formatGB(gb: number | null | undefined): string {
  if (gb === null || gb === undefined) return "N/A";
  return `${gb.toFixed(1)} GB`;
}

function formatMHz(mhz: number | null | undefined): string {
  if (mhz === null || mhz === undefined) return "N/A";
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
  return `${mhz} MHz`;
}

function formatWatts(watts: number | null | undefined): string {
  if (watts === null || watts === undefined) return "N/A";
  return `${watts.toFixed(1)} W`;
}

function formatTemp(temp: number | null | undefined): string {
  if (temp === null || temp === undefined) return "N/A";
  return `${temp}°C`;
}

export function GpuMetricsPanel({ gpus }: GpuMetricsPanelProps) {
  if (!gpus || gpus.length === 0) {
    return (
      <div className="p-4 bg-surface-1 border border-border rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-4 h-4" />
          <span className="text-sm">No additional GPUs detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gpus.map((gpu, index) => (
        <GpuCard key={index} gpu={gpu} index={index} />
      ))}
    </div>
  );
}

function GpuCard({ gpu }: { gpu: GPUMetric; index: number }) {
  const isRocm = gpu.gfxVersion !== undefined;
  const memoryUsagePercent = gpu.memory.total && gpu.memory.used
    ? Math.round((gpu.memory.used / gpu.memory.total) * 100)
    : null;

  return (
    <div className="p-3 bg-surface-1 border border-border rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-primary/20 rounded-md">
          <Activity className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {gpu.name}
            </p>
            {isRocm && (
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                ROCm
              </span>
            )}
          </div>
        </div>
        {gpu.usage !== null && gpu.usage !== undefined && (
          <div className={`text-sm font-bold ${gpu.usage > 80 ? 'text-red-500' : 'text-foreground'}`}>
            {gpu.usage}%
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Usage */}
        {gpu.usage !== null && gpu.usage !== undefined && (
          <StatBox
            icon={Gauge}
            label="Usage"
            value={`${gpu.usage}%`}
            alert={gpu.usage > 80}
          />
        )}

        {/* Temperature */}
        {gpu.temperature !== null && gpu.temperature !== undefined && (
          <StatBox
            icon={Thermometer}
            label="Temp"
            value={formatTemp(gpu.temperature)}
            alert={(gpu.temperature || 0) > 85}
          />
        )}

        {/* VRAM */}
        {gpu.memory.total !== null && gpu.memory.total !== undefined && (
          <StatBox
            icon={MemoryStick}
            label="VRAM"
            value={`${memoryUsagePercent !== null ? memoryUsagePercent + '%' : formatGB(gpu.memory.used)}`}
            subtext={`${formatGB(gpu.memory.used)} / ${formatGB(gpu.memory.total)}`}
            alert={(memoryUsagePercent || 0) > 80}
          />
        )}

        {/* Clock */}
        {gpu.maxClockMHz !== undefined && gpu.maxClockMHz > 0 && (
          <StatBox
            icon={Cpu}
            label="Clock"
            value={formatMHz(gpu.maxClockMHz)}
          />
        )}

        {/* Power */}
        {gpu.power !== undefined && gpu.power > 0 && (
          <StatBox
            icon={Zap}
            label="Power"
            value={formatWatts(gpu.power)}
          />
        )}

        {/* Compute Units */}
        {gpu.computeUnits !== undefined && gpu.computeUnits > 0 && (
          <StatBox
            icon={Cpu}
            label="CUs"
            value={gpu.computeUnits.toString()}
          />
        )}
      </div>

      {/* ROCm Footer */}
      {isRocm && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {gpu.gfxVersion && <span>GFX: {gpu.gfxVersion}</span>}
            {gpu.deviceType && <span>Type: {gpu.deviceType}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatBoxProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  alert?: boolean;
}

function StatBox({ icon: Icon, label, value, subtext, alert }: StatBoxProps) {
  return (
    <div className={`p-2 rounded-md border ${
      alert ? "bg-red-500/10 border-red-500/30" : "bg-surface-2 border-border/50"
    }`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3 h-3 ${alert ? "text-red-500" : "text-muted-foreground"}`} />
        <span className={`text-[10px] uppercase tracking-wider ${
          alert ? "text-red-500" : "text-muted-foreground"
        }`}>
          {label}
        </span>
      </div>
      <p className={`text-sm font-bold ${alert ? "text-red-500" : "text-foreground"}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-[10px] text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}
