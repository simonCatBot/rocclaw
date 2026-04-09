// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { getControlPlaneRuntime } from "@/lib/controlplane/runtime";

export const runtime = "nodejs";

// GET /api/cron/jobs — list all cron jobs
export async function GET() {
  try {
    const runtime_ = getControlPlaneRuntime();
    const result = await runtime_.callGateway("cron.list", { includeDisabled: true });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list cron jobs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/cron/jobs?id=xxx — delete a cron job
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const runtime_ = getControlPlaneRuntime();
    await runtime_.callGateway("cron.remove", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete cron job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/cron/jobs — enable or disable a cron job
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; enabled?: boolean };
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const runtime_ = getControlPlaneRuntime();
    await runtime_.callGateway("cron.update", {
      id: body.id,
      patch: { enabled: body.enabled },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update cron job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
