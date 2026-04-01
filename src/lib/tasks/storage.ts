import fs from "fs";
import path from "path";
import {
  type Task,
  type TaskCreateInput,
  type TaskUpdateInput,
  type TaskFilter,
  generateTaskId,
  createEmptyTask,
  sortTasksByPriority,
} from "./types";

const TASKS_DIR = path.join(process.env.HOME ?? "/home/kiriti", ".openclaw", "workspace", "tasks");
const TASKS_FILE = path.join(TASKS_DIR, "tasks.json");
const ARCHIVE_DIR = path.join(TASKS_DIR, "archive");

// Ensure directories exist
function ensureDirectories(): void {
  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
}

// Read all tasks from storage
export function loadTasks(): Task[] {
  ensureDirectories();
  if (!fs.existsSync(TASKS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(TASKS_FILE, "utf-8");
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Save all tasks to storage
export function saveTasks(tasks: Task[]): void {
  ensureDirectories();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

// Get next available task ID
function getNextTaskId(tasks: Task[]): string {
  const lastId = tasks.length > 0
    ? [...tasks].sort((a, b) => b.id.localeCompare(a.id))[0].id
    : null;
  return generateTaskId(lastId);
}

// Create a new task
export function createTask(input: TaskCreateInput): Task {
  const tasks = loadTasks();
  const id = getNextTaskId(tasks);
  const task = createEmptyTask(input, id);
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

// Get task by ID
export function getTask(id: string): Task | null {
  const tasks = loadTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

// Update a task
export function updateTask(id: string, updates: TaskUpdateInput): Task | null {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated: Task = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  tasks[index] = updated;
  saveTasks(tasks);
  return updated;
}

// Delete a task
export function deleteTask(id: string): boolean {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  saveTasks(tasks);
  return true;
}

// List tasks with optional filter
export function listTasks(filter?: TaskFilter): Task[] {
  let tasks = loadTasks();

  if (filter?.agentId !== undefined && filter.agentId !== null) {
    tasks = tasks.filter((t) => t.agentId === filter.agentId);
  }
  if (filter?.stage !== undefined && filter.stage !== null) {
    tasks = tasks.filter((t) => t.stage === filter.stage);
  }
  if (filter?.priority !== undefined && filter.priority !== null) {
    tasks = tasks.filter((t) => t.priority === filter.priority);
  }
  if (filter?.requester !== undefined && filter.requester !== null) {
    tasks = tasks.filter((t) => t.requester === filter.requester);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }

  return sortTasksByPriority(tasks);
}

// Stage transition
export function transitionTaskStage(
  id: string,
  newStage: Task["stage"],
  options?: {
    pendingReason?: string | null;
    output?: { summary: string; deliverables?: string[]; verification?: string };
  }
): Task | null {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const task = tasks[index];
  const now = new Date().toISOString();

  const updated: Task = {
    ...task,
    stage: newStage,
    updatedAt: now,
  };

  switch (newStage) {
    case "EXECUTING":
      updated.startedAt = now;
      break;
    case "PENDING":
      updated.pendingSince = now;
      updated.pendingReason = (options?.pendingReason as Task["pendingReason"]) ?? "awaiting_review";
      break;
    case "COMPLETED":
      updated.completedAt = now;
      if (options?.output) {
        // Store output summary in description for now
        updated.description = options.output.summary;
      }
      break;
    case "QUEUE":
      updated.startedAt = null;
      updated.pendingSince = null;
      updated.pendingReason = null;
      break;
  }

  tasks[index] = updated;
  saveTasks(tasks);
  return updated;
}

// Archive completed tasks
export function archiveCompletedTasks(): number {
  const tasks = loadTasks();
  const completed = tasks.filter((t) => t.stage === "COMPLETED");
  if (completed.length === 0) return 0;

  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM
  const archiveFile = path.join(ARCHIVE_DIR, `${monthStr}.json`);

  let archive: Task[] = [];
  if (fs.existsSync(archiveFile)) {
    try {
      archive = JSON.parse(fs.readFileSync(archiveFile, "utf-8"));
    } catch {
      archive = [];
    }
  }

  archive.push(...completed);
  fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2), "utf-8");

  const remaining = tasks.filter((t) => t.stage !== "COMPLETED");
  saveTasks(remaining);

  return completed.length;
}

// Get task statistics
export function getTaskStats() {
  const tasks = loadTasks();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = {
    total: tasks.length,
    queue: tasks.filter((t) => t.stage === "QUEUE").length,
    executing: tasks.filter((t) => t.stage === "EXECUTING").length,
    pending: tasks.filter((t) => t.stage === "PENDING").length,
    completed: tasks.filter((t) => t.stage === "COMPLETED").length,
    completedToday: tasks.filter((t) => {
      if (t.stage !== "COMPLETED" || !t.completedAt) return false;
      return new Date(t.completedAt) >= today;
    }).length,
    byAgent: new Map<string, { queue: number; executing: number; pending: number; completed: number }>(),
  };

  // Aggregate by agent
  for (const task of tasks) {
    const agentId = task.agentId ?? "unassigned";
    if (!stats.byAgent.has(agentId)) {
      stats.byAgent.set(agentId, { queue: 0, executing: 0, pending: 0, completed: 0 });
    }
    const agent = stats.byAgent.get(agentId)!;
    switch (task.stage) {
      case "QUEUE": agent.queue++; break;
      case "EXECUTING": agent.executing++; break;
      case "PENDING": agent.pending++; break;
      case "COMPLETED": agent.completed++; break;
    }
  }

  return stats;
}
