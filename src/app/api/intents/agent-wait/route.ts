import {
  parseIntentBody,
  executeGatewayIntent,
  LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS,
} from "@/lib/controlplane/intent-route";
import { z } from "zod";
import {
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

const agentWaitSchema = z.object({
  runId: z.string().min(1).max(256).trim(),
  timeoutMs: z.number().int().positive().max(600_000).optional(),
});

export async function POST(request: Request) {
  const parsed = await parseIntentBody(request);
  if (parsed instanceof Response) return parsed;

  // Validate input with Zod
  const validation = validateInput(agentWaitSchema, parsed);
  if (!validation.success) {
    return Response.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { runId, timeoutMs } = validation.data;

  return executeGatewayIntent(
    "agent.wait",
    {
      runId,
      ...(typeof timeoutMs === "number" ? { timeoutMs } : {}),
    },
    {
      timeoutMs: typeof timeoutMs === "number" ? timeoutMs : LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS,
    }
  );
}
