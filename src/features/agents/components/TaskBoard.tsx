"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  X,
  MoreHorizontal,
  Calendar,
  Tag,
  Link2,
  FileText,
  Play,
  Pause,
  Check,
  XCircle,
  Loader,
  Zap,
  Gauge,
  Activity,
  GripVertical,
  Filter,
  ArrowUpDown as SortIcon,
  CalendarClock,
  Repeat,
} from "lucide-react";
import Image from "next/image";
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
import { useAgentStore } from "@/features/agents/state/store";
import type { CronJobSummary } from "@/lib/cron/types";
import { formatCronSchedule, sortCronJobsByUpdatedAt } from "@/lib/cron/types";
import type {
  Task,
  TaskStage,
  TaskPriority,
  PendingReason,
  ResolutionType,
} from "@/lib/tasks/types";
import {
  getPriorityLabel,
  getPendingReasonLabel,
  getResolutionLabel,
} from "@/lib/tasks/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const WIP_LIMIT_EXECUTING = 3;

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  low: { label: "Low", color: "text-blue-400", bgColor: "bg-blue-400/10", icon: ArrowDown },
  normal: { label: "Normal", color: "text-muted-foreground", bgColor: "bg-muted/10", icon: ArrowUpDown },
  high: { label: "High", color: "text-red-400", bgColor: "bg-red-400/10", icon: ArrowUp },
  urgent: { label: "Urgent", color: "text-orange-400", bgColor: "bg-orange-400/10", icon: AlertTriangle },
};

const STAGE_CONFIG: Record<TaskStage, { label: string; color: string; bgColor: string; accentColor: string; icon: React.ElementType }> = {
  QUEUE: { label: "Queue", color: "text-purple-400", bgColor: "bg-purple-400/10", accentColor: "border-purple-500/30", icon: Loader },
  EXECUTING: { label: "Executing", color: "text-blue-400", bgColor: "bg-blue-400/10", accentColor: "border-blue-500/30", icon: Zap },
  PENDING: { label: "Pending", color: "text-amber-400", bgColor: "bg-amber-400/10", accentColor: "border-amber-500/30", icon: AlertTriangle },
  COMPLETED: { label: "Done", color: "text-green-400", bgColor: "bg-green-400/10", accentColor: "border-green-500/30", icon: CheckCircle },
};

const PENDING_REASON_OPTIONS: { value: PendingReason; label: string }[] = [
  { value: "awaiting_review", label: "Awaiting Review" },
  { value: "awaiting_dependency", label: "Awaiting Dependency" },
  { value: "awaiting_information", label: "Awaiting Information" },
  { value: "time_exceeded", label: "Time Exceeded" },
  { value: "agent_blocked", label: "Agent Blocked" },
];

