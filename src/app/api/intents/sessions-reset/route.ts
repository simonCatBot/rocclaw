import { parseIntentBody, executeGatewayIntent } from "@/lib/controlplane/intent-route";
import { z } from "zod";
import {
  sessionKeySchema,
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

const sessionsResetSchema = z.object({
  key: sessionKeySchema,
});

export async function POST(request: Request) {
  const parsed = await parseIntentBody(request);
  if (parsed instanceof Response) return parsed;

  // Validate input with Zod
  const validation = validateInput(sessionsResetSchema, parsed);
  if (!validation.success) {
    return Response.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { key } = validation.data;
  return executeGatewayIntent("sessions.reset", { key });
}
