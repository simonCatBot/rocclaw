import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import {
  chatSendSchema,
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

// Override body size limit for chat messages (5MB for large messages with attachments)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};

export async function POST(request: Request) {
  const rateLimitCheck = await import("@/lib/controlplane/intent-route").then(
    (m) => m.checkIntentRateLimit
  );
  const rateLimited = rateLimitCheck(request, "chat.send");
  if (rateLimited) {
    return rateLimited;
  }

  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  // Validate input with Zod
  const validation = validateInput(chatSendSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { sessionKey, message, idempotencyKey, deliver } = validation.data;

  return await executeGatewayIntent("chat.send", {
    sessionKey,
    message,
    idempotencyKey,
    deliver,
  });
}
