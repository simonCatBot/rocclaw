// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Server,
  Clock,
  Cpu,
  MemoryStick,
  Video,
  Wifi,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────

interface MetricsSample {
  timestamp: number;
  cpu: number;
  cpuTemp: number | null;
  cpuSpeedMHz: number;
  memory: number;
  gpu: number | null;
  gpuTemp: number | null;
  gpuVram: number | null;
  gpuPower: number | null;
  netRxSec: number;
  netTxSec: number;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    temperature: number | null;
    currentSpeedMHz: number;
  };
  memory: {
    usage: number;
  };
  gpu: {
    usage: number | null;
    temperature: number | null;
    memory: { used: number | null; total: number | null };
    power?: number;
  }[];
  network: {
    rxSec: number;
    txSec: number;
  };
}

type MetricChannel = "cpu" | "memory" | "gpu" | "gpuTemp" | "gpuVram" | "network" | "cpuTemp";

interface ChannelConfig {
  id: MetricChannel;
  label: string;
  unit: string;
  color: string;
  icon: typeof Cpu;
  dataKey: string;
  maxValue: number;
}

const CHANNELS: ChannelConfig[] = [
  { id: "cpu", label: "CPU Usage", unit: "%", color: "#3b82f6", icon: Cpu, dataKey: "cpu", maxValue: 100 },
  { id: "cpuTemp", label: "CPU Temp", unit: "°C", color: "#f59e0b", icon: Activity, dataKey: "cpuTemp", maxValue: 120 },
  { id: "memory", label: "Memory", unit: "%", color: "#8b5cf6", icon: MemoryStick, dataKey: "memory", maxValue: 100 },
  { id: "gpu", label: "GPU Usage", unit: "%", color: "#ef4444", icon: Video, dataKey: "gpu", maxValue: 100 },
  { id: "gpuTemp", label: "GPU Temp", unit: "°C", color: "#f97316", icon: Activity, dataKey: "gpuTemp", maxValue: 120 },
  { id: "gpuVram", label: "GPU VRAM", unit: "%", color: "#ec4899", icon: Video, dataKey: "gpuVram", maxValue: 100 },
  { id: "network", label: "Network", unit: "KB/s", color: "#10b981", icon: Wifi, dataKey: "netRxSec", maxValue: 0 },
];

const MAX_SAMPLES = 360; // 30 min at 5s intervals
const POLL_INTERVAL_MS = 5000;

// ─── Component ───────────────────────────────────────────────────────

