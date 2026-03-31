"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type CollisionDetection,
  closestCenter,
} from "@dnd-kit/core";
import { useSortable, SortableContext } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// ─── Pending execution (created when a cron job is drag-dropped to Executing) ──

interface PendingRunEntry {
  id: string; // unique run id
  job: CronJobSummary;
  agentName: string;
  agentId: string;
  avatarSeed?: string | null;
  startedAtMs: number;
  label: string;
  payloadPreview: string;
  /** Set to true once the real agent run shows up in runEntries */
  absorbed: boolean;
}

// ─── Tile ID helpers ─────────────────────────────────────────────────────────

function tileId(colId: string, unique: string) {
  return `${colId}::${unique}`;
}

function parseTileId(id: string): { colId: string; unique: string } | null {
  const idx = id.indexOf("::");
  if (idx === -1) return null;
  return { colId: id.slice(0, idx), unique: id.slice(idx + 2) };
}

const COLUMN_IDS = new Set(["queued", "scheduled", "executing", "done"]);

function isColumnId(id: string): boolean {
  return COLUMN_IDS.has(id);
}

// ─── Draggable cron job tile ─────────────────────────────────────────────────

interface CronJobTileProps {
  job: CronJobSummary;
  agentName: string;
  agentAvatarSeed?: string | null;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  runBusy: boolean;
  deleteBusy: boolean;
  isDragOverlay?: boolean;
  dragHandleId?: string;
}

