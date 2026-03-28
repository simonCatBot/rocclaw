import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import {
  agentDeleteSchema,
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  // Validate input with Zod
  const validation = validateInput(agentDeleteSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { agentId } = validation.data;
  return await executeGatewayIntent("agents.delete", { agentId });
}
