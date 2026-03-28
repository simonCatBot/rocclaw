import { NextResponse } from "next/server";

import { executeGatewayIntent, parseIntentBody } from "@/lib/controlplane/intent-route";
import {
  agentFileSetSchema,
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

// Override body size limit for file uploads (5MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};

export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  // Validate input with Zod
  const validation = validateInput(agentFileSetSchema, bodyOrError);
  if (!validation.success) {
    return NextResponse.json(
      createValidationErrorResponse(validation.error, validation.issues),
      { status: 400 }
    );
  }

  const { agentId, path, content } = validation.data;
  return await executeGatewayIntent("agents.files.set", {
    agentId,
    name: path,
    content,
  });
}
