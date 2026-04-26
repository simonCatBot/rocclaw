// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  const name = typeof bodyOrError.name === "string" ? bodyOrError.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const agentId = typeof bodyOrError.agentId === "string" ? bodyOrError.agentId.trim() : undefined;

  // Whitelist only known fields to prevent arbitrary data being forwarded
  const payload: Record<string, unknown> = { name };
  if (agentId) payload.agentId = agentId;
  if (bodyOrError.schedule !== undefined) payload.schedule = bodyOrError.schedule;
  if (bodyOrError.message !== undefined) payload.message = bodyOrError.message;
  if (bodyOrError.enabled !== undefined) payload.enabled = bodyOrError.enabled;
  if (bodyOrError.payload !== undefined) payload.payload = bodyOrError.payload;

  return await executeGatewayIntent("cron.add", payload);
}
