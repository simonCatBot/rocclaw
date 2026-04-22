// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import {
  ensureDomainIntentRuntime,
  parseIntentBody,
} from "@/lib/controlplane/intent-route";
import { ControlPlaneGatewayError } from "@/lib/controlplane/openclaw-adapter";

export const runtime = "nodejs";

type GatewayConfigSnapshot = {
  config?: unknown;
  hash?: string;
  exists?: boolean;
};

type ConfigAgentEntry = Record<string, unknown> & { id: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readConfigAgentList = (config: Record<string, unknown>): ConfigAgentEntry[] => {
  const agents = isRecord(config.agents) ? config.agents : null;
  const list = Array.isArray(agents?.list) ? agents.list : [];
  return list.filter((entry): entry is ConfigAgentEntry => {
    if (!isRecord(entry)) return false;
    if (typeof entry.id !== "string") return false;
    return entry.id.trim().length > 0;
  });
};

const writeConfigAgentList = (
  config: Record<string, unknown>,
  list: ConfigAgentEntry[]
): Record<string, unknown> => {
  const agents = isRecord(config.agents) ? { ...config.agents } : {};
  return { ...config, agents: { ...agents, list } };
};

const isConfigConflict = (err: unknown): boolean => {
  if (!(err instanceof ControlPlaneGatewayError)) return false;
  if (err.code.trim().toUpperCase() !== "INVALID_REQUEST") return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("basehash") ||
    message.includes("base hash") ||
    message.includes("changed since last load") ||
    message.includes("re-run config.get")
  );
};

const isGatewayUnavailable = (err: unknown): boolean =>
  err instanceof ControlPlaneGatewayError && err.code.trim().toUpperCase() === "GATEWAY_UNAVAILABLE";

const buildConfigSetPayload = (params: {
  config: Record<string, unknown>;
  hash?: string;
  exists?: boolean;
}): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    raw: JSON.stringify(params.config, null, 2),
  };
  if (params.exists !== false) {
    const baseHash = params.hash?.trim();
    if (!baseHash) {
      throw new Error("Gateway config hash unavailable; re-run config.get.");
    }
    payload.baseHash = baseHash;
  }
  return payload;
};

/**
 * POST /api/intents/agent-skills-assign
 *
 * Updates the `skills` array on an agent entry in the gateway config.
 * This is the official allowlist: omit = all skills, empty = no skills,
 * array = only listed skills.
 *
 * Body: { agentId: string, skills: string[] }
 */
export async function POST(request: Request) {
  const bodyOrError = await parseIntentBody(request);
  if (bodyOrError instanceof Response) {
    return bodyOrError as NextResponse;
  }

  const agentId = typeof bodyOrError.agentId === "string" ? bodyOrError.agentId.trim() : "";
  const skillsList = Array.isArray(bodyOrError.skills)
    ? bodyOrError.skills.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
    : null;

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }
  if (skillsList === null) {
    return NextResponse.json({ error: "skills must be an array of strings." }, { status: 400 });
  }

  const runtimeOrError = await ensureDomainIntentRuntime();
  if (runtimeOrError instanceof Response) {
    return runtimeOrError as NextResponse;
  }

  try {
    const snapshot = await runtimeOrError.callGateway<GatewayConfigSnapshot>("config.get", {});
    const baseConfig = isRecord(snapshot.config) ? (snapshot.config as Record<string, unknown>) : {};
    const list = readConfigAgentList(baseConfig);

    let found = false;
    const nextList = list.map((entry) => {
      if (entry.id !== agentId) return entry;
      found = true;
      return { ...entry, skills: skillsList };
    });

    if (!found) {
      nextList.push({ id: agentId, skills: skillsList });
    }

    const nextConfig = writeConfigAgentList(baseConfig, nextList);
    const payload = buildConfigSetPayload({
      config: nextConfig,
      hash: snapshot.hash,
      exists: snapshot.exists,
    });

    await runtimeOrError.callGateway("config.set", payload);

    return NextResponse.json({ ok: true, agentId, skills: skillsList });
  } catch (err) {
    if (isGatewayUnavailable(err)) {
      return NextResponse.json(
        { error: "Gateway is unavailable.", code: "GATEWAY_UNAVAILABLE" },
        { status: 503 }
      );
    }
    if (isConfigConflict(err)) {
      const message = err instanceof Error ? err.message : "config conflict";
      return NextResponse.json(
        { error: message, code: "INVALID_REQUEST", conflict: "base_hash_mismatch" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "agent_skills_assign_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}