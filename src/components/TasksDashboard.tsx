"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAgentStore } from "@/features/agents/state/store";
import { TaskBoard } from "@/features/agents/components/TaskBoard";
import {
  sortCronJobsByUpdatedAt,
  formatCronSchedule,
  formatCronPayload,
  type CronJobSummary,
  type CronPriority,
} from "@/lib/cron/types";
import Image from "next/image";
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
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Keyboard,
  LayoutGrid,
  LayoutList,
  Filter,
  X,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Gauge,
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
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";

// ─── Priority ─────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<CronPriority, { label: string; color: string; icon: React.ElementType }> = {
  low: { label: "Low", color: "text-blue-400", icon: ArrowDown },
  normal: { label: "Normal", color: "text-muted-foreground", icon: ArrowUpDown },
  high: { label: "High", color: "text-red-400", icon: ArrowUp },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function agentAvatarSrc(agentId: string, avatarSeed: string | null | undefined) {
  const seed = avatarSeed?.trim() || agentId;
  return buildAvatarDataUrl(seed);
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
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatNextRun(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `in ${d}d ${h % 24}h`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Time grouping ────────────────────────────────────────────────────────────

function getTimeGroup(ms: number): string {
  const now = new Date();
  const then = new Date(ms);
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
}

// ─── Status dot ───────────────────────────────────────────────────────────────

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

// ─── Priority badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: CronPriority }) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;
  return (
    <span className={`flex items-center gap-0.5 text-[9px] font-medium ${config.color}`}>
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

// ─── Pending execution ────────────────────────────────────────────────────────

interface PendingRunEntry {
  id: string;
  job: CronJobSummary;
  agentName: string;
  agentId: string;
  avatarSeed?: string | null;
  startedAtMs: number;
  label: string;
  payloadPreview: string;
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

// ─── Collapsible section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  accent,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-1 py-1 text-left hover:opacity-80"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
          {title}
        </span>
        {!open && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded bg-surface-2 px-1 font-mono text-[10px] text-muted-foreground">
            {count}
          </span>
        )}
      </button>
      {open ? children : null}
    </div>
  );
}

// ─── Cron job tile ────────────────────────────────────────────────────────────

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
  compact?: boolean;
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
  compact = false,
}: CronJobTileProps) {
  const state = job.state;
  const avatarUrl = agentAvatarSrc(job.agentId ?? agentName, agentAvatarSeed);
  const priority = job.priority ?? "normal";

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
          ? "border-accent shadow-lg ring-1 ring-accent/30"
          : "border-border hover:border-accent/40 hover:bg-surface-2/30"
      }`}
    >
      {/* Header: agent avatar + name + priority */}
      <div className="mb-2 flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground" />
        <Image
          src={avatarUrl}
          alt={agentName}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full bg-surface-2 ring-1 ring-accent"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{job.name}</p>
            <PriorityBadge priority={priority} />
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{agentName}</p>
        </div>
        <StatusDot color={dot} pulse={!!state.runningAtMs} />
      </div>

      {!compact && (
        <>
          <p className="mb-1 flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            {scheduleStr}
          </p>

          {payloadStr && (
            <p className="mb-2 line-clamp-2 text-xs text-muted-foreground/80">{payloadStr}</p>
          )}
        </>
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
      {!compact && (
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
      )}
    </div>
  );
}

// ─── Run tile ─────────────────────────────────────────────────────────────────

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
  compact?: boolean;
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
  compact = false,
}: RunTileProps) {
  const durationMs = endedAtMs ? endedAtMs - startedAtMs : null;
  const dot = dotColors[status] ?? "bg-neutral-400";
  const Icon = status === "completed" ? CheckCircle : status === "failed" ? XCircle : Activity;
  const avatarUrl = agentAvatarSrc(agentId, avatarSeed);

  return (
    <div
      className={`rounded-xl border bg-surface-1 p-3 shadow-sm transition-all ${
        isDragOverlay
          ? "border-accent shadow-lg ring-1 ring-accent/30"
          : isPendingExecution
            ? "border-accent/40 bg-surface-2/30"
            : "border-border hover:border-accent/40 hover:bg-surface-2/30"
      }`}
    >
      {/* Agent avatar + name + status */}
      <div className="mb-2 flex items-center gap-2">
        <Image
          src={avatarUrl}
          alt={agentName}
          width={32}
          height={32}
          className={`h-8 w-8 shrink-0 rounded-full bg-surface-2 ring-1 ring-accent ${isPendingExecution ? "ring-primary/50" : ""}`}
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{agentName}</p>
        </div>
        <StatusDot color={dot} pulse={status === "thinking" || status === "running"} />
      </div>

      {!compact && (
        <>
          {(streamText || lastMessage) && (
            <p className="mb-2 line-clamp-2 font-mono text-xs text-muted-foreground/70">
              {streamText ?? lastMessage}
            </p>
          )}

          {thinkingMs !== null && thinkingMs !== undefined && (
            <p className="mb-1 flex items-center gap-1 text-[10px] text-blue-400">
              <Activity className="h-3 w-3" />
              thinking {formatDuration(thinkingMs)}
            </p>
          )}
        </>
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

// ─── Column zone ─────────────────────────────────────────────────────────────

interface ColumnZoneProps {
  id: string;
  isDropTarget: boolean;
  wipLimit?: number;
  count: number;
  children: React.ReactNode;
}

function ColumnZone({ id, isDropTarget, wipLimit, count, children }: ColumnZoneProps) {
  const wipExceeded = wipLimit != null && count > wipLimit;

  return (
    <div
      data-column={id}
      className={`flex min-w-[240px] flex-1 flex-col rounded-2xl border p-3 transition-all ${
        isDropTarget
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 ring-offset-1 ring-offset-transparent"
          : wipExceeded
            ? "border-red-500/50 bg-red-500/5"
            : "border-border bg-surface-1"
      }`}
    >
      {children}

      {wipExceeded && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          WIP limit ({wipLimit}) exceeded
        </div>
      )}
    </div>
  );
}

// ─── Column header ─────────────────────────────────────────────────────────────

function ColumnHeader({
  label,
  Icon,
  accent,
  count,
  wipLimit,
}: {
  label: string;
  Icon: React.ElementType;
  accent: string;
  count: number;
  wipLimit?: number;
}) {
  const wipExceeded = wipLimit != null && count > wipLimit;

  return (
    <div className="mb-3 flex flex-col items-center gap-1">
      <div className={`flex items-center gap-1.5 ${accent}`}>
        <Icon className="h-5 w-5" />
        <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-2 font-mono text-xs ${wipExceeded ? "text-red-400" : "text-muted-foreground"}`}>
          {count}
        </span>
        {wipLimit != null && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Gauge className="h-3 w-3" />
            {wipLimit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Agent filter chips ───────────────────────────────────────────────────────

function AgentFilterChips({
  agents,
  selected,
  onToggle,
}: {
  agents: { agentId: string; name: string; avatarSeed?: string | null }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (agents.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Filter className="h-3 w-3" />
        Agent:
      </span>
      {agents.map((agent) => {
        const active = selected.size === 0 || selected.has(agent.agentId);
        return (
          <button
            key={agent.agentId}
            type="button"
            onClick={() => onToggle(agent.agentId)}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-all ${
              active
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border bg-surface-2 text-muted-foreground hover:border-border/80"
            }`}
          >
            <Image
              src={agentAvatarSrc(agent.agentId, agent.avatarSeed)}
              alt={agent.name}
              width={14}
              height={14}
              className="h-3.5 w-3.5 rounded-full bg-surface-2"
              unoptimized
            />
            {agent.name}
            {selected.size > 0 && !active && <X className="h-2.5 w-2.5" />}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={() => onToggle("__all__")}
          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-border/80"
        >
          <X className="h-2.5 w-2.5" />
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Keyboard shortcut hint ───────────────────────────────────────────────────

function Kbd({ children }: { children?: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono text-[9px] text-muted-foreground">
      {children}
    </kbd>
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
  const [priority, setPriority] = useState<CronPriority>("normal");
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
        body: JSON.stringify({ name: name.trim(), agentId: agentId || undefined, everyMs, message: message.trim(), priority }),
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

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Run every</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  className="w-20 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  value={everyValue}
                  onChange={(e) => setEveryValue(e.target.value)}
                />
                <select
                  className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  value={everyUnit}
                  onChange={(e) => setEveryUnit(e.target.value as "s" | "m" | "h")}
                >
                  <option value="s">seconds</option>
                  <option value="m">minutes</option>
                  <option value="h">hours</option>
                </select>
              </div>
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
              <select
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value as CronPriority)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
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

// ─── Task detail panel ────────────────────────────────────────────────────────

function TaskDetailPanel({
  job,
  agentName,
  onClose,
  onRun,
  onToggle,
  onDelete,
  runBusy,
  deleteBusy,
}: {
  job: CronJobSummary;
  agentName: string;
  onClose: () => void;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  runBusy: boolean;
  deleteBusy: boolean;
}) {
  const state = job.state;
  const scheduleStr = formatCronSchedule(job.schedule);
  const payloadStr = formatCronPayload(job.payload);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Image
              src={agentAvatarSrc(job.agentId ?? agentName, undefined)}
              alt={agentName}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full bg-surface-2 ring-1 ring-accent"
              unoptimized
            />
            <div>
              <h3 className="font-semibold text-foreground">{job.name}</h3>
              <p className="text-xs text-muted-foreground">{agentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Schedule</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{scheduleStr}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority</p>
              <p className="mt-0.5 text-sm text-foreground capitalize">{job.priority ?? "normal"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="mt-0.5 text-sm text-foreground">
                {!job.enabled ? "Paused" : state.runningAtMs ? "Running" : "Active"}
              </p>
            </div>
            {state.lastRunAtMs && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Run</p>
                <p className="mt-0.5 text-sm text-foreground">
                  {formatRelative(state.lastRunAtMs)} · {formatDuration(state.lastDurationMs ?? 0)}
                </p>
              </div>
            )}
            {state.nextRunAtMs && job.enabled && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Run</p>
                <p className="mt-0.5 text-sm text-foreground">{formatNextRun(state.nextRunAtMs)}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prompt</p>
            <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground">
              {payloadStr}
            </p>
          </div>

          {state.lastError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-red-400">Last Error</p>
              <p className="mt-1 text-xs text-red-300">{state.lastError}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          {job.enabled ? (
            <button
              onClick={() => onToggle(job.id, false)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm text-foreground hover:bg-surface-3"
            >
              <Pause className="h-4 w-4" /> Pause
            </button>
          ) : (
            <button
              onClick={() => onToggle(job.id, true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm text-foreground hover:bg-surface-3"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
          )}
          <button
            onClick={() => onRun(job.id)}
            disabled={runBusy || !job.enabled}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Run Now
          </button>
          <button
            onClick={() => { onDelete(job.id); onClose(); }}
            disabled={deleteBusy}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tasks Dashboard ─────────────────────────────────────────────────────

const WIP_LIMIT_EXECUTING = 5;

export function TasksDashboard() {
  const { state } = useAgentStore();
  const agents = state.agents;

  const [cronJobs, setCronJobs] = useState<CronJobSummary[]>([]);
  const [runBusy, setRunBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [compactView, setCompactView] = useState(false);
  const [tasksView, setTasksView] = useState<"scheduled" | "board">("scheduled");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const [expandedTask, setExpandedTask] = useState<CronJobSummary | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<CronPriority | null>(null);
  const [prioritySort, setPrioritySort] = useState(false);
  const [pendingExecutions, setPendingExecutions] = useState<Map<string, PendingRunEntry>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragOverColumnRef = useRef<string | null>(null);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  // Pause when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setAutoRefresh(false);
      } else {
        setAutoRefresh(true);
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { setShowKeyboardHint((v) => !v); return; }
      if (e.key === "Escape") { setExpandedTask(null); setShowCreateModal(false); setShowKeyboardHint(false); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  // ── Fetch cron jobs ───────────────────────────────────────────────────────
  const fetchCronJobs = useMemo(() => async () => {
    try {
      const res = await fetch("/api/cron/jobs");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCronJobs(sortCronJobsByUpdatedAt(data.jobs ?? []));
    } catch { /* silently skip */ }
  }, []);

  useEffect(() => { void fetchCronJobs(); }, [fetchCronJobs]);

  // ── Build run entries from agent state ──────────────────────────────────
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

  // ── Filter jobs by agent + priority + search ────────────────────────────
  const filteredJobs = useMemo(() => {
    let jobs = cronJobs;
    if (selectedAgentIds.size > 0) {
      jobs = jobs.filter((j) => selectedAgentIds.has(j.agentId ?? ""));
    }
    if (selectedPriority != null) {
      jobs = jobs.filter((j) => (j.priority ?? "normal") === selectedPriority);
    }
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        formatCronPayload(j.payload).toLowerCase().includes(q) ||
        j.agentId?.toLowerCase().includes(q)
    );
  }, [cronJobs, search, selectedAgentIds, selectedPriority]);

  // ── Priority sort ────────────────────────────────────────────────────────
  const sortedFilteredJobs = useMemo(() => {
    if (!prioritySort) return filteredJobs;
    const order: Record<CronPriority, number> = { high: 0, normal: 1, low: 2 };
    return [...filteredJobs].sort((a, b) =>
      (order[a.priority ?? "normal"] - order[b.priority ?? "normal"])
    );
  }, [filteredJobs, prioritySort]);

  // ── Filter runs ──────────────────────────────────────────────────────────
  const filteredRuns = useMemo(() => {
    let runs = runEntries;
    if (selectedAgentIds.size > 0) {
      runs = runs.filter((r) => selectedAgentIds.has(r.agentId));
    }
    if (!search.trim()) return runs;
    const q = search.toLowerCase();
    return runs.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q) ||
        r.lastMessage?.toLowerCase().includes(q)
    );
  }, [runEntries, search, selectedAgentIds]);

  // ── Kanban buckets ───────────────────────────────────────────────────────
  const queuedJobs = useMemo(
    () => sortedFilteredJobs.filter((j) => j.state.nextRunAtMs != null && j.state.runningAtMs == null),
    [sortedFilteredJobs]
  );

  const scheduledJobs = useMemo(
    () => sortedFilteredJobs.filter(
      (j) => j.state.runningAtMs == null && (j.state.nextRunAtMs == null || !j.enabled)
    ),
    [sortedFilteredJobs]
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
    () => sortedFilteredJobs.filter((j) => j.state.lastRunAtMs != null && j.state.runningAtMs == null),
    [sortedFilteredJobs]
  );

  const pendingRunEntries = useMemo(() => Array.from(pendingExecutions.values()), [pendingExecutions]);

  // ── Time groups for Done ────────────────────────────────────────────────
  const doneTimeGroups = useMemo(() => {
    const groups: { label: string; items: typeof doneRuns }[] = [];
    const groupMap = new Map<string, typeof doneRuns>();
    const order = ["Today", "Yesterday", "This Week", "This Month", "Older"];

    for (const run of doneRuns) {
      const label = getTimeGroup(run.startedAtMs);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(run);
    }

    for (const label of order) {
      const items = groupMap.get(label);
      if (items?.length) groups.push({ label, items });
    }
    return groups;
  }, [doneRuns]);

  // ── Absorb pending executions ─────────────────────────────────────────────
  useEffect(() => {
    setPendingExecutions((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, pending] of next) {
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

  // ── Prune stale pending executions ───────────────────────────────────────
  useEffect(() => {
    const cutoff = Date.now() - 60_000;
    setPendingExecutions((prev) => {
      const next = new Map(prev);
      for (const [id, p] of next) {
        if (p.absorbed && p.startedAtMs < cutoff) next.delete(id);
      }
      return next;
    });
  }, [now]);

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const customCollision: CollisionDetection = (args) => closestCenter(args);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) { dragOverColumnRef.current = null; return; }
    const overId = over.id as string;
    if (isColumnId(overId)) { dragOverColumnRef.current = overId; return; }
    const parsed = parseTileId(overId);
    if (parsed) dragOverColumnRef.current = parsed.colId;
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
        return parseTileId(overId)?.colId ?? null;
      })();

      if (!activeParsed || !targetCol) return;
      if (activeParsed.colId === targetCol) return;
      if (targetCol !== "executing") return;
      if (activeParsed.colId !== "queued" && activeParsed.colId !== "scheduled") return;

      const job = cronJobs.find((j) => j.id === activeParsed.unique);
      if (!job) return;

      const agent = agents.find((a) => a.agentId === job.agentId);
      const agentName = agent?.name ?? job.agentId ?? "Agent";
      const avatarSeed = agent?.avatarSeed;
      const runId = `${job.id}::${Date.now()}`;
      const payloadStr = formatCronPayload(job.payload);

      setPendingExecutions((prev) => {
        const next = new Map(prev);
        next.set(runId, {
          id: runId, job, agentName, agentId: job.agentId ?? "",
          avatarSeed, startedAtMs: Date.now(),
          label: job.name, payloadPreview: payloadStr, absorbed: false,
        });
        return next;
      });

      setRunBusy(true);
      try {
        await fetch("/api/cron/run?id=" + encodeURIComponent(job.id), { method: "POST" });
        await fetchCronJobs();
      } catch {
        setPendingExecutions((prev) => { const next = new Map(prev); next.delete(runId); return next; });
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
    } catch {} finally {
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

  const agentList = agents.map((a) => ({ agentId: a.agentId, name: a.name, avatarSeed: a.avatarSeed }));
  const defaultAgentId = agents[0]?.agentId ?? "";

  // ── Active drag overlay ───────────────────────────────────────────────────
  const activeJob = useMemo(() => {
    if (!activeId) return null;
    const parsed = parseTileId(activeId);
    if (!parsed) return null;
    if (parsed.colId === "executing" || parsed.colId === "done") return null;
    return cronJobs.find((j) => j.id === parsed.unique) ?? null;
  }, [activeId, cronJobs]);

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

  // ── Agent toggle ─────────────────────────────────────────────────────────
  const handleAgentToggle = (agentId: string) => {
    if (agentId === "__all__") { setSelectedAgentIds(new Set()); return; }
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const taskCount = cronJobs.length;
  const activeCount = executingRuns.length + pendingRunEntries.length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              placeholder="Search tasks and schedules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {taskCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {taskCount} task{taskCount !== 1 ? "s" : ""}
                {activeCount > 0 && <span className="ml-1 text-blue-400">· {activeCount} active</span>}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <AgentFilterChips
              agents={agentList}
              selected={selectedAgentIds}
              onToggle={handleAgentToggle}
            />

            <div className="flex items-center gap-1">
              {/* Priority filter */}
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                {(["high", "normal", "low"] as CronPriority[]).map((p) => {
                  const Icon = PRIORITY_CONFIG[p].icon;
                  const color = PRIORITY_CONFIG[p].color;
                  const active = selectedPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPriority(active ? null : p)}
                      title={`${p} priority`}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-all ${
                        active ? `bg-surface-2 font-semibold ${color}` : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
                {prioritySort && (
                  <button
                    type="button"
                    onClick={() => setPrioritySort(false)}
                    title="Clear priority sort"
                    className="rounded px-1 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {!prioritySort && selectedPriority && (
                  <button
                    type="button"
                    onClick={() => setPrioritySort(true)}
                    title="Sort by priority"
                    className="rounded px-1 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCompactView((v) => !v)}
                title={compactView ? "Normal view" : "Compact view"}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              >
                {compactView ? <LayoutList className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
                className={`flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground ${!autoRefresh ? "text-amber-400" : ""}`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
              </button>

              {/* View toggle: Tasks Board vs Scheduled */}
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setTasksView("scheduled")}
                  title="Scheduled Tasks view"
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-all ${
                    tasksView === "scheduled" ? "bg-surface-2 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  Scheduled
                </button>
                <button
                  type="button"
                  onClick={() => setTasksView("board")}
                  title="Task Board view"
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-all ${
                    tasksView === "board" ? "bg-surface-2 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" />
                  Board
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowKeyboardHint((v) => !v)}
                title="Keyboard shortcuts"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                New Task
              </button>
            </div>
          </div>
        </div>

        {/* ── Keyboard shortcut hint bar ── */}
        {showKeyboardHint && (
          <div className="flex flex-wrap items-center justify-center gap-4 border-b border-border bg-surface-2/50 px-4 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Kbd /> Shortcuts</span>
            <span className="flex items-center gap-1"><Kbd /> Esc Close</span>
            <span className="flex items-center gap-1"><Kbd /> / Search</span>
          </div>
        )}

        {/* ── Task Board View ── */}
        {tasksView === "board" ? (
          <TaskBoard agents={agentList.map((a) => ({ agentId: a.agentId, name: a.name }))} />
        ) : (
          <>
        {/* ── Kanban columns ── */}
        <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4">

          {/* ── Queued ── */}
          <ColumnZone id="queued" isDropTarget={dragOverColumnRef.current === "queued"} count={queuedJobs.length}>
            <ColumnHeader label="Queued" Icon={Loader} accent="text-purple-400" count={queuedJobs.length} />
            <SortableContext items={queuedJobs.map((j) => tileId("queued", j.id))}>
              <div className="space-y-2">
                {queuedJobs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">Drag a task here</p>
                ) : (
                  queuedJobs.map((job) => {
                    const agent = agents.find((a) => a.agentId === job.agentId);
                    return (
                      <div key={tileId("queued", job.id)} onClick={() => setExpandedTask(job)} className={compactView ? "scale-95" : ""}>
                        <SortableCronJobTile
                          id={tileId("queued", job.id)}
                          job={job}
                          agentName={agent?.name ?? job.agentId ?? "Unknown"}
                          agentAvatarSeed={agent?.avatarSeed}
                          onRun={handleRun}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          runBusy={runBusy}
                          deleteBusy={deleteBusy === job.id}
                          compact={compactView}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Scheduled ── */}
          <ColumnZone id="scheduled" isDropTarget={dragOverColumnRef.current === "scheduled"} count={scheduledJobs.length}>
            <ColumnHeader label="Scheduled" Icon={Calendar} accent="text-amber-400" count={scheduledJobs.length} />
            <SortableContext items={scheduledJobs.map((j) => tileId("scheduled", j.id))}>
              <div className="space-y-2">
                {scheduledJobs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">No scheduled tasks</p>
                ) : (
                  scheduledJobs.map((job) => {
                    const agent = agents.find((a) => a.agentId === job.agentId);
                    return (
                      <div key={tileId("scheduled", job.id)} onClick={() => setExpandedTask(job)} className={compactView ? "scale-95" : ""}>
                        <SortableCronJobTile
                          id={tileId("scheduled", job.id)}
                          job={job}
                          agentName={agent?.name ?? job.agentId ?? "Unknown"}
                          agentAvatarSeed={agent?.avatarSeed}
                          onRun={handleRun}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          runBusy={runBusy}
                          deleteBusy={deleteBusy === job.id}
                          compact={compactView}
                        />
                      </div>
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
            wipLimit={WIP_LIMIT_EXECUTING}
            count={executingRuns.length + pendingRunEntries.length}
          >
            <ColumnHeader
              label="Executing"
              Icon={Zap}
              accent="text-blue-400"
              count={executingRuns.length + pendingRunEntries.length}
              wipLimit={WIP_LIMIT_EXECUTING}
            />
            <SortableContext items={[]}>
              <div className="space-y-2">
                {executingRuns.length === 0 && pendingRunEntries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">Drop to run instantly</p>
                ) : (
                  <>
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
                        compact={compactView}
                      />
                    ))}
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
                          compact={compactView}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Done ── */}
          <ColumnZone id="done" isDropTarget={dragOverColumnRef.current === "done"} count={doneRuns.length + doneJobs.length}>
            <ColumnHeader label="Done" Icon={CheckCircle} accent="text-green-400" count={doneRuns.length + doneJobs.length} />
            <SortableContext items={[]}>
              <div className="space-y-3">
                {doneJobs.length > 0 && (
                  <CollapsibleSection title="Tasks" icon={Calendar} accent="text-muted-foreground" count={doneJobs.length}>
                    <div className="space-y-2">
                      {doneJobs.map((job) => {
                        const agent = agents.find((a) => a.agentId === job.agentId);
                        return (
                          <div key={`done-job-${job.id}`} onClick={() => setExpandedTask(job)} className={compactView ? "scale-95" : ""}>
                            <CronJobTile
                              job={job}
                              agentName={agent?.name ?? job.agentId ?? "Unknown"}
                              agentAvatarSeed={agent?.avatarSeed}
                              onRun={handleRun}
                              onToggle={handleToggle}
                              onDelete={handleDelete}
                              runBusy={runBusy}
                              deleteBusy={false}
                              compact={compactView}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                )}

                {doneTimeGroups.map((group) => (
                  <CollapsibleSection
                    key={group.label}
                    title={group.label}
                    icon={Clock}
                    accent="text-muted-foreground"
                    count={group.items.length}
                    defaultOpen={group.label === "Today" || group.label === "Yesterday"}
                  >
                    <div className="space-y-2">
                      {group.items.map((run) => {
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
                            compact={compactView}
                          />
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                ))}

                {doneRuns.length === 0 && doneJobs.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">No completed runs</p>
                )}
              </div>
            </SortableContext>
          </ColumnZone>
        </div>
          </>
        )}

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
              compact={compactView}
            />
          );
        })()}
        {activeRunEntry && (
          <RunTile
            {...activeRunEntry}
            avatarSeed={"avatarSeed" in activeRunEntry ? activeRunEntry.avatarSeed : undefined}
            isPendingExecution={"isPendingExecution" in activeRunEntry ? activeRunEntry.isPendingExecution : false}
            compact={compactView}
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

      {/* Task detail panel */}
      {expandedTask && (() => {
        const agent = agents.find((a) => a.agentId === expandedTask.agentId);
        return (
          <TaskDetailPanel
            job={expandedTask}
            agentName={agent?.name ?? expandedTask.agentId ?? "Unknown"}
            onClose={() => setExpandedTask(null)}
            onRun={handleRun}
            onToggle={handleToggle}
            onDelete={handleDelete}
            runBusy={runBusy}
            deleteBusy={deleteBusy != null}
          />
        );
      })()}
      </div>
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
  compact?: boolean;
}

function SortableCronJobTile({
  id, job, agentName, agentAvatarSeed, onRun, onToggle, onDelete, runBusy, deleteBusy, compact,
}: SortableCronJobTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

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
        compact={compact}
      />
    </div>
  );
}
