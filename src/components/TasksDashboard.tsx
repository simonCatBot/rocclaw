"use client";

import { useEffect, useState } from "react";
import { useAgentStore } from "@/features/agents/state/store";
import { Activity, CheckCircle, Clock, XCircle } from "lucide-react";

interface TaskEntry {
  id: string;
  agentId: string;
  agentName: string;
  status: "thinking" | "running" | "completed" | "failed";
  label: string;
  description: string;
  startedAtMs: number;
  endedAtMs: number | null;
  durationMs: number | null;
  thinkingMs: number | null;
  outputSnippet: string | null;
}

const STATUS_META = {
  thinking: { label: "Thinking", dot: "bg-blue-400", icon: Activity },
  running: { label: "Running", dot: "bg-blue-500", icon: Clock },
  completed: { label: "Completed", dot: "bg-green-500", icon: CheckCircle },
  failed: { label: "Failed", dot: "bg-red-500", icon: XCircle },
} as const;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TaskRow({ task }: { task: TaskEntry }) {
  const meta = STATUS_META[task.status];
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3 px-1 py-2">
      {/* Status dot + icon */}
      <div className="mt-0.5 flex flex-col items-center gap-1">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{task.label}</span>
          <span className="text-[10px] text-muted-foreground">{task.agentName}</span>
        </div>
        {task.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
        {task.outputSnippet && (
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
            {task.outputSnippet}
          </p>
        )}
      </div>

      {/* Right side: duration + timestamp */}
      <div className="shrink-0 text-right">
        {task.durationMs !== null ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatDuration(task.durationMs)}
          </span>
        ) : task.startedAtMs > 0 ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatElapsed(Date.now() - task.startedAtMs)}
          </span>
        ) : null}
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
          {task.startedAtMs > 0 ? formatTimestamp(task.startedAtMs) : ""}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

export function TasksDashboard() {
  const { state } = useAgentStore();
  const agents = state.agents;
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [now, setNow] = useState(Date.now());

  // Poll every second to update "X ago" timestamps for running tasks
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  // Build task list from agents
  useEffect(() => {
    const entries: TaskEntry[] = [];

    for (const agent of agents) {
      const isRunning = agent.status === "running" && agent.runStartedAt !== null;
      const isThinking = isRunning && agent.thinkingTrace !== null;

      // Active / thinking run
      if (isRunning) {
        const startedAtMs = agent.runStartedAt ?? 0;
        const thinkingMs = agent.thinkingTrace ? now - startedAtMs : null;

        // Derive a label from the current activity
        let label = "Running";
        if (isThinking) {
          const trace = agent.thinkingTrace ?? "";
          if (trace.includes("searching") || trace.includes("Search")) label = "Searching";
          else if (trace.includes("reading") || trace.includes("Reading")) label = "Reading";
          else if (trace.includes("coding") || trace.includes("Coding")) label = "Writing";
          else if (trace.includes("writing") || trace.includes("Writing")) label = "Writing";
          else if (trace.includes("thinking") || trace.includes("Thinking")) label = "Thinking";
          else label = "Thinking";
        }

        // Description from the thinking trace or last user message
        const description = agent.thinkingTrace
          ? agent.thinkingTrace.split("\n")[0].slice(0, 120)
          : agent.lastUserMessage
            ? agent.lastUserMessage.slice(0, 120)
            : "";

        // Output snippet from stream text
        const outputSnippet = agent.streamText
          ? agent.streamText.split("\n")[0].slice(0, 80)
          : null;

        entries.push({
          id: `active-${agent.agentId}`,
          agentId: agent.agentId,
          agentName: agent.name,
          status: isThinking ? "thinking" : "running",
          label,
          description,
          startedAtMs,
          endedAtMs: null,
          durationMs: null,
          thinkingMs,
          outputSnippet,
        });
      }

      // Completed / failed from last result
      if (agent.status !== "running" && agent.lastResult) {
        const lastActivityAt = agent.lastActivityAt ?? 0;
        const durationMs = agent.runStartedAt && lastActivityAt > 0 ? lastActivityAt - agent.runStartedAt : null;
        const status: TaskEntry["status"] = agent.status === "error" ? "failed" : "completed";

        // Label from last message
        const label = agent.lastUserMessage
          ? agent.lastUserMessage.split("\n")[0].slice(0, 60)
          : status === "failed"
            ? "Run failed"
            : "Run completed";

        // Output snippet
        const outputSnippet = agent.lastResult
          ? agent.lastResult.split("\n")[0].slice(0, 100)
          : null;

        entries.push({
          id: `done-${agent.agentId}`,
          agentId: agent.agentId,
          agentName: agent.name,
          status,
          label,
          description: "",
          startedAtMs: agent.runStartedAt ?? lastActivityAt,
          endedAtMs: lastActivityAt,
          durationMs,
          thinkingMs: null,
          outputSnippet,
        });
      }
    }

    // Sort: active first (thinking > running), then by start time descending
    const statusOrder = { thinking: 0, running: 1, failed: 2, completed: 3 };
    entries.sort((a, b) => {
      const aActive = a.status === "thinking" || a.status === "running" ? 0 : 1;
      const bActive = b.status === "thinking" || b.status === "running" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
      return b.startedAtMs - a.startedAtMs;
    });

    setTasks(entries);
  }, [agents, now]);

  const running = tasks.filter(
    (t) => t.status === "thinking" || t.status === "running"
  );
  const completed = tasks.filter((t) => t.status === "completed");
  const failed = tasks.filter((t) => t.status === "failed");

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-1">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Agent runs and activity across all agents
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No tasks yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Send a message to an agent to see tasks here
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active / Thinking / Running */}
          {running.length > 0 && (
            <section>
              <SectionHeader title="Active" count={running.length} />
              <div className="space-y-0">
                {running.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <SectionHeader title="Completed" count={completed.length} />
              <div className="space-y-0">
                {completed.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}

          {/* Failed */}
          {failed.length > 0 && (
            <section>
              <SectionHeader title="Failed" count={failed.length} />
              <div className="space-y-0">
                {failed.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
