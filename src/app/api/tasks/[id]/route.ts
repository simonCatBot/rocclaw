import { NextRequest, NextResponse } from "next/server";
import {
  getTask,
  updateTask,
  deleteTask,
  transitionTaskStage,
} from "@/lib/tasks/storage";
import type { TaskUpdateInput } from "@/lib/tasks/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id] - Get a single task
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const task = getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error getting task:", error);
    return NextResponse.json({ error: "Failed to get task" }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - Update a task
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Handle stage transition specially
    if (body.stage) {
      const task = transitionTaskStage(id, body.stage, {
        pendingReason: body.pendingReason,
        output: body.output,
      });
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ task });
    }

    // Regular update
    const updates: TaskUpdateInput = {
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueAt: body.dueAt,
      estimatedMinutes: body.estimatedMinutes,
      agentId: body.agentId,
      tags: body.tags,
      context: body.context,
      dependencies: body.dependencies,
      pendingReason: body.pendingReason,
      resolution: body.resolution,
      reviewedBy: body.reviewedBy,
      lessons: body.lessons,
      agentPerformance: body.agentPerformance,
    };

    const task = updateTask(id, updates);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
