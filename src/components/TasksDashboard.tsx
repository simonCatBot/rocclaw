"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentStore } from "@/features/agents/state/store";
import {
  listCronJobs,
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

// ─── Status dot ────────────────────────────────────────────────────────────────

const dotColors: Record<string, string> = {
  thinking: "bg-blue-400",
  running: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  scheduled: "bg-amber-500",
  disabled: "bg-neutral-400",
  idle: "bg-neutral-300",
};

function StatusDot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
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

// ─── Cron Job row ─────────────────────────────────────────────────────────────

interface CronJobRowProps {
  job: CronJobSummary;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  runBusy: boolean;
  deleteBusy: boolean;
}

function CronJobRow({ job, onRun, onToggle, onDelete, runBusy, deleteBusy }: CronJobRowProps) {
  const state = job.state;
  const lastRunColor =
    state.lastStatus === "ok"
      ? "text-green-400"
      : state.lastStatus === "error"
        ? "text-red-400"
        : state.lastStatus === "skipped"
          ? "text-amber-400"
          : "text-muted-foreground";

  const dot = job.enabled
    ? state.runningAtMs
      ? "bg-blue-500 animate-pulse"
      : state.lastStatus === "ok"
        ? "bg-green-500"
        : state.lastStatus === "error"
          ? "bg-red-500"
          : "bg-amber-500"
    : "bg-neutral-400";

  const scheduleStr = formatCronSchedule(job.schedule);
  const payloadStr = formatCronPayload(job.payload);

  return (
    <div className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-2/50">
      {/* Status dot + icon */}
      <div className="mt-1 flex flex-col items-center gap-1.5">
        <StatusDot color={dot} />
        <span className="text-muted-foreground">
          {state.runningAtMs ? (
            <Loader className="h-3 w-3 animate-spin" />
          ) : (
            <Calendar className="h-3 w-3" />
          )}
        </span>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{job.name}</span>
          {!job.enabled && (
            <span className="shrink-0 rounded bg-neutral-700 px-1 py-0.5 text-[10px] text-neutral-300">
              paused
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {scheduleStr}
        </p>
        {payloadStr && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
            {payloadStr}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          {job.state.lastRunAtMs ? (
            <span className={lastRunColor}>
              last: {formatRelative(job.state.lastRunAtMs)}
              {state.lastDurationMs != null ? ` · ${formatDuration(state.lastDurationMs)}` : ""}
            </span>
          ) : null}
          {job.state.nextRunAtMs && job.enabled ? (
            <span>next: {formatNextRun(job.state.nextRunAtMs)}</span>
          ) : null}
          {job.agentId ? <span>agent: {job.agentId}</span> : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        {job.enabled ? (
          <button
            onClick={() => onToggle(job.id, false)}
            className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            title="Pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onToggle(job.id, true)}
            className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            title="Resume"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => onRun(job.id)}
          disabled={runBusy || !job.enabled}
          className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-30"
          title="Run now"
        >
          <Zap className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(job.id)}
          disabled={deleteBusy}
          className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-red-400"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Active / history run row ─────────────────────────────────────────────────

interface RunRowProps {
  agentName: string;
  agentId: string;
  status: "thinking" | "running" | "completed" | "failed";
  label: string;
  startedAtMs: number;
  endedAtMs?: number | null;
  thinkingMs?: number | null;
  streamText?: string | null;
  lastMessage?: string | null;
}

function RunRow({ agentName, agentId, status, label, startedAtMs, endedAtMs, thinkingMs, streamText, lastMessage }: RunRowProps) {
  const durationMs = endedAtMs ? endedAtMs - startedAtMs : null;
  const dot = dotColors[status] ?? "bg-neutral-400";
  const Icon = status === "completed" ? CheckCircle : status === "failed" ? XCircle : Activity;

  return (
    <div className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-2/50">
      <div className="mt-1 flex flex-col items-center gap-1.5">
        <StatusDot color={dot} />
        <Icon className={`h-3 w-3 ${status === "thinking" || status === "running" ? "animate-pulse text-blue-400" : "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">{agentName}</span>
        </div>
        {(streamText || lastMessage) && (
          <p className="mt-0.5 line-clamp-1 font-mono text-xs text-muted-foreground/70">
            {streamText ?? lastMessage}
          </p>
        )}
        {thinkingMs !== null && thinkingMs !== undefined && (
          <p className="mt-0.5 text-[10px] text-blue-400/70">
            thinking {formatDuration(thinkingMs)}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {durationMs !== null ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatDuration(durationMs)}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatRelative(startedAtMs)}
          </span>
        )}
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
          {formatTime(startedAtMs)}
        </div>
      </div>
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
  const [loadingCron, setLoadingCron] = useState(false);
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
    const entries: RunRowProps[] = [];
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
          label: agent.lastUserMessage?.split("\n")[0]?.slice(0, 60) ?? (agent.status === "error" ? "Run failed" : "Run completed"),
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

  const agentList = agents.map((a) => ({ agentId: a.agentId, name: a.name }));
  const defaultAgentId = agents[0]?.agentId ?? "";

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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Agent Runs */}
        {filteredRuns.length > 0 && (
          <section className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Runs
              </span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-muted-foreground">
                {filteredRuns.length}
              </span>
            </div>
            <div className="space-y-0">
              {filteredRuns.map((run) => (
                <RunRow key={`${run.agentId}-${run.startedAtMs}`} {...run} />
              ))}
            </div>
          </section>
        )}

        {/* Scheduled */}
        {filteredJobs.length > 0 && (
          <section className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Scheduled
              </span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-muted-foreground">
                {filteredJobs.length}
              </span>
            </div>
            <div className="space-y-0">
              {filteredJobs.map((job) => (
                <CronJobRow
                  key={job.id}
                  job={job}
                  onRun={handleRun}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  runBusy={runBusy}
                  deleteBusy={deleteBusy === job.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {filteredRuns.length === 0 && filteredJobs.length === 0 && (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                {search ? "No matching tasks" : "No tasks yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {search ? "Try a different search" : "Create a scheduled task to get started"}
              </p>
            </div>
          </div>
        )}
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
