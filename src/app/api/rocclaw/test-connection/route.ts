import { NextResponse } from "next/server";

import {
  OpenClawGatewayAdapter,
  serializeControlPlaneGatewayConnectFailure,
} from "@/lib/controlplane/openclaw-adapter";
import { loadStudioSettings } from "@/lib/rocclaw/settings-store";
import {
  testConnectionSchema,
  validateInput,
  createValidationErrorResponse,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

const readString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const resolveStoredToken = (): string => {
  return readString(loadStudioSettings().gateway?.token);
};

export async function POST(request: Request) {
  let adapter: OpenClawGatewayAdapter | null = null;
  try {
    const body = (await request.json()) as unknown;

    // Validate input with Zod
    const validation = validateInput(testConnectionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        createValidationErrorResponse(validation.error, validation.issues),
        { status: 400 }
      );
    }

    const { gateway, useStoredToken } = validation.data;
    const url = gateway.url;

    // Use provided token or fall back to stored token if allowed
    const tokenInput = gateway.token || "";
    const token = tokenInput || (useStoredToken ? resolveStoredToken() : "");
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Gateway token is required. Enter one or keep the stored token.",
        },
        { status: 400 }
      );
    }

    adapter = new OpenClawGatewayAdapter({
      loadSettings: () => ({ url, token }),
    });
    await adapter.start();
    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const startFailure = serializeControlPlaneGatewayConnectFailure(error);
    const message =
      startFailure?.message ??
      (error instanceof Error ? error.message : "Connection test failed.");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        ...(startFailure ? { startFailure } : {}),
        checkedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } finally {
    if (adapter) {
      try {
        await adapter.stop();
      } catch {}
    }
  }
}
