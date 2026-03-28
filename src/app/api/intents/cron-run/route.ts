import { NextResponse } from "next/server";

import {
  executeGatewayIntent,
  LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS,
  parseIntentBody,
} from "@/lib/controlplane/intent-route";
import {
  cronRunSchema,
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
  const validation = validateInput(cronRunSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { name } = validation.data;

  return await executeGatewayIntent(
    "cron.run",
    {
      id: name,
      mode: "force",
    },
    {
      timeoutMs: LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS,
    }
  );
}
