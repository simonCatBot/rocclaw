// Task Stage - lifecycle states
export type TaskStage = "QUEUE" | "EXECUTING" | "PENDING" | "COMPLETED";

// Task Priority
export type TaskPriority = "low" | "normal" | "high" | "urgent";

// Pending Resolution Reasons
export type PendingReason =
  | "awaiting_review"
  | "awaiting_dependency"
  | "awaiting_information"
  | "time_exceeded"
  | "agent_blocked";

// Completed Resolution Types
export type ResolutionType =
  | "approved"
  | "approved_with_notes"
  | "rejected"
  | "cancelled"
  | "merged"
  | "superseded";

// Task Context - files, URLs, notes needed
export interface TaskContext {
  files?: string[];
  urls?: string[];
  notes?: string;
  sessionKey?: string;
  workingDirectory?: string;
}

// Task Output - deliverables when completed
export interface TaskOutput {
  summary: string;
  deliverables?: string[];
  verification?: string;
}

// Agent Performance Rating
export interface AgentPerformance {
  accuracy: "high" | "medium" | "low";
  speed: "faster" | "as_estimated" | "slower";
  communication: "clear" | "adequate" | "unclear";
}

// Core Task Interface
export interface Task {
  id: string;
  title: string;
  description?: string;
  stage: TaskStage;
  priority: TaskPriority;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
  startedAt?: string | null; // ISO8601
  completedAt?: string | null; // ISO8601
  pendingSince?: string | null; // ISO8601
  dueAt?: string | null; // ISO8601
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  requester: string;
  agentId: string | null;
  tags?: string[];
  context?: TaskContext;
  dependencies?: string[]; // Task IDs that must complete first
  // Pending specific
  pendingReason?: PendingReason | null;
  // Completed specific
  resolution?: ResolutionType | null;
  reviewedBy?: string | null;
  lessons?: string[];
  agentPerformance?: AgentPerformance;
}

// Task creation input (subset of fields)
export interface TaskCreateInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  requester?: string;
  agentId?: string | null;
  tags?: string[];
  context?: TaskContext;
  dependencies?: string[];
}

// Task update input
export interface TaskUpdateInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  stage?: TaskStage;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  agentId?: string | null;
  tags?: string[];
  context?: TaskContext;
  dependencies?: string[];
  pendingReason?: PendingReason | null;
  resolution?: ResolutionType | null;
  reviewedBy?: string | null;
  lessons?: string[];
  agentPerformance?: AgentPerformance;
}

// Stage transition input
export interface TaskStageTransition {
  stage: TaskStage;
  pendingReason?: PendingReason | null;
  output?: TaskOutput;
}

// Dashboard stats per agent
export interface AgentTaskStats {
  agentId: string;
  agentName: string;
  queueCount: number;
  executingCount: number;
  pendingCount: number;
  completedTodayCount: number;
  avgCompletionMinutes: number | null;
}

// Task filter options
export interface TaskFilter {
  agentId?: string | null;
  stage?: TaskStage | null;
  priority?: TaskPriority | null;
  requester?: string | null;
  search?: string | null;
}

// Generate next task ID
export function generateTaskId(lastId: string | null): string {
  if (!lastId) return "T-001";
  const match = lastId.match(/^T-(\d+)$/);
  if (!match) return "T-001";
  const num = parseInt(match[1], 10) + 1;
  return `T-${num.toString().padStart(3, "0")}`;
}

// Get display label for priority
export function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };
  return labels[priority];
}

// Get display label for pending reason
export function getPendingReasonLabel(reason: PendingReason): string {
  const labels: Record<PendingReason, string> = {
    awaiting_review: "Awaiting Review",
    awaiting_dependency: "Awaiting Dependency",
    awaiting_information: "Awaiting Information",
    time_exceeded: "Time Exceeded",
    agent_blocked: "Agent Blocked",
  };
  return labels[reason];
}

// Get display label for resolution
export function getResolutionLabel(resolution: ResolutionType): string {
  const labels: Record<ResolutionType, string> = {
    approved: "Approved",
    approved_with_notes: "Approved with Notes",
    rejected: "Rejected",
    cancelled: "Cancelled",
    merged: "Merged",
    superseded: "Superseded",
  };
  return labels[resolution];
}

// Sort tasks by priority and date
export function sortTasksByPriority(tasks: Task[]): Task[] {
  const order: Record<TaskPriority, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return [...tasks].sort((a, b) => {
    const priorityDiff = order[a.priority] - order[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// Filter tasks by stage
export function filterTasksByStage(tasks: Task[], stage: TaskStage): Task[] {
  return tasks.filter((t) => t.stage === stage);
}

// Check if task can transition to a new stage
export function canTransitionTo(task: Task, newStage: TaskStage): boolean {
  const validTransitions: Record<TaskStage, TaskStage[]> = {
    QUEUE: ["EXECUTING"],
    EXECUTING: ["PENDING", "QUEUE"],
    PENDING: ["COMPLETED", "EXECUTING", "QUEUE"],
    COMPLETED: [],
  };
  return validTransitions[task.stage]?.includes(newStage) ?? false;
}

// Default empty task
export function createEmptyTask(input: TaskCreateInput, id: string): Task {
  const now = new Date().toISOString();
  return {
    id,
    title: input.title,
    description: input.description,
    stage: "QUEUE",
    priority: input.priority ?? "normal",
    createdAt: now,
    updatedAt: now,
    requester: input.requester ?? "human",
    agentId: input.agentId ?? null,
    tags: input.tags ?? [],
    context: input.context,
    dependencies: input.dependencies ?? [],
    dueAt: input.dueAt ?? null,
    estimatedMinutes: input.estimatedMinutes ?? null,
  };
}
