import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import { z } from "zod";
import {
  uuidString,
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

const VALID_DECISIONS = ["allow-once", "allow-always", "deny"] as const;

const execApprovalResolveSchema = z.object({
  id: uuidString,
  decision: z.enum(VALID_DECISIONS),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  // Validate input with Zod
  const validation = validateInput(execApprovalResolveSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { id, decision } = validation.data;
  return await executeGatewayIntent("exec.approval.resolve", { id, decision });
}
