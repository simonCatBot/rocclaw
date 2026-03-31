"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentStore } from "@/features/agents/state/store";
import {
  sortCronJobsByUpdatedAt,
  formatCronSchedule,
  formatCronPayload,
  type CronJobSummary,
} from "@/lib/cron/types";
import {
  Search,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Zap,
  Trash2,
  Play,
  Pause,
  Calendar,
  Activity,
} from "lucide-react";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function agentAvatarUrl(agentId: string, avatarSeed: string | null | undefined) {
  const seed = avatarSeed?.trim() || agentId;
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;
}

// ─── Duration / time formatting ────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatNextRun(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Status dot ────────────────────────────────────────────────────────────────

const dotColors: Record<string, string> = {
  thinking: "bg-blue-400",
  running: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  scheduled: "bg-amber-500",
  disabled: "bg-neutral-400",
  idle: "bg-neutral-300",
  queued: "bg-purple-500",
};

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}${pulse ? " animate-pulse" : ""}`}
    />
  );
}

// ─── Cron Job tile ─────────────────────────────────────────────────────────────

interface CronJobTileProps {
  job: CronJobSummary;
  agents: { agentId: string; name: string; avatarSeed?: string | null }[];
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  runBusy: boolean;
  deleteBusy: boolean;
}

function CronJobTile({ job, agents, onRun, onToggle, onDelete, runBusy, deleteBusy }: CronJobTileProps) {
  const state = job.state;
  const agent = agents.find((a) => a.agentId === job.agentId);
  const agentName = agent?.name ?? job.agentId ?? "Unknown";
  const avatarUrl = agentAvatarUrl(job.agentId ?? "", agent?.avatarSeed);

  const dot = job.enabled
    ? state.runningAtMs
      ? "bg-blue-500"
      : state.lastStatus === "ok"
        ? "bg-green-500"
        : state.lastStatus === "error"
          ? "bg-red-500"
          : "bg-amber-500"
    : "bg-neutral-400";

  const lastRunColor =
    state.lastStatus === "ok"
      ? "text-green-400"
      : state.lastStatus === "error"
        ? "text-red-400"
        : state.lastStatus === "skipped"
          ? "text-amber-400"
          : "text-muted-foreground";

  const scheduleStr = formatCronSchedule(job.schedule);
  const payloadStr = formatCronPayload(job.payload);

  return (
    <div className="group relative rounded-xl border border-border bg-surface-1 p-3 shadow-sm transition-colors hover:border-border/80 hover:bg-surface-2/30">
      {/* Agent avatar + name */}
      <div className="mb-2 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={agentName}
          className="h-7 w-7 shrink-0 rounded-full bg-surface-2"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{job.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{agentName}</p>
        </div>
        <StatusDot color={dot} pulse={!!state.runningAtMs} />
      </div>

      {/* Schedule */}
      <p className="mb-1 flex items-center gap-1 font-mono text-xs text-muted-foreground">
        <Calendar className="h-3 w-3 shrink-0" />
        {scheduleStr}
      </p>

      {/* Payload */}
      {payloadStr && (
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground/80">{payloadStr}</p>
      )}

      {/* Status line */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {job.state.lastRunAtMs ? (
          <span className={lastRunColor}>
            last {formatRelative(job.state.lastRunAtMs)}
            {state.lastDurationMs != null ? ` · ${formatDuration(state.lastDurationMs)}` : ""}
          </span>
        ) : null}
        {job.state.nextRunAtMs && job.enabled ? (
          <span>next {formatNextRun(job.state.nextRunAtMs)}</span>
        ) : null}
        {!job.enabled && <span className="text-neutral-500">paused</span>}
      </div>

      {/* Running spinner overlay */}
      {state.runningAtMs && (
        <div className="absolute inset-x-0 top-0 flex items-center gap-1 rounded-t-xl bg-blue-500/10 px-3 py-1">
          <Loader className="h-3 w-3 animate-spin text-blue-400" />
          <span className="text-[10px] font-medium text-blue-400">Running</span>
        </div>
      )}

      {/* Actions — appear on hover */}
      <div className="mt-2 flex items-center gap-1 border-t border-border/50 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
        {job.enabled ? (
          <button
            onClick={() => onToggle(job.id, false)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            <Pause className="h-3 w-3" /> Pause
          </button>
        ) : (
          <button
            onClick={() => onToggle(job.id, true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            <Play className="h-3 w-3" /> Resume
          </button>
        )}
        <button
          onClick={() => onRun(job.id)}
          disabled={runBusy || !job.enabled}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-30"
        >
          <Zap className="h-3 w-3" /> Run
        </button>
        <button
          onClick={() => onDelete(job.id)}
          disabled={deleteBusy}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Run tile ──────────────────────────────────────────────────────────────────

interface RunTileProps {
  agentName: string;
  agentId: string;
  avatarSeed?: string | null;
  status: "thinking" | "running" | "completed" | "failed";
  label: string;
  startedAtMs: number;
  endedAtMs?: number | null;
  thinkingMs?: number | null;
  streamText?: string | null;
  lastMessage?: string | null;
}

function RunTile({
  agentName,
  agentId,
  avatarSeed,
  status,
  label,
  startedAtMs,
  endedAtMs,
  thinkingMs,
  streamText,
  lastMessage,
}: RunTileProps) {
  const durationMs = endedAtMs ? endedAtMs - startedAtMs : null;
  const dot = dotColors[status] ?? "bg-neutral-400";
  const Icon = status === "completed" ? CheckCircle : status === "failed" ? XCircle : Activity;
  const avatarUrl = agentAvatarUrl(agentId, avatarSeed);

  return (
    <div className="group relative rounded-xl border border-border bg-surface-1 p-3 shadow-sm transition-colors hover:border-border/80 hover:bg-surface-2/30">
      {/* Agent avatar + name */}
      <div className="mb-2 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={agentName}
          className="h-7 w-7 shrink-0 rounded-full bg-surface-2"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{agentName}</p>
        </div>
        <StatusDot color={dot} pulse={status === "thinking" || status === "running"} />
      </div>

      {/* Activity line */}
      {(streamText || lastMessage) && (
        <p className="mb-2 line-clamp-2 font-mono text-xs text-muted-foreground/70">
          {streamText ?? lastMessage}
        </p>
      )}

      {/* Thinking duration */}
      {thinkingMs !== null && thinkingMs !== undefined && (
        <p className="mb-1 flex items-center gap-1 text-[10px] text-blue-400">
          <Activity className="h-3 w-3" />
          thinking {formatDuration(thinkingMs)}
        </p>
      )}

      {/* Duration / elapsed */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {durationMs !== null ? (
          <span className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {formatDuration(durationMs)}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelative(startedAtMs)}
          </span>
        )}
        <span className="font-mono">{formatTime(startedAtMs)}</span>
        {status === "failed" && (
          <span className="ml-auto text-red-400">Failed</span>
        )}
        {status === "completed" && (
          <span className="ml-auto text-green-400">Done</span>
        )}
      </div>
    </div>
  );
}

// ─── Column header ─────────────────────────────────────────────────────────────

function ColumnHeader({
  label,
  Icon,
  accent,
  count,
}: {
  label: string;
  Icon: React.ElementType;
  accent: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex flex-col items-center gap-1">
      <div className={`flex items-center gap-2 ${accent}`}>
        <Icon className="h-5 w-5" />
        <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-2 font-mono text-xs text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

// ─── Create Cron Job Modal ─────────────────────────────────────────────────────

interface CreateCronModalProps {
  agentId: string;
  agents: { agentId: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateCronModal({ agentId: defaultAgentId, agents, onClose, onCreated }: CreateCronModalProps) {
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [message, setMessage] = useState("");
  const [everyValue, setEveryValue] = useState("60");
  const [everyUnit, setEveryUnit] = useState<"s" | "m" | "h">("m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyMs = useMemo(() => {
    const v = parseInt(everyValue) || 0;
    if (everyUnit === "h") return v * 3600000;
    if (everyUnit === "m") return v * 60000;
    return v * 1000;
  }, [everyValue, everyUnit]);

  const handleCreate = async () => {
    if (!name.trim() || !message.trim() || everyMs <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intents/cron-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), agentId: agentId || undefined, everyMs, message: message.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to create task");
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-1 p-5 shadow-2xl">
        <h3 className="mb-4 text-base font-semibold text-foreground">Create Scheduled Task</h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Task name</label>
            <input
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Daily summary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {agents.length > 1 && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Agent</label>
              <select
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Default</option>
                {agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prompt / message</label>
            <textarea
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="What should this task do?"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Run every</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                className="w-24 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={everyValue}
                onChange={(e) => setEveryValue(e.target.value)}
              />
              <select
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={everyUnit}
                onChange={(e) => setEveryUnit(e.target.value as "s" | "m" | "h")}
              >
                <option value="s">seconds</option>
                <option value="m">minutes</option>
                <option value="h">hours</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim() || !message.trim() || everyMs <= 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tasks Dashboard ─────────────────────────────────────────────────────

export function TasksDashboard() {
  const { state } = useAgentStore();
  const agents = state.agents;

  const [cronJobs, setCronJobs] = useState<CronJobSummary[]>([]);
  const [runBusy, setRunBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());

  // Refresh "X ago" timestamps
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  // Fetch cron jobs from the API route
  const fetchCronJobs = useMemo(() => async () => {
    try {
      const res = await fetch("/api/cron/jobs");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const jobs: CronJobSummary[] = data.jobs ?? [];
      setCronJobs(sortCronJobsByUpdatedAt(jobs));
    } catch {
      // gateway may not be connected — silently skip
    }
  }, []);

  useEffect(() => {
    void fetchCronJobs();
  }, [fetchCronJobs]);

  // Build active + history entries from agent state
  const runEntries = useMemo(() => {
    const entries: Omit<RunTileProps, "avatarSeed">[] = [];
    for (const agent of agents) {
      const isRunning = agent.status === "running" && agent.runStartedAt !== null;
      if (isRunning) {
        const trace = agent.thinkingTrace ?? "";
        let label = "Running";
        if (trace) {
          const first = trace.split("\n")[0];
          if (first.includes("search")) label = "Searching";
          else if (first.includes("read") || first.includes("file")) label = "Reading";
          else if (first.includes("code") || first.includes("implement")) label = "Coding";
          else if (first.includes("write")) label = "Writing";
          else label = "Thinking";
        }
        entries.push({
          agentName: agent.name,
          agentId: agent.agentId,
          status: "thinking",
          label,
          startedAtMs: agent.runStartedAt ?? 0,
          thinkingMs: agent.runStartedAt ? now - (agent.runStartedAt ?? 0) : null,
          streamText: agent.streamText,
          lastMessage: agent.lastUserMessage,
        });
      }
      if (agent.status !== "running" && agent.lastActivityAt != null && agent.lastActivityAt > 0) {
        entries.push({
          agentName: agent.name,
          agentId: agent.agentId,
          status: agent.status === "error" ? "failed" : "completed",
          label:
            agent.lastUserMessage?.split("\n")[0]?.slice(0, 60) ??
            (agent.status === "error" ? "Run failed" : "Run completed"),
          startedAtMs: agent.runStartedAt ?? agent.lastActivityAt ?? 0,
          endedAtMs: agent.lastActivityAt,
          streamText: agent.lastResult,
          lastMessage: agent.lastUserMessage,
        });
      }
    }
    // Sort: active first, then by time
    entries.sort((a, b) => {
      const aActive = a.status === "thinking" || a.status === "running" ? 0 : 1;
      const bActive = b.status === "thinking" || b.status === "running" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.startedAtMs - a.startedAtMs;
    });
    return entries;
  }, [agents, now]);

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return cronJobs;
    const q = search.toLowerCase();
    return cronJobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        formatCronPayload(j.payload).toLowerCase().includes(q) ||
        j.agentId?.toLowerCase().includes(q)
    );
  }, [cronJobs, search]);

  const filteredRuns = useMemo(() => {
    if (!search.trim()) return runEntries;
    const q = search.toLowerCase();
    return runEntries.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q) ||
        r.lastMessage?.toLowerCase().includes(q)
    );
  }, [runEntries, search]);

  const handleRun = async (id: string) => {
    setRunBusy(true);
    try {
      await fetch("/api/cron/run?id=" + encodeURIComponent(id), { method: "POST" });
      await fetchCronJobs();
    } catch {
      // silently ignore
    } finally {
      setRunBusy(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/cron/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error();
      await fetchCronJobs();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setDeleteBusy(id);
    try {
      await fetch("/api/cron/jobs?id=" + encodeURIComponent(id), { method: "DELETE" });
      await fetchCronJobs();
    } catch {} finally {
      setDeleteBusy(null);
    }
  };

  const agentList = agents.map((a) => ({
    agentId: a.agentId,
    name: a.name,
    avatarSeed: a.avatarSeed,
  }));
  const defaultAgentId = agents[0]?.agentId ?? "";

  // ── Kanban columns ────────────────────────────────────────────────────────
  const queuedJobs = useMemo(
    () => filteredJobs.filter((j) => j.state.nextRunAtMs != null && j.state.runningAtMs == null),
    [filteredJobs]
  );

  const scheduledJobs = useMemo(
    () =>
      filteredJobs.filter(
        (j) => j.state.runningAtMs == null && (j.state.nextRunAtMs == null || !j.enabled)
      ),
    [filteredJobs]
  );

  const executingRuns = useMemo(
    () => filteredRuns.filter((r) => r.status === "thinking" || r.status === "running"),
    [filteredRuns]
  );

  const doneRuns = useMemo(
    () => filteredRuns.filter((r) => r.status === "completed" || r.status === "failed"),
    [filteredRuns]
  );

  const doneJobs = useMemo(
    () => filteredJobs.filter((j) => j.state.lastRunAtMs != null && j.state.runningAtMs == null),
    [filteredJobs]
  );

  type CronItem = typeof queuedJobs[number];
  type RunItem = typeof executingRuns[number];

  type ColConfig = {
    id: string;
    label: string;
    Icon: React.ElementType;
    accent: string;
    accentBg: string;
    cronItems: CronItem[];
    runItems: RunItem[];
    isRun: boolean;
  };

  const colConfig: ColConfig[] = [
    {
      id: "queued",
      label: "Queued",
      Icon: Loader,
      accent: "text-purple-400",
      accentBg: "bg-purple-400/10",
      cronItems: queuedJobs,
      runItems: [],
      isRun: false,
    },
    {
      id: "scheduled",
      label: "Scheduled",
      Icon: Calendar,
      accent: "text-amber-400",
      accentBg: "bg-amber-400/10",
      cronItems: scheduledJobs,
      runItems: [],
      isRun: false,
    },
    {
      id: "executing",
      label: "Executing",
      Icon: Zap,
      accent: "text-blue-400",
      accentBg: "bg-blue-400/10",
      cronItems: [],
      runItems: executingRuns,
      isRun: true,
    },
    {
      id: "done",
      label: "Done",
      Icon: CheckCircle,
      accent: "text-green-400",
      accentBg: "bg-green-400/10",
      cronItems: doneJobs,
      runItems: doneRuns,
      isRun: true,
    },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Command bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
          placeholder="Search tasks and schedules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4">
        {colConfig.map((col) => {
          const Icon = col.Icon;
          const total = col.isRun
            ? col.runItems.length
            : col.cronItems.length;

          return (
            <div
              key={col.id}
              className="flex min-w-[240px] flex-1 flex-col rounded-2xl border border-border bg-surface-1 p-3"
            >
              {/* Column header */}
              <div className={`mb-3 flex flex-col items-center gap-1 rounded-xl ${col.accentBg} p-2`}>
                <div className={`flex items-center gap-1.5 ${col.accent}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">{col.label}</span>
                </div>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-2 font-mono text-xs text-muted-foreground">
                  {total}
                </span>
              </div>

              {/* Scrollable tile list */}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {total === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">
                    {col.id === "queued"
                      ? "No queued tasks"
                      : col.id === "scheduled"
                        ? "No scheduled tasks"
                        : col.id === "executing"
                          ? "Nothing running"
                          : "No completed runs"}
                  </p>
                ) : col.isRun ? (
                  col.runItems.map((run) => {
                    const agent = agents.find((a) => a.agentId === run.agentId);
                    return (
                      <RunTile
                        key={`${run.agentId}-${run.startedAtMs}`}
                        {...run}
                        avatarSeed={agent?.avatarSeed}
                      />
                    );
                  })
                ) : (
                  col.cronItems.map((job) => (
                    <CronJobTile
                      key={job.id}
                      job={job}
                      agents={agentList}
                      onRun={handleRun}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      runBusy={runBusy}
                      deleteBusy={deleteBusy === job.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <CreateCronModal
          agentId={defaultAgentId}
          agents={agentList}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchCronJobs}
        />
      )}
    </div>
  );
}
