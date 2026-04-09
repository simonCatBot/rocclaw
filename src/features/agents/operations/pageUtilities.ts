// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import type { AgentState } from "@/features/agents/state/store";
import { slugifyAgentName } from "@/lib/gateway/agentConfig";

export const PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS = 500;

export const RESERVED_MAIN_AGENT_ID = "main";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const normalizeControlUiBasePath = (basePath: string): string => {
  let normalized = basePath.trim();
  if (!normalized || normalized === "/") return "";
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

export const resolveControlUiUrl = (params: {
  gatewayUrl: string;
  configSnapshot: GatewayModelPolicySnapshot | null;
}): string | null => {
  const rawGatewayUrl = params.gatewayUrl.trim();
  if (!rawGatewayUrl) return null;

  let controlUiEnabled = true;
  let controlUiBasePath = "";

  const config = params.configSnapshot?.config;
  if (isRecord(config)) {
    const configRecord = config as Record<string, unknown>;
    const gateway = isRecord(configRecord["gateway"])
      ? (configRecord["gateway"] as Record<string, unknown>)
      : null;
    const controlUi = gateway && isRecord(gateway.controlUi) ? gateway.controlUi : null;
    if (controlUi && typeof controlUi.enabled === "boolean") {
      controlUiEnabled = controlUi.enabled;
    }
    if (typeof controlUi?.basePath === "string") {
      controlUiBasePath = normalizeControlUiBasePath(controlUi.basePath);
    }
  }

  if (!controlUiEnabled) return null;

  try {
    const url = new URL(rawGatewayUrl);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }
    url.pathname = controlUiBasePath ? `${controlUiBasePath}/` : "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

export const resolveNextNewAgentName = (agents: AgentState[]) => {
  const baseName = "New Agent";
  const existingNames = new Set(
    agents.map((agent) => agent.name.trim().toLowerCase()).filter((name) => name.length > 0)
  );
  const existingIds = new Set(
    agents
      .map((agent) => agent.agentId.trim().toLowerCase())
      .filter((agentId) => agentId.length > 0)
  );
  const baseLower = baseName.toLowerCase();
  if (!existingNames.has(baseLower) && !existingIds.has(slugifyAgentName(baseName))) return baseName;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (existingNames.has(candidate.toLowerCase())) continue;
    if (existingIds.has(slugifyAgentName(candidate))) continue;
    return candidate;
  }
  throw new Error("Unable to allocate a unique agent name.");
};
