import { NextResponse } from "next/server";
import { z } from "zod";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import { sessionKeySchema, validateInput, createValidationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const chatAbortSchema = z.object({
  sessionKey: sessionKeySchema,
  runId: z.string().max(256).trim().optional(),
});

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  // Validate input with Zod
  const validation = validateInput(chatAbortSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { sessionKey, runId } = validation.data;
  return await executeGatewayIntent("chat.abort", runId ? { sessionKey, runId } : { sessionKey });
}
