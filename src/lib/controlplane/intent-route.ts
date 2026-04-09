// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { ControlPlaneGatewayError } from "@/lib/controlplane/openclaw-adapter";
import { serializeRuntimeInitFailure } from "@/lib/controlplane/runtime-init-errors";
import { bootstrapDomainRuntime } from "@/lib/controlplane/runtime-route-bootstrap";
import type { ControlPlaneRuntime } from "@/lib/controlplane/runtime";
import {
  checkRateLimit,
  rateLimitRemaining,
} from "@/lib/rate-limit";

export const LONG_RUNNING_GATEWAY_INTENT_TIMEOUT_MS = 600_000;

/** Higher rate limit for chat-send (users typing in real time). */
const CHAT_SEND_RATE_LIMIT = 30; // 30 messages/s per client — well above normal typing speed
/** Default rate limit for other intent routes. */
const DEFAULT_INTENT_RATE_LIMIT = 60; // 60 req/s per client

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isConfigConflict = (error: ControlPlaneGatewayError): boolean => {
  const code = error.code.trim().toUpperCase();
  const message = error.message.toLowerCase();
  return (
    code === "INVALID_REQUEST" &&
    (message.includes("basehash") ||
      message.includes("base hash") ||
      message.includes("changed since last load") ||
      message.includes("re-run config.get"))
  );
};

const resolveRateLimitKey = (request: Request): string => {
  // Use x-forwarded-for header if behind a proxy, otherwise fall back to
  // the direct remote address. In production this should be set correctly
  // by your reverse proxy (nginx, cloudflare, etc.).
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
};

const rateLimitHeaders = (request: Request, limit: number) => {
  const key = resolveRateLimitKey(request);
  const remaining = rateLimitRemaining(key, limit);
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
  };
};

export const ensureDomainIntentRuntime = async (): Promise<
  ControlPlaneRuntime | Response
> => {
  const bootstrap = await bootstrapDomainRuntime();
  if (bootstrap.kind === "mode-disabled") {
    return NextResponse.json({ error: "domain_api_mode_disabled" }, { status: 404 });
  }
  if (bootstrap.kind === "runtime-init-failed") {
    return NextResponse.json(
      serializeRuntimeInitFailure(bootstrap.failure),
      { status: 503 }
    );
  }
  if (bootstrap.kind === "start-failed") {
    return NextResponse.json(
      { error: bootstrap.message, code: "GATEWAY_UNAVAILABLE", reason: "gateway_unavailable" },
      { status: 503 }
    );
  }
  return bootstrap.runtime;
};

export const parseIntentBody = async (request: Request): Promise<Record<string, unknown> | Response> => {
  try {
    const body = (await request.json()) as unknown;
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid intent payload." }, { status: 400 });
    }
    return body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
};

/**
 * Checks the rate limit for an incoming intent request.
 *
 * Returns a `NextResponse` with status 429 if rate limited (caller should return it).
 * Returns `null` if the request is allowed.
 */
export const checkIntentRateLimit = (
  request: Request,
  method: string
): Response | null => {
  const key = resolveRateLimitKey(request);
  const limit = method === "chat.send" ? CHAT_SEND_RATE_LIMIT : DEFAULT_INTENT_RATE_LIMIT;
  if (checkRateLimit(key, limit)) {
    return null;
  }
  const headers = rateLimitHeaders(request, limit);
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down.",
      code: "RATE_LIMITED",
      retryAfterSeconds: 1,
    },
    {
      status: 429,
      headers: {
        "Retry-After": "1",
        ...headers,
      },
    }
  );
};

export const executeGatewayIntent = async <T>(
  method: string,
  params: unknown,
  options?: { timeoutMs?: number },
  request?: Request
): Promise<NextResponse> => {
  const runtimeOrError = await ensureDomainIntentRuntime();
  if (runtimeOrError instanceof Response) {
    return runtimeOrError as NextResponse;
  }

  const baseHeaders = request ? rateLimitHeaders(request, method === "chat.send" ? CHAT_SEND_RATE_LIMIT : DEFAULT_INTENT_RATE_LIMIT) : {};

  try {
    const payload =
      typeof options?.timeoutMs === "number"
        ? await runtimeOrError.callGateway<T>(method, params, options)
        : await runtimeOrError.callGateway<T>(method, params);
    return NextResponse.json({ ok: true, payload }, { headers: baseHeaders });
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      if (err.code.trim().toUpperCase() === "GATEWAY_UNAVAILABLE") {
        return NextResponse.json(
          {
            error: err.message,
            code: "GATEWAY_UNAVAILABLE",
            reason: "gateway_unavailable",
          },
          { status: 503, headers: baseHeaders }
        );
      }
      if (isConfigConflict(err)) {
        return NextResponse.json(
          {
            error: err.message,
            code: err.code,
            conflict: "base_hash_mismatch",
          },
          { status: 409, headers: baseHeaders }
        );
      }
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: err.details,
        },
        { status: 400, headers: baseHeaders }
      );
    }
    const message = err instanceof Error ? err.message : "intent_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: baseHeaders });
  }
};