const RESOLUTION_OPTIONS: { value: ResolutionType; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "approved_with_notes", label: "Approved with Notes" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

// ─── Time formatting ─────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return "—";
  return formatDuration(Date.now() - new Date(startedAt).getTime());
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

function AgentAvatar({ agentId, size = 24, className = "" }: { agentId: string | null | undefined; size?: number; className?: string }) {
  const seed = agentId ?? "unassigned";
  const avatarUrl = buildAvatarDataUrl(seed);
  return (
    <Image
      src={avatarUrl}
      alt={agentId ?? "Unassigned"}
      width={size}
      height={size}
      className={`rounded-full bg-surface-2 ring-1 ring-accent/50 shrink-0 ${className}`}
      unoptimized
    />
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${config.color} ${config.bgColor}`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

const dotColors: Record<string, string> = {
  thinking: "bg-blue-400 animate-pulse",
  running: "bg-blue-500 animate-pulse",
  completed: "bg-green-500",
  failed: "bg-red-500",
  scheduled: "bg-amber-500",
  idle: "bg-neutral-300",
};

function StatusDot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

// ─── Column Zone ──────────────────────────────────────────────────────────────

interface ColumnZoneProps {
  id: string;
  isDropTarget: boolean;
  wipLimit?: number;
  count: number;
  children: React.ReactNode;
  className?: string;
}

function ColumnZone({ id, isDropTarget, wipLimit, count, children, className = "" }: ColumnZoneProps) {
  const wipExceeded = wipLimit != null && count > wipLimit;

  return (
    <div
      data-column={id}
      className={`flex min-w-0 flex-1 flex-col rounded-2xl border p-3 transition-all ${className} ${
        isDropTarget
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
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

// ─── Column Header ────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  label: string;
  Icon: React.ElementType;
  accent: string;
  count: number;
  wipLimit?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

function ColumnHeader({ label, Icon, accent, count, wipLimit, collapsed, onToggle }: ColumnHeaderProps) {
  const wipExceeded = wipLimit != null && count > wipLimit;
  return (
    <div className="mb-3 flex flex-col items-center gap-1.5 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <Icon className={`h-5 w-5 shrink-0 ${accent}`} />
        <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-0.5 hover:bg-surface-2"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-2 px-1.5 font-mono text-xs ${wipExceeded ? "text-red-400" : "text-muted-foreground"}`}>
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

// ─── Collapsible Section ─────────────────────────────────────────────────────

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

// ─── Cron Job Card ──────────────────────────────────────────────────────────

function formatNextRun(schedule: { kind: string; everyMs?: number; at?: string }): string {
  if (schedule.kind === "every" && schedule.everyMs) {
    const ms = schedule.everyMs;
    if (ms >= 3600000) return `Every ${ms / 3600000}h`;
    if (ms >= 60000) return `Every ${ms / 60000}m`;
    return `Every ${ms / 1000}s`;
  }
  if (schedule.kind === "cron" && schedule.at) return `Cron: ${schedule.at}`;
  return "—";
}

interface CronJobCardProps {
  job: CronJobSummary;
  onRun: (job: CronJobSummary) => void;
  onDelete: (job: CronJobSummary) => void;
  onSelect?: (job: CronJobSummary) => void;
  compact?: boolean;
}

function CronJobCard({ job, onRun, onDelete, compact = false }: CronJobCardProps) {
  const { state } = useAgentStore();
  const storeAgents = state.agents;
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scheduleStr = formatNextRun(job.schedule as { kind: string; everyMs?: number; at?: string });
  const agent = storeAgents.find((a) => a.agentId === job.agentId);
  const isDisabled = !job.enabled;

  return (
    <div
      className={`group relative rounded-xl border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30 ${
        isDisabled ? "opacity-50" : "border-amber-500/20"
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-0.5 shrink-0 cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">{job.id.slice(0, 8)}</span>
            {isDisabled && (
              <span className="rounded-full bg-neutral-500/10 px-1.5 py-0.5 text-[10px] text-neutral-400">Disabled</span>
            )}
          </div>
          <h4
            className="mt-1 flex items-center gap-1 truncate text-sm font-semibold text-foreground"
          >
            <span className="truncate">{job.name}</span>
            {/* Expand/collapse */}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="shrink-0 rounded p-0.5 hover:bg-surface-2"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </h4>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Collapsed: compact meta */}
      {!expanded && (
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{scheduleStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AgentAvatar agentId={job.agentId} size={14} />
            <span className="truncate">{agent?.name ?? job.agentId ?? "Unassigned"}</span>
          </div>
        </div>
      )}

      {/* Expanded: full details */}
      {expanded && !compact && (
        <div className="space-y-2 text-[10px] text-muted-foreground">
          {job.description && (
            <p className="whitespace-pre-wrap">{job.description}</p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <span className="text-muted-foreground/60">Agent:</span>{" "}
              <span className="flex items-center gap-1">
                <AgentAvatar agentId={job.agentId} size={12} />
                {agent?.name ?? job.agentId ?? "Unassigned"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Updated:</span>{" "}
              {formatRelative(new Date(job.updatedAtMs).toISOString())}
            </div>
            <div>
              <span className="text-muted-foreground/60">Last run:</span>{" "}
              {job.state?.lastRunAtMs
                ? formatRelative(new Date(job.state.lastRunAtMs).toISOString())
                : "Never"}
            </div>
            <div>
              <span className="text-muted-foreground/60">Status:</span>{" "}
              <span className={job.state?.lastStatus === "ok" ? "text-green-400" : job.state?.lastStatus === "error" ? "text-red-400" : "text-muted-foreground"}>
                {job.state?.lastStatus ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Next run:</span>{" "}
              {job.state?.nextRunAtMs
                ? new Date(job.state.nextRunAtMs).toLocaleString()
                : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!isDisabled && (
        <button
          onClick={(e) => { e.stopPropagation(); onRun(job); }}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20"
        >
          <Zap className="h-3 w-3" />
          Run now
        </button>
      )}

      {/* Context menu */}
      {menuOpen && (
        <div className="absolute right-2 top-8 z-10 mt-1 w-36 rounded-xl border border-border bg-surface-1 p-1 shadow-lg">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(job); setMenuOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-surface-2"
          >
            <XCircle className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Run Tile (live execution runs) ─────────────────────────────────────────

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
  isPendingExecution?: boolean;
  compact?: boolean;
  isDragOverlay?: boolean;
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
  isPendingExecution,
  compact = false,
  isDragOverlay,
}: RunTileProps) {
  const durationMs = endedAtMs ? endedAtMs - startedAtMs : null;
  const dot = dotColors[status] ?? "bg-neutral-400";
  const Icon = status === "completed" ? CheckCircle : status === "failed" ? XCircle : Activity;
  const avatarUrl = buildAvatarDataUrl(avatarSeed ?? agentId);

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
      {/* Header: agent avatar + name + status */}
      <div className="mb-2 flex items-center gap-2">
        <AgentAvatar agentId={avatarSeed ?? agentId} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{agentName}</p>
        </div>
        <StatusDot color={dot} />
      </div>

      {!compact && (
        <>
          {(streamText || lastMessage) && (
            <p className="mb-2 line-clamp-2 font-mono text-xs text-muted-foreground/70">
              {streamText ?? lastMessage}
            </p>
          )}

          {thinkingMs !== null && thinkingMs !== undefined && thinkingMs > 0 && (
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
            {formatRelative(new Date(startedAtMs).toISOString())}
          </span>
        )}
        <span className="font-mono">{formatTime(new Date(startedAtMs).toISOString())}</span>
        {isPendingExecution && (
          <span className="ml-auto rounded bg-blue-500/20 px-1.5 py-0.5 text-blue-400">
            <Zap className="mr-0.5 inline h-2.5 w-2.5" />
            Triggered
          </span>
        )}
        {status === "failed" && <span className="ml-auto text-red-400">Failed</span>}
        {status === "completed" && <span className="ml-auto text-green-400">Done</span>}
      </div>
    </div>
  );
}

// ─── Task Card (Sortable) ─────────────────────────────────────────────────────

interface SortableTaskCardProps {
  id: string;
  task: Task;
  onSelect: (task: Task) => void;
  onStart?: (task: Task) => void;
  onPending?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  onRevise?: (task: Task) => void;
  compact?: boolean;
  isDragOverlay?: boolean;
}

function SortableTaskCard({ id, task, onSelect, onStart, onPending, onComplete, onRevise, compact = false, isDragOverlay = false }: SortableTaskCardProps) {
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
      className={`group relative ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        onSelect={onSelect}
        onStart={onStart}
        onPending={onPending}
        onComplete={onComplete}
        onRevise={onRevise}
        compact={compact}
        isDragOverlay={isDragOverlay}
      />
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
  onStart?: (task: Task) => void;
  onPending?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  onRevise?: (task: Task) => void;
  compact?: boolean;
  isDragOverlay?: boolean;
}

function TaskCard({ task, onSelect, onStart, onPending, onComplete, onRevise, compact = false, isDragOverlay = false }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isExecuting = task.stage === "EXECUTING";
  const isPending = task.stage === "PENDING";
  const isCompleted = task.stage === "COMPLETED";
  const isQueue = task.stage === "QUEUE";

  const config = STAGE_CONFIG[task.stage];

  return (
    <div
      className={`group relative rounded-xl border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30 ${
        isDragOverlay
          ? "border-accent shadow-lg ring-1 ring-accent/30"
          : config.accentColor
      } ${isExecuting ? "border-blue-500/40 bg-blue-500/5" : ""} ${
        isPending ? "border-amber-500/40 bg-amber-500/5" : ""
      } ${isCompleted ? "opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-0.5 shrink-0 cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">{task.id}</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <h4
            className="mt-1 flex items-center gap-1 truncate text-sm font-semibold text-foreground cursor-pointer hover:text-primary"
            onClick={() => onSelect(task)}
          >
            <span className="truncate">{task.title}</span>
            {/* Expand/collapse toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="shrink-0 rounded p-0.5 hover:bg-surface-2"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </h4>
        </div>

        {/* Menu button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Running indicator */}
      {isExecuting && task.startedAt && (
        <div className="absolute inset-x-0 top-0 flex items-center gap-1 rounded-t-xl bg-blue-500/10 px-3 py-1">
          <Loader className="h-3 w-3 animate-spin text-blue-400" />
          <span className="text-[10px] font-medium text-blue-400">
            Running {formatElapsed(task.startedAt)}
          </span>
        </div>
      )}

      {/* Expanded: full task details */}
      {expanded && !compact && (
        <div className="space-y-2 text-[10px] text-muted-foreground">
          {/* Description */}
          {task.description && (
            <p className="whitespace-pre-wrap">{task.description}</p>
          )}

          {/* Grid of info */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <span className="text-muted-foreground/60">Agent:</span>{" "}
              <span className="flex items-center gap-1">
                <AgentAvatar agentId={task.agentId} size={12} />
                {task.agentId ?? "Unassigned"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/60">Requester:</span> {task.requester}
            </div>
            <div>
              <span className="text-muted-foreground/60">Created:</span> {formatDate(task.createdAt)}
            </div>
            {task.dueAt && (
              <div className="text-amber-400">
                <span className="text-muted-foreground/60">Due:</span> {formatDate(task.dueAt)}
              </div>
            )}
            {task.startedAt && (
              <div>
                <span className="text-muted-foreground/60">Started:</span> {formatDate(task.startedAt)}
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-muted-foreground/60">Completed:</span> {formatDate(task.completedAt)}
              </div>
            )}
            {task.estimatedMinutes && (
              <div>
                <span className="text-muted-foreground/60">Estimate:</span> {task.estimatedMinutes}m
              </div>
            )}
            {task.actualMinutes && (
              <div>
                <span className="text-muted-foreground/60">Actual:</span> {task.actualMinutes}m
              </div>
            )}
            {task.scheduledStartAt && (
              <div className="text-blue-400">
                <span className="text-muted-foreground/60">Scheduled:</span> {formatDate(task.scheduledStartAt)}
              </div>
            )}
          </div>

          {/* Pending reason */}
          {isPending && task.pendingReason && (
            <div className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {getPendingReasonLabel(task.pendingReason)}
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="h-3 w-3" />
              {task.tags.map((tag) => (
                <span key={tag} className="rounded bg-surface-2 px-1">{tag}</span>
              ))}
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="flex items-center gap-1 text-blue-400">
              <Link2 className="h-3 w-3" />
              {task.dependencies.join(", ")}
            </div>
          )}

          {/* Resolution */}
          {isCompleted && task.resolution && (
            <div className="flex items-center gap-1 text-green-400">
              <CheckCircle className="h-3 w-3" />
              {task.resolution}
            </div>
          )}

          {/* Inline stage transition buttons */}
          <div className="flex flex-wrap gap-1 pt-1">
            {isQueue && onStart && (
              <button
                onClick={(e) => { e.stopPropagation(); onStart(task); }}
                className="flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-1 text-blue-400 hover:bg-blue-500/30"
              >
                <Play className="h-3 w-3" /> Start
              </button>
            )}
            {isExecuting && onPending && (
              <button
                onClick={(e) => { e.stopPropagation(); onPending(task); }}
                className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-amber-400 hover:bg-amber-500/30"
              >
                <AlertTriangle className="h-3 w-3" /> Pending
              </button>
            )}
            {isPending && onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(task); }}
                className="flex items-center gap-1 rounded-md bg-green-500/20 px-2 py-1 text-green-400 hover:bg-green-500/30"
              >
                <Check className="h-3 w-3" /> Approve
              </button>
            )}
            {isPending && onRevise && (
              <button
                onClick={(e) => { e.stopPropagation(); onRevise(task); }}
                className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:bg-surface-3"
              >
                <RefreshCw className="h-3 w-3" /> Revise
              </button>
            )}
            {isCompleted && onRevise && (
              <button
                onClick={(e) => { e.stopPropagation(); onRevise(task); }}
                className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:bg-surface-3"
              >
                <ArrowUp className="h-3 w-3" /> Reopen
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(task); }}
              className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-muted-foreground hover:bg-surface-3 ml-auto"
            >
              <FileText className="h-3 w-3" /> Details
            </button>
          </div>
        </div>
      )}

      {/* Collapsed: compact meta */}
      {!expanded && (
        <div className="space-y-1 text-[10px] text-muted-foreground">
          {/* Agent */}
          <div className="flex items-center gap-1.5">
            <AgentAvatar agentId={task.agentId} size={14} />
            <span className="truncate">{task.agentId ?? "Unassigned"}</span>
          </div>

          {/* Time info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span>{formatRelative(task.createdAt)}</span>
            {task.startedAt && !isExecuting && <span>· Started {formatRelative(task.startedAt)}</span>}
            {isExecuting && task.startedAt && <span className="text-blue-400">· Running {formatElapsed(task.startedAt)}</span>}
            {task.estimatedMinutes && <span>· Est {task.estimatedMinutes}m</span>}
          </div>

          {/* Due date */}
          {task.dueAt && (
            <div className="flex items-center gap-1 text-amber-400">
              <Calendar className="h-3 w-3" />
              Due {formatDate(task.dueAt)}
            </div>
          )}

          {/* Tags */}
          {!compact && task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="h-3 w-3" />
              {task.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded bg-surface-2 px-1">{tag}</span>
              ))}
              {task.tags.length > 3 && <span>+{task.tags.length - 3}</span>}
            </div>
          )}
        </div>
      )}

      {/* Action menu */}
      {showMenu && (
        <div className="absolute right-2 top-8 z-10 mt-1 w-40 rounded-xl border border-border bg-surface-1 p-1 shadow-lg">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(task); setShowMenu(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-surface-2"
          >
            <FileText className="h-3 w-3" /> View Details
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Task Detail Panel ───────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  task: Task;
  agents: { agentId: string; name: string }[];
  onClose: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
  onStart: (task: Task) => void;
  onPending: (task: Task) => void;
  onComplete: (task: Task) => void;
  onRevise: (task: Task) => void;
}

function TaskDetailPanel({
  task,
  agents,
  onClose,
  onUpdate,
  onDelete,
  onStart,
  onPending,
  onComplete,
  onRevise,
}: TaskDetailPanelProps) {
  const [pendingReason, setPendingReason] = useState<Task["pendingReason"]>(task.pendingReason ?? "awaiting_review");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTransition = async (newStage: TaskStage) => {
    setIsTransitioning(true);
    try {
      if (newStage === "EXECUTING") onStart(task);
      else if (newStage === "PENDING") onPending(task);
      else if (newStage === "COMPLETED") onComplete(task);
      else if (newStage === "QUEUE") onRevise(task);
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
              <StageBadge stage={task.stage} />
              <PriorityBadge priority={task.priority} />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground ml-4 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Description */}
          {task.description && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
            </div>
          )}

          {/* Grid of info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Agent</p>
              <div className="flex items-center gap-2">
                <AgentAvatar agentId={task.agentId} size={20} />
                <span className="text-sm">{task.agentId ?? "Unassigned"}</span>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Requester</p>
              <p className="text-sm capitalize">{task.requester}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Created</p>
              <p className="text-sm">{formatRelative(task.createdAt)}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Due Date</p>
              <p className="text-sm">{formatDate(task.dueAt)}</p>
            </div>
            {task.startedAt && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Started</p>
                <p className="text-sm">{new Date(task.startedAt).toLocaleString()}</p>
              </div>
            )}
            {task.completedAt && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Completed</p>
                <p className="text-sm">{new Date(task.completedAt).toLocaleString()}</p>
              </div>
            )}
            {task.estimatedMinutes && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Estimated</p>
                <p className="text-sm">{task.estimatedMinutes} minutes</p>
              </div>
            )}
            {task.actualMinutes && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Actual</p>
                <p className="text-sm">{task.actualMinutes} minutes</p>
              </div>
            )}
            {isTransitioning && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-blue-400">Transitioning...</p>
              </div>
            )}
          </div>

          {/* Pending reason selector (if PENDING) */}
          {task.stage === "PENDING" && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Pending Reason</p>
              <select
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={pendingReason ?? "awaiting_review"}
                onChange={(e) => setPendingReason(e.target.value as PendingReason)}
              >
                {PENDING_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Dependencies</p>
              <div className="flex flex-wrap gap-1">
                {task.dependencies.map((dep) => (
                  <span key={dep} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400 font-mono">{dep}</span>
                ))}
              </div>
            </div>
          )}

          {/* Context */}
          {task.context && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Context</p>
              <div className="space-y-1 rounded-md border border-border bg-surface-2 p-3">
                {task.context.files && task.context.files.length > 0 && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Files</p>
                      {task.context.files.map((f) => (
                        <p key={f} className="font-mono text-xs truncate">{f}</p>
                      ))}
                    </div>
                  </div>
                )}
                {task.context.urls && task.context.urls.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Link2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">URLs</p>
                      {task.context.urls.map((u) => (
                        <p key={u} className="font-mono text-xs truncate">{u}</p>
                      ))}
                    </div>
                  </div>
                )}
                {task.context.notes && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-xs">{task.context.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lessons learned */}
          {task.lessons && task.lessons.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Lessons Learned</p>
              <ul className="list-disc list-inside space-y-1">
                {task.lessons.map((lesson, i) => (
                  <li key={i} className="text-xs">{lesson}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          {task.stage === "QUEUE" && (
            <button
              onClick={() => handleTransition("EXECUTING")}
              disabled={isTransitioning}
              className="flex items-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start Task
            </button>
          )}
          {task.stage === "EXECUTING" && (
            <button
              onClick={() => handleTransition("PENDING")}
              disabled={isTransitioning}
              className="flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" /> Move to Pending
            </button>
          )}
          {task.stage === "PENDING" && (
            <>
              <button
                onClick={() => handleTransition("COMPLETED")}
                disabled={isTransitioning}
                className="flex items-center gap-1.5 rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => handleTransition("QUEUE")}
                disabled={isTransitioning}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm text-foreground hover:bg-surface-3 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Request Changes
              </button>
            </>
          )}
          {task.stage === "COMPLETED" && (
            <div className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle className="h-4 w-4" />
              Task Completed
              {task.resolution && <span className="ml-2">({getResolutionLabel(task.resolution)})</span>}
            </div>
          )}
          <button
            onClick={onDelete}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"
          >
            <XCircle className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stage Badge ─────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: TaskStage }) {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.bgColor}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ─── Create Task Modal ───────────────────────────────────────────────────────

interface CreateTaskModalProps {
  agents: { agentId: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
  onCronCreated?: () => void;
}

function CreateTaskModal({ agents, onClose, onCreated, onCronCreated }: CreateTaskModalProps) {
  const [tab, setTab] = useState<"task" | "scheduled">("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [tags, setTags] = useState("");
  const [dependencies, setDependencies] = useState("");
  // Scheduled-specific
  const [everyValue, setEveryValue] = useState("60");
  const [everyUnit, setEveryUnit] = useState<"s" | "m" | "h">("m");
  // Task start scheduling
  const [hasStartAt, setHasStartAt] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyMs = useMemo(() => {
    const v = parseInt(everyValue) || 0;
    if (everyUnit === "h") return v * 3600000;
    if (everyUnit === "m") return v * 60000;
    return v * 1000;
  }, [everyValue, everyUnit]);

  const handleCreateTask = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          agentId: agentId || null,
          priority,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          dueAt: dueAt || undefined,
          startAt: hasStartAt && startAt ? startAt : undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          dependencies: dependencies ? dependencies.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to create task");
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScheduled = async () => {
    if (!title.trim() || everyMs <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const sessionTarget = agentId ? `session:${agentId}` : "isolated";
      const res = await fetch("/api/intents/cron-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title.trim(),
          agentId: agentId || undefined,
          schedule: { kind: "every", everyMs },
          payload: {
            kind: "agentTurn",
            message: description.trim() || `Scheduled task: ${title.trim()}`,
          },
          sessionTarget,
          wakeMode: "next-heartbeat",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to create scheduled task");
      }
      onCronCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scheduled task");
    } finally {
      setLoading(false);
    }
  };

  const isScheduled = tab === "scheduled";
  const canSubmit = isScheduled
    ? title.trim().length > 0 && everyMs > 0
    : title.trim().length > 0;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface-1 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setTab("task")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                !isScheduled ? "bg-surface-1 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Task
            </button>
            <button
              type="button"
              onClick={() => setTab("scheduled")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                isScheduled ? "bg-surface-1 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Scheduled
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {isScheduled ? "Schedule name" : "Title"} *
            </label>
            <input
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              placeholder={isScheduled ? "Daily summary report" : "What needs to be done?"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {isScheduled && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Prompt / message</label>
              <textarea
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
                placeholder="What should this scheduled task do each time it runs?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

          {!isScheduled && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Description</label>
              <textarea
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
                placeholder="Detailed requirements..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Agent</label>
              <select
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
              <select
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {isScheduled ? (
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
                <label className="mb-1 block text-xs text-muted-foreground">Preview</label>
                <p className="flex h-[38px] items-center rounded-md border border-border bg-surface-2 px-3 text-xs text-muted-foreground">
                  {everyMs >= 3600000 ? `${parseInt(everyValue) || 0}h` : everyMs >= 60000 ? `${parseInt(everyValue) || 0}m` : `${everyValue}s`}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Estimate (minutes)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="30"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Due Date</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </div>
            </div>
          )}

          {!isScheduled && (
            <>
              {/* Schedule start toggle */}
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hasStartAt}
                    onChange={(e) => { setHasStartAt(e.target.checked); if (!e.target.checked) setStartAt(""); }}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  Schedule task start
                </label>
                {hasStartAt && (
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Tags (comma separated)</label>
                <input
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="setup, api, urgent"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Dependencies (task IDs, comma separated)</label>
                <input
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="T-001, T-002"
                  value={dependencies}
                  onChange={(e) => setDependencies(e.target.value)}
                />
              </div>
            </>
          )}

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
            onClick={isScheduled ? handleCreateScheduled : handleCreateTask}
            disabled={loading || !canSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating..." : isScheduled ? "Create Schedule" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
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

// ─── Agent Filter Chips ─────────────────────────────────────────────────────

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
              src={buildAvatarDataUrl(agent.avatarSeed ?? agent.agentId)}
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

// ─── Main TaskBoard Component ────────────────────────────────────────────────

interface TaskBoardProps {
  agents?: { agentId: string; name: string }[];
}

export function TaskBoard({ agents: propAgents }: TaskBoardProps) {
  const { state } = useAgentStore();
  const storeAgents = state.agents;

  // Use prop agents if provided, otherwise use store agents
  const agentList = useMemo(() => {
    if (propAgents && propAgents.length > 0) return propAgents;
    return storeAgents.map((a) => ({ agentId: a.agentId, name: a.name }));
  }, [propAgents, storeAgents]);

  const agentDetails = useMemo(() => {
    if (propAgents && propAgents.length > 0) return propAgents;
    return storeAgents.map((a) => ({ agentId: a.agentId, name: a.name, avatarSeed: a.avatarSeed }));
  }, [propAgents, storeAgents]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJobSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [prioritySort, setPrioritySort] = useState(false);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(false);
  const dragOverColumnRef = useRef<string | null>(null);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const customCollision: CollisionDetection = closestCenter;

  // ── Fetch tasks ────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      // Silently handle
    }
  }, [search]);

  // ── Fetch cron jobs ────────────────────────────────────────────────────────
  const fetchCronJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/jobs");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCronJobs(data.jobs ?? []);
    } catch {
      // Silently handle
    }
  }, []);

  // ── Combined refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    void fetchTasks();
    void fetchCronJobs();
    setRefreshKey((k) => k + 1);
  }, [fetchTasks, fetchCronJobs]);

  useEffect(() => {
    void fetchTasks();
    void fetchCronJobs();
  }, [fetchTasks, fetchCronJobs, refreshKey]);

  // ── Build execution run entries from agent state ──────────────────────────
  const runEntries = useMemo(() => {
    const entries: Omit<RunTileProps, "avatarSeed" | "isPendingExecution" | "isDragOverlay">[] = [];
    for (const agent of storeAgents) {
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
  }, [storeAgents, now]);

  // ── Filter tasks by agent + priority + search ───────────────────────────
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedAgentIds.size > 0) {
      filtered = filtered.filter((t) => selectedAgentIds.has(t.agentId ?? "unassigned"));
    }
    if (selectedPriority != null) {
      filtered = filtered.filter((t) => t.priority === selectedPriority);
    }
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [tasks, search, selectedAgentIds, selectedPriority]);

  // ── Priority sort ────────────────────────────────────────────────────────
  const sortedTasks = useMemo(() => {
    if (!prioritySort) return filteredTasks;
    const order: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return [...filteredTasks].sort((a, b) =>
      (order[a.priority] - order[b.priority])
    );
  }, [filteredTasks, prioritySort]);

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
  const queueTasks = sortedTasks.filter((t) => t.stage === "QUEUE");
  const executingTasks = sortedTasks.filter((t) => t.stage === "EXECUTING");
  const pendingTasks = sortedTasks.filter((t) => t.stage === "PENDING");
  const completedTasks = sortedTasks.filter((t) => t.stage === "COMPLETED");

  // Filter cron jobs: enabled jobs show in queue
  const scheduledJobs = useMemo(() => {
    let jobs = cronJobs.filter((j) => j.enabled);
    if (selectedAgentIds.size > 0) {
      jobs = jobs.filter((j) => selectedAgentIds.has(j.agentId ?? "unassigned"));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          j.description?.toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q)
      );
    }
    return sortCronJobsByUpdatedAt(jobs);
  }, [cronJobs, search, selectedAgentIds]);

  const executingRuns = filteredRuns.filter((r) => r.status === "thinking" || r.status === "running");
  const doneRuns = filteredRuns.filter((r) => r.status === "completed" || r.status === "failed");

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    queue: queueTasks.length + scheduledJobs.length,
    executing: executingTasks.length,
    pending: pendingTasks.length,
    completed: completedTasks.length,
    total: tasks.length + scheduledJobs.length,
    activeCount: executingRuns.length,
  }), [queueTasks, executingTasks, pendingTasks, completedTasks, tasks, executingRuns, scheduledJobs]);

  // ── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumn(null); dragOverColumnRef.current = null; return; }
    const overId = over.id as string;
    if (["QUEUE", "EXECUTING", "PENDING", "COMPLETED"].includes(overId)) {
      setOverColumn(overId);
      dragOverColumnRef.current = overId;
      return;
    }
    const parsed = parseTileId(overId);
    if (parsed) {
      setOverColumn(parsed.colId);
      dragOverColumnRef.current = parsed.colId;
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverColumn(null);
      dragOverColumnRef.current = null;
      if (!over) return;

      const activeParsed = parseTileId(active.id as string);
      if (!activeParsed) return;

      const targetCol = (() => {
        const overId = over.id as string;
        if (["QUEUE", "EXECUTING", "PENDING", "COMPLETED"].includes(overId)) return overId;
        return parseTileId(overId)?.colId ?? null;
      })();

      if (!targetCol) return;
      if (activeParsed.colId === targetCol) return;

      const task = tasks.find((t) => t.id === activeParsed.unique);
      if (!task) return;

      // Only allow transitions that make sense
      const validMoves: Record<string, TaskStage[]> = {
        QUEUE: ["EXECUTING"],
        EXECUTING: ["PENDING", "QUEUE"],
        PENDING: ["COMPLETED", "EXECUTING", "QUEUE"],
        COMPLETED: ["QUEUE"],
      };

      if (!validMoves[activeParsed.colId]?.includes(targetCol as TaskStage)) return;

      // Check WIP limit for EXECUTING
      if (targetCol === "EXECUTING" && executingTasks.length >= WIP_LIMIT_EXECUTING) {
        // Allow overload visually but show warning
      }

      // Perform the transition
      await handleUpdateTask(task.id, { stage: targetCol as TaskStage });
    },
    [tasks, executingTasks.length]
  );

  // ── Cron job handlers ────────────────────────────────────────────────────
  const handleRunCronJob = async (job: CronJobSummary) => {
    setLoading(true);
    try {
      await fetch(`/api/cron/run?id=${encodeURIComponent(job.id)}`, { method: "POST" });
      handleRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCronJob = async (job: CronJobSummary) => {
    if (!confirm(`Delete scheduled task "${job.name}"?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/cron/jobs?id=${encodeURIComponent(job.id)}`, { method: "DELETE" });
      handleRefresh();
    } finally {
      setLoading(false);
    }
  };

  // ── Stage transitions ────────────────────────────────────────────────────
  const handleStartTask = async (task: Task) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "EXECUTING" }),
      });
      if (res.ok) handleRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handlePendingTask = async (task: Task) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "PENDING", pendingReason: "awaiting_review" }),
      });
      if (res.ok) handleRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "COMPLETED", resolution: "approved" }),
      });
      if (res.ok) handleRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleReviseTask = async (task: Task) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "QUEUE" }),
      });
      if (res.ok) handleRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        handleRefresh();
        setSelectedTask(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        handleRefresh();
        setSelectedTask(null);
      }
    } finally {
      setLoading(false);
    }
  };

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

  // ── Active drag overlay ──────────────────────────────────────────────────
  const activeTask = useMemo(() => {
    if (!activeId) return null;
    const parsed = parseTileId(activeId);
    if (!parsed) return null;
    if (parsed.colId === "COMPLETED") return null;
    return tasks.find((t) => t.id === parsed.unique) ?? null;
  }, [activeId, tasks]);

  const activeRunEntry = useMemo(() => {
    if (!activeId) return null;
    const parsed = parseTileId(activeId);
    if (!parsed) return null;
    if (parsed.colId !== "EXECUTING" && parsed.colId !== "COMPLETED") return null;
    const [agentIdStr, startedAtStr] = parsed.unique.split(":");
    const startedAtMs = Number(startedAtStr);
    if (parsed.colId === "EXECUTING") {
      return executingRuns.find((r) => r.agentId === agentIdStr && r.startedAtMs === startedAtMs) ?? null;
    }
    if (parsed.colId === "COMPLETED") {
      return doneRuns.find((r) => r.agentId === agentIdStr && r.startedAtMs === startedAtMs) ?? null;
    }
    return null;
  }, [activeId, executingRuns, doneRuns]);

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
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {stats.total > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {stats.total} task{stats.total !== 1 ? "s" : ""}
                {stats.activeCount > 0 && <span className="ml-1 text-blue-400">· {stats.activeCount} active</span>}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <AgentFilterChips
              agents={agentDetails}
              selected={selectedAgentIds}
              onToggle={handleAgentToggle}
            />

            <div className="flex items-center gap-1">
              {/* Priority filter */}
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                {(["urgent", "high", "normal", "low"] as TaskPriority[]).map((p) => {
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
                    <SortIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Compact view toggle */}
              <button
                type="button"
                onClick={() => setCompactView((v) => !v)}
                title={compactView ? "Normal view" : "Compact view"}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              >
                {compactView ? <LayoutList className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              </button>

              {/* Auto-refresh toggle */}
              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
                className={`flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground ${!autoRefresh ? "text-amber-400" : ""}`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
              </button>

              <button
                onClick={handleRefresh}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
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

        {/* ── Kanban Columns ── */}
        <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4">

          {/* ── Queue ── */}
          <ColumnZone
            id="QUEUE"
            isDropTarget={overColumn === "QUEUE"}
            count={queueTasks.length + scheduledJobs.length}
            className="border-purple-500/20"
          >
            <ColumnHeader
              label="Queue"
              Icon={Loader}
              accent="text-purple-400"
              count={queueTasks.length + scheduledJobs.length}
            />
            <SortableContext items={queueTasks.map((t) => tileId("QUEUE", t.id))}>
              <div className={`space-y-2 ${compactView ? "scale-95" : ""}`}>
                {queueTasks.length === 0 && scheduledJobs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">No queued tasks or schedules</p>
                ) : (
                  <>
                    {/* Cron jobs in queue (not sortable) */}
                    {scheduledJobs.map((job) => (
                      <CronJobCard
                        key={job.id}
                        job={job}
                        onRun={handleRunCronJob}
                        onDelete={handleDeleteCronJob}
                        compact={compactView}
                      />
                    ))}
                    {/* Tasks in queue */}
                    {queueTasks.map((task) => (
                      <SortableTaskCard
                        key={tileId("QUEUE", task.id)}
                        id={tileId("QUEUE", task.id)}
                        task={task}
                        onSelect={setSelectedTask}
                        onStart={handleStartTask}
                        compact={compactView}
                      />
                    ))}
                  </>
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Executing ── */}
          <ColumnZone
            id="EXECUTING"
            isDropTarget={overColumn === "EXECUTING"}
            wipLimit={WIP_LIMIT_EXECUTING}
            count={executingTasks.length + executingRuns.length}
            className="border-blue-500/20"
          >
            <ColumnHeader
              label="Executing"
              Icon={Zap}
              accent="text-blue-400"
              count={executingTasks.length + executingRuns.length}
              wipLimit={WIP_LIMIT_EXECUTING}
            />
            <SortableContext items={[]}>
              <div className={`space-y-2 ${compactView ? "scale-95" : ""}`}>
                {executingTasks.length === 0 && executingRuns.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">Drop to run instantly</p>
                ) : (
                  <>
                    {/* Live execution runs from agent state */}
                    {executingRuns.map((run) => (
                      <RunTile
                        key={`${run.agentId}-${run.startedAtMs}`}
                        agentName={run.agentName}
                        agentId={run.agentId}
                        avatarSeed={storeAgents.find((a) => a.agentId === run.agentId)?.avatarSeed}
                        status={run.status}
                        label={run.label}
                        startedAtMs={run.startedAtMs}
                        thinkingMs={run.thinkingMs}
                        streamText={run.streamText}
                        lastMessage={run.lastMessage}
                        compact={compactView}
                      />
                    ))}
                    {/* Tasks in executing stage */}
                    {executingTasks.map((task) => (
                      <SortableTaskCard
                        key={tileId("EXECUTING", task.id)}
                        id={tileId("EXECUTING", task.id)}
                        task={task}
                        onSelect={setSelectedTask}
                        onPending={handlePendingTask}
                        compact={compactView}
                      />
                    ))}
                  </>
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Pending ── */}
          <ColumnZone
            id="PENDING"
            isDropTarget={overColumn === "PENDING"}
            count={pendingTasks.length}
            className="border-amber-500/20"
          >
            <ColumnHeader
              label="Pending"
              Icon={AlertTriangle}
              accent="text-amber-400"
              count={pendingTasks.length}
            />
            <SortableContext items={pendingTasks.map((t) => tileId("PENDING", t.id))}>
              <div className={`space-y-2 ${compactView ? "scale-95" : ""}`}>
                {pendingTasks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">No pending tasks</p>
                ) : (
                  pendingTasks.map((task) => (
                    <SortableTaskCard
                      key={tileId("PENDING", task.id)}
                      id={tileId("PENDING", task.id)}
                      task={task}
                      onSelect={setSelectedTask}
                      onComplete={handleCompleteTask}
                      onRevise={handleReviseTask}
                      compact={compactView}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </ColumnZone>

          {/* ── Done ── */}
          <ColumnZone
            id="COMPLETED"
            isDropTarget={overColumn === "COMPLETED"}
            count={completedTasks.length + doneRuns.length}
            className="border-green-500/20"
          >
            <ColumnHeader
              label="Done"
              Icon={CheckCircle}
              accent="text-green-400"
              count={completedTasks.length + doneRuns.length}
              collapsed={doneCollapsed}
              onToggle={() => setDoneCollapsed((v) => !v)}
            />
            {!doneCollapsed && (
              <SortableContext items={completedTasks.map((t) => tileId("COMPLETED", t.id))}>
                <div className={`space-y-3 ${compactView ? "scale-95" : ""}`}>
                  {/* Live completed/failed runs */}
                  {doneRuns.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent Runs</p>
                      {doneRuns.slice(0, 5).map((run) => (
                        <RunTile
                          key={`${run.agentId}-${run.startedAtMs}`}
                          agentName={run.agentName}
                          agentId={run.agentId}
                          avatarSeed={storeAgents.find((a) => a.agentId === run.agentId)?.avatarSeed}
                          status={run.status}
                          label={run.label}
                          startedAtMs={run.startedAtMs}
                          endedAtMs={run.endedAtMs}
                          streamText={run.streamText}
                          lastMessage={run.lastMessage}
                          compact={true}
                        />
                      ))}
                    </div>
                  )}
                  {/* Completed tasks */}
                  {completedTasks.length === 0 && doneRuns.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground/40">No completed tasks</p>
                  ) : (
                    completedTasks.map((task) => (
                      <SortableTaskCard
                        key={tileId("COMPLETED", task.id)}
                        id={tileId("COMPLETED", task.id)}
                        task={task}
                        onSelect={setSelectedTask}
                        onRevise={handleReviseTask}
                        compact={compactView}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            )}
          </ColumnZone>
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <TaskCard
              task={activeTask}
              onSelect={() => {}}
              compact={compactView}
              isDragOverlay
            />
          )}
          {activeRunEntry && (
            <RunTile
              {...activeRunEntry}
              avatarSeed={storeAgents.find((a) => a.agentId === activeRunEntry.agentId)?.avatarSeed}
              compact={compactView}
              isDragOverlay
            />
          )}
        </DragOverlay>

        {/* Create modal */}
        {showCreateModal && (
          <CreateTaskModal
            agents={agentList}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleRefresh}
            onCronCreated={handleRefresh}
          />
        )}

        {/* Task detail panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            agents={agentList}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates)}
            onDelete={() => handleDeleteTask(selectedTask.id)}
            onStart={handleStartTask}
            onPending={handlePendingTask}
            onComplete={handleCompleteTask}
            onRevise={handleReviseTask}
          />
        )}
      </div>
    </DndContext>
  );
}
