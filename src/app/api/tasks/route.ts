import { NextRequest, NextResponse } from "next/server";
import {
  loadTasks,
  createTask,
  listTasks,
  getTaskStats,
  archiveCompletedTasks,
} from "@/lib/tasks/storage";
import type { TaskCreateInput, TaskFilter } from "@/lib/tasks/types";

// GET /api/tasks - List tasks with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filter: TaskFilter = {};
    if (searchParams.has("agentId")) {
      filter.agentId = searchParams.get("agentId");
    }
    if (searchParams.has("stage")) {
      filter.stage = searchParams.get("stage") as TaskFilter["stage"];
    }
    if (searchParams.has("priority")) {
      filter.priority = searchParams.get("priority") as TaskFilter["priority"];
    }
    if (searchParams.has("requester")) {
      filter.requester = searchParams.get("requester");
    }
    if (searchParams.has("search")) {
      filter.search = searchParams.get("search");
    }

    const tasks = listTasks(filter);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Error loading tasks:", error);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: TaskCreateInput = {
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueAt: body.dueAt,
      scheduledStartAt: body.startAt,
      estimatedMinutes: body.estimatedMinutes,
      requester: body.requester ?? "human",
      agentId: body.agentId,
      tags: body.tags,
      context: body.context,
      dependencies: body.dependencies,
    };

    if (!input.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const task = createTask(input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
