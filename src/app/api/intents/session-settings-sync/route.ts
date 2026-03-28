import { NextResponse } from "next/server";
import { z } from "zod";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import {
  sessionKeySchema,
  validateInput,
  createValidationErrorResponse,
  modelSchema,
  thinkingLevelSchema,
  execHostSchema,
  execSecuritySchema,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

const sessionSettingsSyncSchema = z.object({
  sessionKey: sessionKeySchema,
  model: modelSchema.optional(),
  thinkingLevel: thinkingLevelSchema.optional(),
  execHost: execHostSchema.optional(),
  execSecurity: execSecuritySchema.optional(),
  execAsk: z.boolean().optional(),
});

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  // Validate input with Zod
  const validation = validateInput(sessionSettingsSyncSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { sessionKey, model, thinkingLevel, execHost, execSecurity, execAsk } = validation.data;

  // Build the params object with only provided values
  const params: Record<string, unknown> = { key: sessionKey };
  if (model !== undefined) params.model = model ?? null;
  if (thinkingLevel !== undefined) params.thinkingLevel = thinkingLevel ?? null;
  if (execHost !== undefined) params.execHost = execHost ?? null;
  if (execSecurity !== undefined) params.execSecurity = execSecurity ?? null;
  if (execAsk !== undefined) params.execAsk = execAsk ?? null;

  return await executeGatewayIntent("sessions.patch", params);
}
