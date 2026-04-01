"use client";

import { useAgentStore } from "@/features/agents/state/store";
import { TaskBoard } from "@/features/agents/components/TaskBoard";

export function TasksDashboard() {
  return <TaskBoard />;
}
