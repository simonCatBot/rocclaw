import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import {
  cronAddSchema,
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
  const validation = validateInput(cronAddSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  return await executeGatewayIntent("cron.add", validation.data);
}
