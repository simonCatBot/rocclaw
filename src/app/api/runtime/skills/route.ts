// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { executeRuntimeGatewayRead } from "@/lib/controlplane/runtime-read-route";

export const runtime = "nodejs";

/**
 * GET /api/runtime/skills
 *
 * Fetches skills list via the gateway's skills.status RPC method.
 * This works for both local and remote gateway connections.
 *
 * The gateway returns the same format as `openclaw skills list --json`:
 * { workspaceDir, managedSkillsDir, skills: [...] }
 */
export async function GET() {
  try {
    const response = await executeRuntimeGatewayRead("skills.status", {});

    // executeRuntimeGatewayRead returns a NextResponse with { ok, payload }
    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: data.error ?? "Gateway skills.status failed" },
        { status: response.status }
      );
    }

    // The payload IS the skills data (workspaceDir, managedSkillsDir, skills[])
    const payload = data.payload ?? {};
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch skills from gateway";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}