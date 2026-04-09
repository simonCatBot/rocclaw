// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { getControlPlaneRuntime } from "@/lib/controlplane/runtime";

export const runtime = "nodejs";

// POST /api/cron/run?id=xxx — trigger a cron job run immediately
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const runtime_ = getControlPlaneRuntime();
    const result = await runtime_.callGateway("cron.run", { id });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run cron job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
