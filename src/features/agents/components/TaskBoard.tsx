"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  User,
  Calendar,
  Tag,
  Link2,
  FileText,
  Play,
  Pause,
  Check,
  XCircle,
  Loader,
} from "lucide-react";
import Image from "next/image";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
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

// ─── Priority Config ─────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  low: { label: "Low", color: "text-blue-400", bgColor: "bg-blue-400/10", icon: ArrowDown },
  normal: { label: "Normal", color: "text-muted-foreground", bgColor: "bg-muted/10", icon: ArrowUpDown },
  high: { label: "High", color: "text-red-400", bgColor: "bg-red-400/10", icon: ArrowUp },
  urgent: { label: "Urgent", color: "text-orange-400", bgColor: "bg-orange-400/10", icon: AlertTriangle },
};

const STAGE_CONFIG: Record<TaskStage, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  QUEUE: { label: "Queue", color: "text-purple-400", bgColor: "bg-purple-400/10", icon: Clock },
  EXECUTING: { label: "Executing", color: "text-blue-400", bgColor: "bg-blue-400/10", icon: Play },
  PENDING: { label: "Pending", color: "text-amber-400", bgColor: "bg-amber-400/10", icon: AlertTriangle },
  COMPLETED: { label: "Completed", color: "text-green-400", bgColor: "bg-green-400/10", icon: CheckCircle },
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
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatRelative(dateStr: string): string {
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

// ─── Avatar helper ────────────────────────────────────────────────────────────

function AgentAvatar({ agentId, size = 24 }: { agentId: string | null; size?: number }) {
  const seed = agentId ?? "unassigned";
  const avatarUrl = buildAvatarDataUrl(seed);
  return (
    <Image
      src={avatarUrl}
      alt={agentId ?? "Unassigned"}
      width={size}
      height={size}
      className="rounded-full bg-surface-2 ring-1 ring-accent"
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

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
  onStart: (task: Task) => void;
  onPending: (task: Task) => void;
  onComplete: (task: Task) => void;
  onRevise: (task: Task) => void;
}

function TaskCard({ task, onSelect, onStart, onPending, onComplete, onRevise }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isExecuting = task.stage === "EXECUTING";
  const isPending = task.stage === "PENDING";
  const isCompleted = task.stage === "COMPLETED";
  const isQueue = task.stage === "QUEUE";

  return (
    <div
      className={`group relative rounded-xl border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30 ${
        isExecuting ? "border-blue-500/40 bg-blue-500/5" : ""
      } ${isPending ? "border-amber-500/40 bg-amber-500/5" : ""} ${isCompleted ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">{task.id}</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <h4 
            className="mt-1 truncate text-sm font-semibold text-foreground cursor-pointer hover:text-primary"
            onClick={() => onSelect(task)}
          >
            {task.title}
          </h4>
        </div>
        
        {/* Menu button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground/80">
          {task.description}
        </p>
      )}

      {/* Meta info */}
      <div className="space-y-1 text-[10px] text-muted-foreground">
        {/* Agent */}
        <div className="flex items-center gap-1.5">
          <AgentAvatar agentId={task.agentId} size={14} />
          <span className="truncate">{task.agentId ?? "Unassigned"}</span>
        </div>

        {/* Time info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span>Created {formatRelative(task.createdAt)}</span>
          {task.startedAt && <span>Started {formatRelative(task.startedAt)}</span>}
          {task.estimatedMinutes && (
            <span>Est: {task.estimatedMinutes}m</span>
          )}
        </div>

        {/* Due date */}
        {task.dueAt && (
          <div className="flex items-center gap-1 text-amber-400">
            <Calendar className="h-3 w-3" />
            Due {formatDate(task.dueAt)}
          </div>
        )}

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
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-surface-2 px-1">{tag}</span>
            ))}
            {task.tags.length > 3 && <span>+{task.tags.length - 3}</span>}
          </div>
        )}

        {/* Dependencies */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="flex items-center gap-1 text-blue-400">
            <Link2 className="h-3 w-3" />
            Depends on {task.dependencies.join(", ")}
          </div>
        )}
      </div>

      {/* Action buttons (shown when selected) */}
      {showMenu && (
        <div className="absolute right-2 top-8 z-10 mt-1 w-40 rounded-xl border border-border bg-surface-1 p-1 shadow-lg">
          {isQueue && (
            <button
              onClick={(e) => { e.stopPropagation(); onStart(task); setShowMenu(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-blue-400 hover:bg-surface-2"
            >
              <Play className="h-3 w-3" /> Start Task
            </button>
          )}
          {isExecuting && (
            <button
              onClick={(e) => { e.stopPropagation(); onPending(task); setShowMenu(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-400 hover:bg-surface-2"
            >
              <AlertTriangle className="h-3 w-3" /> Move to Pending
            </button>
          )}
          {isPending && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(task); setShowMenu(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-green-400 hover:bg-surface-2"
              >
                <Check className="h-3 w-3" /> Approve
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRevise(task); setShowMenu(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-orange-400 hover:bg-surface-2"
              >
                <RefreshCw className="h-3 w-3" /> Request Changes
              </button>
            </>
          )}
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

// ─── Column ──────────────────────────────────────────────────────────────────

interface ColumnProps {
  id: TaskStage;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStartTask: (task: Task) => void;
  onPendingTask: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onReviseTask: (task: Task) => void;
}

function Column({ id, tasks, onSelectTask, onStartTask, onPendingTask, onCompleteTask, onReviseTask }: ColumnProps) {
  const config = STAGE_CONFIG[id];
  const Icon = config.icon;
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex min-w-[280px] flex-1 flex-col rounded-2xl border border-border bg-surface-1">
      {/* Column Header */}
      <div 
        className="flex items-center gap-2 border-b border-border/50 px-4 py-3 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className="text-sm font-semibold">{config.label}</span>
        <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full ${config.bgColor} px-2 font-mono text-xs ${config.color}`}>
          {tasks.length}
        </span>
      </div>

      {/* Task List */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasks.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-muted-foreground/40">
                {id === "QUEUE" && "Drag tasks here to start"}
                {id === "EXECUTING" && "No tasks in progress"}
                {id === "PENDING" && "No pending tasks"}
                {id === "COMPLETED" && "No completed tasks"}
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={onSelectTask}
                onStart={onStartTask}
                onPending={onPendingTask}
                onComplete={onCompleteTask}
                onRevise={onReviseTask}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

interface CreateTaskModalProps {
  agents: { agentId: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateTaskModal({ agents, onClose, onCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [tags, setTags] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
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

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface-1 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Create New Task</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Title *</label>
            <input
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

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
            disabled={loading || !title.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  task: Task;
  agents: { agentId: string; name: string }[];
  onClose: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

function TaskDetailPanel({ task, agents, onClose, onUpdate, onDelete }: TaskDetailPanelProps) {
  const [pendingReason, setPendingReason] = useState<Task["pendingReason"]>(task.pendingReason ?? "awaiting_review");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTransition = async (newStage: TaskStage) => {
    setIsTransitioning(true);
    try {
      await onUpdate({ stage: newStage, pendingReason: newStage === "PENDING" ? pendingReason : null });
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
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
              <StageBadge stage={task.stage} />
              <PriorityBadge priority={task.priority} />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground ml-4"
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
              <p className="text-sm">{new Date(task.createdAt).toLocaleString()}</p>
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
          </div>

          {/* Pending reason (if PENDING) */}
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
                onClick={() => handleTransition("EXECUTING")}
                disabled={isTransitioning}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm text-foreground hover:bg-surface-3 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Request Changes
              </button>
            </>
          )}
          {task.stage === "COMPLETED" && (
            <div className="text-sm text-green-400">
              <CheckCircle className="inline h-4 w-4 mr-1" />
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

// ─── Main TaskBoard Component ────────────────────────────────────────────────

interface TaskBoardProps {
  agents: { agentId: string; name: string }[];
}

export function TaskBoard({ agents }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAgentId) params.set("agentId", selectedAgentId);
      if (search) params.set("search", search);
      if (selectedPriority) params.set("priority", selectedPriority);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      // Silently handle
    }
  }, [search, selectedAgentId, selectedPriority]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks, refreshKey]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Stage transitions
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
        body: JSON.stringify({ stage: "EXECUTING" }),
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

  // Group tasks by stage
  const queueTasks = tasks.filter((t) => t.stage === "QUEUE");
  const executingTasks = tasks.filter((t) => t.stage === "EXECUTING");
  const pendingTasks = tasks.filter((t) => t.stage === "PENDING");
  const completedTasks = tasks.filter((t) => t.stage === "COMPLETED");

  // Stats
  const stats = useMemo(() => ({
    queue: queueTasks.length,
    executing: executingTasks.length,
    pending: pendingTasks.length,
    completed: completedTasks.length,
    total: tasks.length,
  }), [queueTasks, executingTasks, pendingTasks, completedTasks]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-[10px] text-muted-foreground">
            {stats.total} task{stats.total !== 1 ? "s" : ""}
            {stats.executing > 0 && <span className="ml-1 text-blue-400">· {stats.executing} active</span>}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Agent filter */}
            <select
              className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
              value={selectedAgentId ?? ""}
              onChange={(e) => setSelectedAgentId(e.target.value || null)}
            >
              <option value="">All Agents</option>
              <option value="unassigned">Unassigned</option>
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>{a.name}</option>
              ))}
            </select>

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
                      active ? `font-semibold ${color}` : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
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

      {/* Kanban Columns */}
      <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4">
        <Column
          id="QUEUE"
          tasks={queueTasks}
          onSelectTask={setSelectedTask}
          onStartTask={handleStartTask}
          onPendingTask={handlePendingTask}
          onCompleteTask={handleCompleteTask}
          onReviseTask={handleReviseTask}
        />
        <Column
          id="EXECUTING"
          tasks={executingTasks}
          onSelectTask={setSelectedTask}
          onStartTask={handleStartTask}
          onPendingTask={handlePendingTask}
          onCompleteTask={handleCompleteTask}
          onReviseTask={handleReviseTask}
        />
        <Column
          id="PENDING"
          tasks={pendingTasks}
          onSelectTask={setSelectedTask}
          onStartTask={handleStartTask}
          onPendingTask={handlePendingTask}
          onCompleteTask={handleCompleteTask}
          onReviseTask={handleReviseTask}
        />
        <Column
          id="COMPLETED"
          tasks={completedTasks}
          onSelectTask={setSelectedTask}
          onStartTask={handleStartTask}
          onPendingTask={handlePendingTask}
          onCompleteTask={handleCompleteTask}
          onReviseTask={handleReviseTask}
        />
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal
          agents={agents}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRefresh}
        />
      )}

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          agents={agents}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates)}
          onDelete={() => handleDeleteTask(selectedTask.id)}
        />
      )}
    </div>
  );
}