export function SystemGraphView() {
  const [history, setHistory] = useState<MetricsSample[]>([]);
  const [activeChannels, setActiveChannels] = useState<Set<MetricChannel>>(
    new Set(["cpu", "memory", "gpu"])
  );
  const [connectionMode, setConnectionMode] = useState<string | null>(null);
  const [gatewayHostname, setGatewayHostname] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBrowserLocal, setIsBrowserLocal] = useState(true);
  const [remoteDisplayHostname, setRemoteDisplayHostname] = useState<string | null>(null);
  const historyRef = useRef<MetricsSample[]>([]);

  // Browser locality detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname.toLowerCase();
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]";
    setIsBrowserLocal(local);
    if (!local) setRemoteDisplayHostname(window.location.hostname);
  }, []);

  const isRemoteMetrics =
    connectionMode !== null && (connectionMode !== "local" || !isBrowserLocal);

  // Fetch metrics and append to history
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/gateway-metrics");
      const result = await response.json();

      if (result.success && result.data) {
        const m: SystemMetrics = result.data;
        setConnectionMode(result.connectionMode || "local");
        setGatewayHostname(result.hostname || null);

        const primaryGpu = m.gpu?.[0];
        const gpuVramPercent =
          primaryGpu?.memory?.total && primaryGpu?.memory?.used
            ? Math.round((primaryGpu.memory.used / primaryGpu.memory.total) * 100)
            : null;

        const sample: MetricsSample = {
          timestamp: Date.now(),
          cpu: Math.round(m.cpu?.usage ?? 0),
          cpuTemp: m.cpu?.temperature ?? null,
          cpuSpeedMHz: m.cpu?.currentSpeedMHz ?? 0,
          memory: Math.round(m.memory?.usage ?? 0),
          gpu: primaryGpu?.usage != null ? Math.round(primaryGpu.usage) : null,
          gpuTemp: primaryGpu?.temperature ?? null,
          gpuVram: gpuVramPercent,
          gpuPower: primaryGpu?.power ?? null,
          netRxSec: Math.round((m.network?.rxSec ?? 0) / 1024),
          netTxSec: Math.round((m.network?.txSec ?? 0) / 1024),
        };

        setHistory((prev) => {
          const next = [...prev, sample];
          if (next.length > MAX_SAMPLES) next.shift();
          historyRef.current = next;
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
    fetchMetrics();
    const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Toggle channel
  const toggleChannel = (channel: MetricChannel) => {
    setActiveChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        if (next.size > 1) next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  // Format timestamp for X axis
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  // Format tooltip label
  const formatTooltipLabel = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number | null; name: string; color: string }>; label?: number }) => {
    if (!active || !payload || !label) return null;
    return (
      <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 shadow-lg text-xs">
        <p className="font-mono text-muted-foreground mb-1">{formatTooltipLabel(label)}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">
              {entry.value !== null && entry.value !== undefined ? entry.value : "N/A"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Determine which lines to render
  const visibleChannels = CHANNELS.filter((ch) => activeChannels.has(ch.id));

  // Check if any data has GPU metrics
  const hasGpuData = history.some((s) => s.gpu !== null);

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
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50 shrink-0">
        <Server className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Graph View</h2>
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
        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {history.length > 0
            ? `${Math.round((history.length * POLL_INTERVAL_MS) / 60000)}m history`
            : "Collecting..."}
        </span>
      </div>

      {/* Channel selector */}
      <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
        {CHANNELS.filter((ch) => ch.id === "gpu" || ch.id === "gpuTemp" || ch.id === "gpuVram" ? hasGpuData : true).map((ch) => {
          const Icon = ch.icon;
          const isActive = activeChannels.has(ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => toggleChannel(ch.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide transition-all ${
                isActive
                  ? "text-white shadow-sm"
                  : "text-muted-foreground bg-surface-2 hover:bg-surface-3"
              }`}
              style={isActive ? { backgroundColor: ch.color } : undefined}
            >
              <Icon className="w-3 h-3" />
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {history.length < 2 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Collecting data points...</span>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" opacity={0.3} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #888)" }}
                stroke="var(--color-border, #333)"
                minTickGap={60}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #888)" }}
                stroke="var(--color-border, #333)"
                domain={[0, "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => (
                  <span style={{ color: "var(--color-foreground, #ccc)" }}>{value}</span>
                )}
              />
              {visibleChannels.map((ch) => (
                <Line
                  key={ch.id}
                  type="monotone"
                  dataKey={ch.dataKey}
                  name={ch.label}
                  stroke={ch.color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={ch.id !== "network"}
                />
              ))}
              {/* Network TX as secondary line */}
              {activeChannels.has("network") && (
                <Line
                  type="monotone"
                  dataKey="netTxSec"
                  name="Net TX"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  strokeDasharray="4 2"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Current values strip */}
      {history.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/50 shrink-0">
          {visibleChannels.map((ch) => {
            const latest = history[history.length - 1];
            const value = (latest as unknown as Record<string, number | null>)[ch.dataKey];
            return (
              <div key={ch.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ch.color }} />
                <span className="text-[10px] font-semibold text-muted-foreground">{ch.label}:</span>
                <span className="text-xs font-bold text-foreground">
                  {value !== null && value !== undefined ? `${value}${ch.unit}` : "N/A"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}