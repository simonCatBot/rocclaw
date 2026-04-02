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

  // agentId is optional - gateway will use default if not provided
  if (bodyOrError.agentId && typeof bodyOrError.agentId === "string") {
    bodyOrError.agentId = bodyOrError.agentId.trim();
  }

  return await executeGatewayIntent("cron.add", bodyOrError);
}
