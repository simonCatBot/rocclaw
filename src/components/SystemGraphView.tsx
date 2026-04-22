// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  Cpu,
  MemoryStick,
  Video,
  Activity,
  Thermometer,
  Gauge,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────

interface MetricsSample {
  timestamp: number;
  cpu: number;
  cpuTemp: number | null;
  cpuSpeedMHz: number;
  memory: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  gpu: number | null;
  gpuTemp: number | null;
  gpuVram: number | null;
  gpuVramUsedGB: number | null;
  gpuVramTotalGB: number | null;
  gpuPower: number | null;
  gpuClockMHz: number | null;
}

type TimeRange = "5m" | "10m" | "30m";

const TIME_RANGE_SAMPLES: Record<TimeRange, number> = {
  "5m": 60,
  "10m": 120,
  "30m": 360,
};

const MAX_SAMPLES = 360; // 30 min at 5s intervals
const POLL_INTERVAL_MS = 5000;

// ─── Formatting helpers (match SystemMetricsDashboard) ──────────────

const formatGB = (gb: number) => `${gb.toFixed(1)} GB`;
const formatMHz = (mhz: number) => mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;

// ─── Tooltip Component ──────────────────────────────────────────────────

function GraphTooltip({ active, payload, label, unit }: { active?: boolean; payload?: Array<{ dataKey: string; value: number | null; color: string }>; label?: number; unit?: string }) {
  if (!active || !payload || !label) return null;
  const d = new Date(label);
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 shadow-lg text-xs">
      <p className="font-mono text-muted-foreground mb-1">{d.toLocaleTimeString()}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-foreground font-semibold">
            {entry.value !== null && entry.value !== undefined ? `${entry.value}${unit ?? ""}` : "N/A"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  icon: typeof Cpu;
  color: string;
  current: string;
  subtitle?: string;
  history: MetricsSample[];
  dataKey: string;
  dataKey2?: string;
  dataKey2Label?: string;
  dataKey2Color?: string;
  dataKey2Dash?: boolean;
  unit: string;
  maxValue: number;
  connectNulls?: boolean;
  timeRange: TimeRange;
}

function MetricCard({
  title,
  icon: Icon,
  color,
  current,
  subtitle,
  history,
  dataKey,
  dataKey2,
  dataKey2Label,
  dataKey2Color,
  dataKey2Dash,
  unit,
  maxValue,
  connectNulls = true,
  timeRange,
}: MetricCardProps) {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const sampleCount = TIME_RANGE_SAMPLES[timeRange];
  const visibleData = history.slice(-sampleCount);

  return (
    <div className="ui-panel rounded-xl border border-border/60 bg-surface-1 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-surface-2/30">
        <span className="flex items-center justify-center h-6 w-6 rounded-md" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">{subtitle}</span>
        )}
      </div>

      {/* Current value */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-2xl font-bold text-foreground" style={{ color }}>{current}</span>
        {dataKey2 && (
          <span className="ml-3 text-sm font-semibold text-muted-foreground">
            {dataKey2Label}: <span style={{ color: dataKey2Color }}>{dataKey2}</span>
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pb-3 h-[140px]">
        {visibleData.length < 2 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Activity className="w-3 h-3 animate-pulse mr-1.5" />
            <span className="text-[10px]">Collecting...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" opacity={0.2} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tick={{ fontSize: 9, fill: "var(--color-muted-foreground, #888)" }}
                stroke="var(--color-border, #333)"
                minTickGap={40}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "var(--color-muted-foreground, #888)" }}
                stroke="var(--color-border, #333)"
                domain={maxValue > 0 ? [0, maxValue] : [0, "auto"]}
              />
              <Tooltip content={<GraphTooltip unit={unit} />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls={connectNulls}
              />
              {dataKey2 && (
                <Line
                  type="monotone"
                  dataKey={dataKey2}
                  stroke={dataKey2Color || "#888"}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={connectNulls}
                  strokeDasharray={dataKey2Dash ? "4 2" : undefined}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function SystemGraphView() {
  const [history, setHistory] = useState<MetricsSample[]>([]);
  const [connectionMode, setConnectionMode] = useState<string | null>(null);
  const [gatewayHostname, setGatewayHostname] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBrowserLocal] = useState(() => {
    if (typeof window === "undefined") return true;
    const hostname = window.location.hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]"
    );
  });
  const [remoteDisplayHostname] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const hostname = window.location.hostname.toLowerCase();
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]";
    return local ? null : window.location.hostname;
  });
  const [timeRange, setTimeRange] = useState<TimeRange>("30m");
  const [hasGpu, setHasGpu] = useState(false);

  const isRemoteMetrics =
    connectionMode !== null && (connectionMode !== "local" || !isBrowserLocal);

  // Fetch metrics and append to history
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/gateway-metrics");
      const result = await response.json();

      if (result.success && result.data) {
        const m = result.data;
        setConnectionMode(result.connectionMode || "local");
        setGatewayHostname(result.hostname || null);

        const primaryGpu = m.gpu?.[0];
        const gpuVramPercent =
          primaryGpu?.memory?.total && primaryGpu?.memory?.used
            ? Math.round((primaryGpu.memory.used / primaryGpu.memory.total) * 100)
            : null;

        if (primaryGpu?.usage != null) setHasGpu(true);

        // Match SystemMetricsDashboard rounding: Math.round for usage/percent,
        // toFixed(1) for GB values, direct values for temperature (already rounded server-side)
        const sample: MetricsSample = {
          timestamp: Date.now(),
          cpu: Math.round(m.cpu?.usage ?? 0),
          cpuTemp: m.cpu?.temperature ?? null,
          cpuSpeedMHz: Math.round(m.cpu?.currentSpeedMHz ?? 0),
          memory: Math.round(m.memory?.usage ?? 0),
          memoryUsedGB: Math.round((m.memory?.used ?? 0) * 10) / 10,
          memoryTotalGB: Math.round((m.memory?.total ?? 0) * 10) / 10,
          gpu: primaryGpu?.usage != null ? Math.round(primaryGpu.usage) : null,
          gpuTemp: primaryGpu?.temperature != null ? Math.round(primaryGpu.temperature) : null,
          gpuVram: gpuVramPercent,
          gpuVramUsedGB: primaryGpu?.memory?.used != null ? Math.round(primaryGpu.memory.used * 10) / 10 : null,
          gpuVramTotalGB: primaryGpu?.memory?.total != null ? Math.round(primaryGpu.memory.total * 10) / 10 : null,
          gpuPower: primaryGpu?.power != null ? Math.round(primaryGpu.power * 10) / 10 : null,
          gpuClockMHz: primaryGpu?.currentClockMHz != null ? Math.round(primaryGpu.currentClockMHz) : null,
        };

        setHistory((prev) => {
          const next = [...prev, sample];
          if (next.length > MAX_SAMPLES) next.shift();
          return next;
        });
        setError(null);
      } else {
        setError(result.error || "Failed to fetch metrics");
      }
    } catch {
      setError("Network error fetching metrics");
    }
  }, []);

  useEffect(() => {
    // Start polling — first tick fires immediately, then at POLL_INTERVAL_MS
    void fetchMetrics();
    const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Latest sample
  const latest = history.length > 0 ? history[history.length - 1] : null;

  if (error && history.length === 0) {
    return (
      <div className="ui-panel ui-depth-workspace p-4 h-full">
        <div className="flex items-center gap-2 text-red-500">
          <Activity className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-panel ui-depth-workspace p-4 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50 shrink-0">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">System Graph View</h2>
        {isRemoteMetrics && (
          <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-500 border border-blue-500/30">
            Remote: {gatewayHostname || remoteDisplayHostname || "unknown"}
          </span>
        )}
        {!isRemoteMetrics && connectionMode !== null && (
          <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-500 border border-green-500/30">
            Local
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-2">
          {history.length > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.round((history.length * POLL_INTERVAL_MS) / 60000)}m
            </span>
          )}
          {/* Time range selector */}
          <div className="flex gap-0.5 bg-surface-2 rounded-md p-0.5">
            {(["5m", "10m", "30m"] as TimeRange[]).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTimeRange(tr)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  timeRange === tr
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </span>
      </div>

      {/* Metric cards grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Row 1: CPU + Memory */}
          <MetricCard
            title="CPU"
            icon={Cpu}
            color="#3b82f6"
            current={latest ? `${latest.cpu}%` : "--"}
            subtitle={latest ? `${formatMHz(latest.cpuSpeedMHz)}` : undefined}
            history={history}
            dataKey="cpu"
            unit="%"
            maxValue={100}
            timeRange={timeRange}
          />

          <MetricCard
            title="Memory"
            icon={MemoryStick}
            color="#8b5cf6"
            current={latest ? `${latest.memory}%` : "--"}
            subtitle={latest ? `${formatGB(latest.memoryUsedGB)} / ${formatGB(latest.memoryTotalGB)}` : undefined}
            history={history}
            dataKey="memory"
            unit="%"
            maxValue={100}
            timeRange={timeRange}
          />

          {/* Row 2: GPU + GPU VRAM */}
          {hasGpu && (
            <MetricCard
              title="GPU"
              icon={Video}
              color="#ef4444"
              current={latest && latest.gpu !== null ? `${latest.gpu}%` : "N/A"}
              subtitle={latest ? [
                latest.gpuClockMHz !== null ? formatMHz(latest.gpuClockMHz) : null,
                latest.gpuPower !== null ? `${latest.gpuPower}W` : null,
              ].filter(Boolean).join(" • ") : undefined}
              history={history}
              dataKey="gpu"
              unit="%"
              maxValue={100}
              connectNulls={false}
              timeRange={timeRange}
            />
          )}

          {hasGpu && (
            <MetricCard
              title="GPU VRAM"
              icon={Gauge}
              color="#ec4899"
              current={latest && latest.gpuVram !== null ? `${latest.gpuVram}%` : "N/A"}
              subtitle={latest && latest.gpuVramUsedGB !== null && latest.gpuVramTotalGB !== null ? `${formatGB(latest.gpuVramUsedGB)} / ${formatGB(latest.gpuVramTotalGB)}` : undefined}
              history={history}
              dataKey="gpuVram"
              unit="%"
              maxValue={100}
              connectNulls={false}
              timeRange={timeRange}
            />
          )}

          {/* Row 3: CPU Temperature + GPU Temperature */}
          <MetricCard
            title="CPU Temperature"
            icon={Thermometer}
            color="#f59e0b"
            current={latest && latest.cpuTemp !== null ? `${latest.cpuTemp}°C` : "N/A"}
            subtitle={latest && latest.cpuTemp !== null ? (latest.cpuTemp > 80 ? "HOT" : latest.cpuTemp > 60 ? "WARM" : "COOL") : undefined}
            history={history}
            dataKey="cpuTemp"
            unit="°C"
            maxValue={120}
            connectNulls={false}
            timeRange={timeRange}
          />

          {hasGpu && (
            <MetricCard
              title="GPU Temperature"
              icon={Thermometer}
              color="#f97316"
              current={latest && latest.gpuTemp !== null ? `${latest.gpuTemp}°C` : "N/A"}
              subtitle={latest && latest.gpuTemp !== null ? (latest.gpuTemp > 85 ? "HOT" : latest.gpuTemp > 65 ? "WARM" : "COOL") : undefined}
              history={history}
              dataKey="gpuTemp"
              unit="°C"
              maxValue={120}
              connectNulls={false}
              timeRange={timeRange}
            />
          )}
        </div>
      </div>
    </div>
  );
}