function CronJobTile({
  job,
  agentName,
  agentAvatarSeed,
  onRun,
  onToggle,
  onDelete,
  runBusy,
  deleteBusy,
  isDragOverlay,
}: CronJobTileProps) {
  const state = job.state;
  const avatarUrl = agentAvatarUrl(job.agentId ?? agentName, agentAvatarSeed);

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
    <div
      className={`group relative rounded-xl border bg-surface-1 p-3 shadow-sm transition-all ${
        isDragOverlay
          ? "border-primary shadow-xl ring-2 ring-primary/60"
          : "border-border hover:border-border/80 hover:bg-surface-2/30"
      }`}
    >
      {/* Header: agent avatar + name + status */}
      <div className="mb-2 flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={agentName}
          className="h-8 w-8 shrink-0 rounded-full bg-surface-2 ring-1 ring-border"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{job.name}</p>
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
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

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1 border-t border-border/50 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
        {job.enabled ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(job.id, false); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            <Pause className="h-3 w-3" /> Pause
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(job.id, true); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            <Play className="h-3 w-3" /> Resume
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRun(job.id); }}
          disabled={runBusy || !job.enabled}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-30"
        >
          <Zap className="h-3 w-3" /> Run
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
          disabled={deleteBusy}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Run tile (agent execution) ────────────────────────────────────────────────

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
  isDragOverlay?: boolean;
  isPendingExecution?: boolean;
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
  isDragOverlay,
  isPendingExecution,
}: RunTileProps) {
  const durationMs = endedAtMs ? endedAtMs - startedAtMs : null;
  const dot = dotColors[status] ?? "bg-neutral-400";
  const Icon = status === "completed" ? CheckCircle : status === "failed" ? XCircle : Activity;
  const avatarUrl = agentAvatarUrl(agentId, avatarSeed);

  return (
    <div
      className={`rounded-xl border bg-surface-1 p-3 shadow-sm transition-all ${
        isDragOverlay
          ? "border-primary shadow-xl ring-2 ring-primary/60"
          : isPendingExecution
            ? "border-blue-500/50 bg-blue-500/5"
            : "border-border hover:border-border/80 hover:bg-surface-2/30"
      }`}
    >
      {/* Agent avatar + name + status */}
      <div className="mb-2 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={agentName}
          className={`h-8 w-8 shrink-0 rounded-full bg-surface-2 ring-1 ring-border ${isPendingExecution ? "ring-blue-500/50" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{label}</p>
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
        {isPendingExecution && (
          <span className="ml-auto rounded bg-blue-500/20 px-1.5 py-0.5 text-blue-400">
            <Zap className="mr-0.5 inline h-2.5 w-2.5" />
            Triggered
          </span>
        )}
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

// ─── Column zone (droppable) ─────────────────────────────────────────────────

interface ColumnZoneProps {
  id: string;
  isDropTarget: boolean;
  children: React.ReactNode;
}

function ColumnZone({ id, isDropTarget, children }: ColumnZoneProps) {
  return (
    <div
      data-column={id}
      className={`flex min-w-[240px] flex-1 flex-col rounded-2xl border p-3 transition-all ${
        isDropTarget
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 ring-offset-1 ring-offset-transparent"
          : "border-border bg-surface-1"
      }`}
    >
      {children}
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
      <div className={`flex items-center gap-1.5 ${accent}`}>
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

  /** Pending executions: cron jobs dragged to Executing, shown as synthetic runs */
  const [pendingExecutions, setPendingExecutions] = useState<Map<string, PendingRunEntry>>(new Map());

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragOverColumnRef = useRef<string | null>(null);

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
    const entries: Omit<RunTileProps, "avatarSeed" | "isPendingExecution">[] = [];
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
    entries.sort((a, b) => {
      const aActive = a.status === "thinking" || a.status === "running" ? 0 : 1;
      const bActive = b.status === "thinking" || b.status === "running" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.startedAtMs - a.startedAtMs;
    });
    return entries;
  }, [agents, now]);

  // When a real agent run appears in runEntries, absorb the matching pending execution
  useEffect(() => {
    setPendingExecutions((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, pending] of next) {
        // If the real agent is now running for the same agentId, mark as absorbed
        const realRunning = runEntries.some(
          (r) =>
            r.status === "thinking" &&
            r.agentId === pending.agentId &&
            Math.abs(r.startedAtMs - pending.startedAtMs) < 30_000
        );
        if (realRunning) {
          next.set(id, { ...pending, absorbed: true });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [runEntries]);

  // When a pending execution has been absorbed for >60s, prune it (run is done)
  useEffect(() => {
    const cutoff = Date.now() - 60_000;
    setPendingExecutions((prev) => {
      const next = new Map(prev);
      for (const [id, p] of next) {
        if (p.absorbed && p.startedAtMs < cutoff) {
          next.delete(id);
        }
      }
      return next.size === next.size ? prev : next;
    });
  }, [now]);

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

  // ── Kanban buckets ────────────────────────────────────────────────────────
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

  // Pending execution entries for the Executing column
  const pendingRunEntries = useMemo(() => {
    return Array.from(pendingExecutions.values());
  }, [pendingExecutions]);

  // ── Drag & drop sensors ─────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Custom collision detection: prefer dropping on column containers over individual items
  const customCollision: CollisionDetection = (args) => {
    // First check if we're over a column zone directly
    const columnIntersect = closestCenter(args);
    // If the closest intersect is a column zone id (not a tile), use it
    return columnIntersect;
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Track which column the drag is over (works for both empty column zones and tile intersections)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      dragOverColumnRef.current = null;
      return;
    }

    const overId = over.id as string;

    // Check if it's a column zone id directly
    if (isColumnId(overId)) {
      dragOverColumnRef.current = overId;
      return;
    }

    // Otherwise it's a tile id — extract column from it
    const parsed = parseTileId(overId);
    if (parsed) {
      dragOverColumnRef.current = parsed.colId;
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      dragOverColumnRef.current = null;

      if (!over) return;

      const activeParsed = parseTileId(active.id as string);
      const targetCol = (() => {
        const overId = over.id as string;
        if (isColumnId(overId)) return overId;
        const parsed = parseTileId(overId);
        return parsed?.colId ?? null;
      })();

      if (!activeParsed || !targetCol) return;
      if (activeParsed.colId === targetCol) return; // same column — no-op

      // Only allow drops into Executing
      if (targetCol !== "executing") return;

      // Only cron job tiles can be dropped (not run tiles)
      if (activeParsed.colId !== "queued" && activeParsed.colId !== "scheduled") return;

      const job = cronJobs.find((j) => j.id === activeParsed.unique);
      if (!job) return;

      const agent = agents.find((a) => a.agentId === job.agentId);
      const agentName = agent?.name ?? job.agentId ?? "Agent";
      const avatarSeed = agent?.avatarSeed;
      const runId = `${job.id}::${Date.now()}`;
      const payloadStr = formatCronPayload(job.payload);

      // Add to pending executions immediately (job shows in Executing right away)
      setPendingExecutions((prev) => {
        const next = new Map(prev);
        next.set(runId, {
          id: runId,
          job,
          agentName,
          agentId: job.agentId ?? "",
          avatarSeed,
          startedAtMs: Date.now(),
          label: job.name,
          payloadPreview: payloadStr,
          absorbed: false,
        });
        return next;
      });

      // Fire the actual API call
      setRunBusy(true);
      try {
        await fetch("/api/cron/run?id=" + encodeURIComponent(job.id), { method: "POST" });
        await fetchCronJobs();
      } catch {
        // Remove pending entry on failure
        setPendingExecutions((prev) => {
          const next = new Map(prev);
          next.delete(runId);
          return next;
        });
      } finally {
        setRunBusy(false);
      }
    },
    [cronJobs, agents, fetchCronJobs]
  );

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

  // ── Active drag overlay ───────────────────────────────────────────────────
  const activeJob = useMemo(() => {
    if (!activeId) return null;
    const parsed = parseTileId(activeId);
    if (!parsed) return null;
    if (parsed.colId === "executing" || parsed.colId === "done") return null;
    return cronJobs.find((j) => j.id === parsed.unique) ?? null;
  }, [activeId]);

  const activeRunEntry = useMemo(() => {
    if (!activeId) return null;
    const parsed = parseTileId(activeId);
    if (!parsed) return null;
    const [agentIdStr, startedAtStr] = parsed.unique.split(":");
    const startedAtMs = Number(startedAtStr);
    if (parsed.colId === "executing") {
      const pending = pendingExecutions.get(parsed.unique);
      if (pending) return { ...pending, status: "running" as const, isPendingExecution: true };
      return executingRuns.find((r) => r.agentId === agentIdStr && r.startedAtMs === startedAtMs) ?? null;
    }
    if (parsed.colId === "done") {
      return doneRuns.find((r) => r.agentId === agentIdStr && r.startedAtMs === startedAtMs) ?? null;
    }
    return null;
  }, [activeId, pendingExecutions, executingRuns, doneRuns]);

  // ── Column config ────────────────────────────────────────────────────────
  const colConfig = [
    {
      id: "queued",
      label: "Queued",
      Icon: Loader,
      accent: "text-purple-400",
      accentBg: "bg-purple-400/10",
      cronItems: scheduledJobs, // scheduled but has nextRunAtMs → shown as queued
      isRun: false,
    },
    {
      id: "scheduled",
      label: "Scheduled",
      Icon: Calendar,
      accent: "text-amber-400",
      accentBg: "bg-amber-400/10",
      cronItems: scheduledJobs.filter((j) => j.state.nextRunAtMs == null || !j.enabled),
      isRun: false,
    },
    {
      id: "executing",
      label: "Executing",
      Icon: Zap,
      accent: "text-blue-400",
      accentBg: "bg-blue-400/10",
      cronItems: [] as CronJobSummary[],
      isRun: true,
    },
    {
      id: "done",
      label: "Done",
      Icon: CheckCircle,
      accent: "text-green-400",
      accentBg: "bg-green-400/10",
      cronItems: doneJobs,
      isRun: true,
    },
  ] as const;

  // The queued bucket should show jobs that have a nextRunAtMs (they're waiting to fire)
  const queuedJobsForDisplay = useMemo(
    () => filteredJobs.filter((j) => j.state.nextRunAtMs != null && j.state.runningAtMs == null),
    [filteredJobs]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
          {/* ── Queued ── */}
          <ColumnZone
            id="queued"
            isDropTarget={dragOverColumnRef.current === "queued"}
          >
            <ColumnHeader label="Queued" Icon={Loader} accent="text-purple-400" count={queuedJobsForDisplay.length} />
            <SortableContext items={queuedJobsForDisplay.map((j) => tileId("queued", j.id))}>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {queuedJobsForDisplay.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">Drag a task here</p>
                ) : (
                  queuedJobsForDisplay.map((job) => {
                    const agent = agents.find((a) => a.agentId === job.agentId);
                    return (
                      <SortableCronJobTile
                        key={tileId("queued", job.id)}
                        id={tileId("queued", job.id)}
                        job={job}
                        agentName={agent?.name ?? job.agentId ?? "Unknown"}
                        agentAvatarSeed={agent?.avatarSeed}
                        onRun={handleRun}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        runBusy={runBusy}
                        deleteBusy={deleteBusy === job.id}
                      />
                    );
                  })
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Scheduled ── */}
          <ColumnZone
            id="scheduled"
            isDropTarget={dragOverColumnRef.current === "scheduled"}
          >
            <ColumnHeader label="Scheduled" Icon={Calendar} accent="text-amber-400" count={scheduledJobs.length} />
            <SortableContext items={scheduledJobs.map((j) => tileId("scheduled", j.id))}>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {scheduledJobs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">No scheduled tasks</p>
                ) : (
                  scheduledJobs.map((job) => {
                    const agent = agents.find((a) => a.agentId === job.agentId);
                    return (
                      <SortableCronJobTile
                        key={tileId("scheduled", job.id)}
                        id={tileId("scheduled", job.id)}
                        job={job}
                        agentName={agent?.name ?? job.agentId ?? "Unknown"}
                        agentAvatarSeed={agent?.avatarSeed}
                        onRun={handleRun}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        runBusy={runBusy}
                        deleteBusy={deleteBusy === job.id}
                      />
                    );
                  })
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Executing ── */}
          <ColumnZone
            id="executing"
            isDropTarget={dragOverColumnRef.current === "executing"}
          >
            <ColumnHeader label="Executing" Icon={Zap} accent="text-blue-400" count={executingRuns.length + pendingRunEntries.length} />
            <SortableContext items={[]}>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {executingRuns.length === 0 && pendingRunEntries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">
                    Drop to run instantly
                  </p>
                ) : (
                  <>
                    {/* Pending executions (triggered by drag) */}
                    {pendingRunEntries.map((p) => (
                      <RunTile
                        key={p.id}
                        agentName={p.agentName}
                        agentId={p.agentId}
                        avatarSeed={p.avatarSeed}
                        status="running"
                        label={p.label}
                        startedAtMs={p.startedAtMs}
                        thinkingMs={Date.now() - p.startedAtMs}
                        streamText={p.payloadPreview}
                        isPendingExecution
                      />
                    ))}
                    {/* Real agent runs */}
                    {executingRuns.map((run) => {
                      const agent = agents.find((a) => a.agentId === run.agentId);
                      return (
                        <RunTile
                          key={`${run.agentId}-${run.startedAtMs}`}
                          agentName={run.agentName}
                          agentId={run.agentId}
                          avatarSeed={agent?.avatarSeed}
                          status={run.status}
                          label={run.label}
                          startedAtMs={run.startedAtMs}
                          thinkingMs={run.thinkingMs}
                          streamText={run.streamText}
                          lastMessage={run.lastMessage}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Done ── */}
          <ColumnZone
            id="done"
            isDropTarget={dragOverColumnRef.current === "done"}
          >
            <ColumnHeader label="Done" Icon={CheckCircle} accent="text-green-400" count={doneRuns.length + doneJobs.length} />
            <SortableContext items={[]}>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {doneRuns.length === 0 && doneJobs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">No completed runs</p>
                ) : (
                  <>
                    {doneJobs.map((job) => {
                      const agent = agents.find((a) => a.agentId === job.agentId);
                      return (
                        <CronJobTile
                          key={`done-job-${job.id}`}
                          job={job}
                          agentName={agent?.name ?? job.agentId ?? "Unknown"}
                          agentAvatarSeed={agent?.avatarSeed}
                          onRun={handleRun}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          runBusy={runBusy}
                          deleteBusy={false}
                        />
                      );
                    })}
                    {doneRuns.map((run) => {
                      const agent = agents.find((a) => a.agentId === run.agentId);
                      return (
                        <RunTile
                          key={`${run.agentId}-${run.startedAtMs}`}
                          agentName={run.agentName}
                          agentId={run.agentId}
                          avatarSeed={agent?.avatarSeed}
                          status={run.status}
                          label={run.label}
                          startedAtMs={run.startedAtMs}
                          endedAtMs={run.endedAtMs}
                          streamText={run.streamText}
                          lastMessage={run.lastMessage}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </SortableContext>
          </ColumnZone>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeJob && (() => {
          const agent = agents.find((a) => a.agentId === activeJob.agentId);
          return (
            <CronJobTile
              job={activeJob}
              agentName={agent?.name ?? activeJob.agentId ?? "Agent"}
              agentAvatarSeed={agent?.avatarSeed}
              onRun={handleRun}
              onToggle={handleToggle}
              onDelete={handleDelete}
              runBusy={runBusy}
              deleteBusy={false}
              isDragOverlay
            />
          );
        })()}
        {activeRunEntry && (
          <RunTile
            {...activeRunEntry}
            avatarSeed={"avatarSeed" in activeRunEntry ? activeRunEntry.avatarSeed : undefined}
            isPendingExecution={"isPendingExecution" in activeRunEntry ? activeRunEntry.isPendingExecution : false}
          />
        )}
      </DragOverlay>

      {/* Create modal */}
      {showCreateModal && (
        <CreateCronModal
          agentId={defaultAgentId}
          agents={agentList}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchCronJobs}
        />
      )}
    </DndContext>
  );
}

// ─── Sortable cron job tile ────────────────────────────────────────────────────

interface SortableCronJobTileProps {
  id: string;
  job: CronJobSummary;
  agentName: string;
  agentAvatarSeed?: string | null;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  runBusy: boolean;
  deleteBusy: boolean;
}

function SortableCronJobTile({
  id,
  job,
  agentName,
  agentAvatarSeed,
  onRun,
  onToggle,
  onDelete,
  runBusy,
  deleteBusy,
}: SortableCronJobTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      <CronJobTile
        job={job}
        agentName={agentName}
        agentAvatarSeed={agentAvatarSeed}
        onRun={onRun}
        onToggle={onToggle}
        onDelete={onDelete}
        runBusy={runBusy}
        deleteBusy={deleteBusy}
      />
    </div>
  );
}
