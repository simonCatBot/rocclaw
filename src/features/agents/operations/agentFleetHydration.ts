// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { buildAgentMainSessionKey } from "@/lib/gateway/session-keys";
import { type GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import { type ROCclawSettings } from "@/lib/rocclaw/settings";
import {
  type SummaryPreviewSnapshot,
  type SummarySnapshotPatch,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import { fetchJson } from "@/lib/http";
import type { AgentStoreSeed } from "@/features/agents/state/store";
import { deriveHydrateAgentFleetResult } from "@/features/agents/operations/agentFleetHydrationDerivation";

// ─── Gateway client helpers ────────────────────────────────────────────────────

type GatewayClientLike = {
  call: (method: string, params: unknown) => Promise<unknown>;
};

const callGateway = async <T>(
  client: GatewayClientLike,
  method: string,
  params: unknown
): Promise<T> => {
  const invoke = (
    client as unknown as { call?: (nextMethod: string, nextParams: unknown) => Promise<unknown> }
  ).call;
  if (typeof invoke !== "function") {
    throw new Error("Gateway call transport is unavailable.");
  }
  return (await invoke(method, params)) as T;
};

// ─── Fetch identity files for all agents ─────────────────────────────────────

type IdentityByAgent = Record<string, { name: string; emoji: string }>;

const fetchIdentityFilesForAgents = async (
  agentIds: string[],
  baseUrl: string,
  agentDirsById: Map<string, string>,
  parallel = 6
): Promise<IdentityByAgent> => {
  const results: IdentityByAgent = {};

  for (let i = 0; i < agentIds.length; i += parallel) {
    const batch = agentIds.slice(i, i + parallel);
    const files = await Promise.all(
      batch.map(async (agentId) => {
        try {
          const result = await fetchJson<{
            ok?: boolean;
            payload?: { file?: { missing?: unknown; content?: string } };
            error?: string;
          }>(
            `${baseUrl}/api/runtime/agent-file?agentId=${encodeURIComponent(agentId)}&name=IDENTITY.md`,
            { cache: "no-store" }
          );

          const fileRecord = result?.payload?.file;
          const missing = fileRecord?.missing === true;
          const content = typeof fileRecord?.content === "string" ? fileRecord.content : "";

          if (missing || !content.trim()) {
            return { agentId, name: "", emoji: "" };
          }

          const parsed = parseIdentityContent(content);
          return { agentId, name: parsed.name, emoji: parsed.emoji };
        } catch {
          return { agentId, name: "", emoji: "" };
        }
      })
    );

    for (const entry of files) {
      results[entry.agentId] = { name: entry.name, emoji: entry.emoji };
    }
  }

  // If agents share a workspace, their IDENTITY.md will have the same name.
  // Check each agent's agentDir for an overriding IDENTITY.md.
  for (const [agentId, agentDir] of agentDirsById) {
    if (!agentDir || !results[agentId]?.name) continue;
    try {
      const fs = await import("node:fs/promises");
      const identityPath = `${agentDir}/IDENTITY.md`;
      const content = await fs.readFile(identityPath, "utf-8");
      const parsed = parseIdentityContent(content);
      if (parsed.name) {
        results[agentId] = { name: parsed.name, emoji: parsed.emoji || results[agentId]?.emoji || "" };
      }
    } catch {
      // No agentDir IDENTITY.md — keep workspace identity
    }
  }

  return results;
};

const parseIdentityContent = (content: string): { name: string; emoji: string } => {
  const lines = content.split("\n");
  let name = "";
  let emoji = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- Name:") || trimmed.startsWith("Name:")) {
      name = trimmed.split(":", 2).slice(1).join(":").trim();
    }
    if (trimmed.startsWith("- Emoji:") || trimmed.startsWith("Emoji:")) {
      emoji = trimmed.split(":", 2).slice(1).join(":").trim();
    }
  }
  return { name, emoji };
};

// ─── Result / snapshot types ───────────────────────────────────────────────────

type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope?: string;
  agents: Array<{
    id: string;
    name?: string;
    identityName?: string | null;
    identityEmoji?: string | null;
    identity?: {
      name?: string;
      theme?: string;
      emoji?: string;
      avatar?: string;
      avatarUrl?: string;
    };
  }>;
};

type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

type ExecApprovalsSnapshot = {
  file?: {
    agents?: Record<string, { security?: string | null; ask?: string | null }>;
  };
};

type HydrateAgentFleetResult = {
  seeds: AgentStoreSeed[];
  sessionCreatedAgentIds: string[];
  sessionSettingsSyncedAgentIds: string[];
  summaryPatches: SummarySnapshotPatch[];
  suggestedSelectedAgentId: string | null;
  configSnapshot: GatewayModelPolicySnapshot | null;
};

const SUMMARY_PREVIEW_LIMIT = 8;
const SUMMARY_PREVIEW_MAX_CHARS = 240;

// ─── Main hydration function ──────────────────────────────────────────────────

export async function hydrateAgentFleetFromGateway(params: {
  client: GatewayClientLike;
  gatewayUrl: string;
  cachedConfigSnapshot: GatewayModelPolicySnapshot | null;
  loadROCclawSettings: () => Promise<ROCclawSettings | null>;
  isDisconnectLikeError: (err: unknown) => boolean;
  logError?: (message: string, error: unknown) => void;
}): Promise<HydrateAgentFleetResult> {
  const logError = params.logError ?? ((message, error) => console.error(message, error));

  let configSnapshot = params.cachedConfigSnapshot;
  if (!configSnapshot) {
    try {
      configSnapshot = await callGateway<GatewayModelPolicySnapshot>(
        params.client,
        "config.get",
        {}
      );
    } catch (err) {
      if (!params.isDisconnectLikeError(err)) {
        logError("Failed to load gateway config while loading agents.", err);
      }
    }
  }

  const gatewayKey = params.gatewayUrl.trim();
  let settings: ROCclawSettings | null = null;
  if (gatewayKey) {
    try {
      settings = await params.loadROCclawSettings();
    } catch (err) {
      logError("Failed to load rocclaw settings while loading agents.", err);
    }
  }

  let execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  try {
    execApprovalsSnapshot = await callGateway<ExecApprovalsSnapshot>(
      params.client,
      "exec.approvals.get",
      {}
    );
  } catch (err) {
    if (!params.isDisconnectLikeError(err)) {
      logError("Failed to load exec approvals while loading agents.", err);
    }
  }

  const agentsResult = await callGateway<AgentsListResult>(params.client, "agents.list", {});
  const mainKey = agentsResult.mainKey?.trim() || "main";

  // Build agentDir map from config for identity override lookup
  const agentDirsById = new Map<string, string>();
  if (configSnapshot?.config?.agents?.list) {
    for (const agent of configSnapshot.config.agents.list) {
      if (agent.id && agent.agentDir) {
        agentDirsById.set(agent.id, agent.agentDir);
      }
    }
  }

  // Fetch identity files for all agents in parallel
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const identityByAgent = await fetchIdentityFilesForAgents(
    agentsResult.agents.map((a) => a.id),
    appBaseUrl,
    agentDirsById
  );

  const mainSessionKeyByAgent = new Map<string, SessionsListEntry | null>();
  if (agentsResult.agents.length > 0) {
    try {
      const sessions = await callGateway<SessionsListResult>(params.client, "sessions.list", {
        includeGlobal: false,
        includeUnknown: false,
        search: `:${mainKey}`,
      });
      const entries = Array.isArray(sessions.sessions) ? sessions.sessions : [];
      const bySessionKey = new Map<string, SessionsListEntry>();
      for (const entry of entries) {
        const key = typeof entry.key === "string" ? entry.key.trim() : "";
        if (!key || bySessionKey.has(key)) continue;
        bySessionKey.set(key, entry);
      }
      for (const agent of agentsResult.agents) {
        const expectedMainKey = buildAgentMainSessionKey(agent.id, mainKey);
        mainSessionKeyByAgent.set(agent.id, bySessionKey.get(expectedMainKey) ?? null);
      }
    } catch (err) {
      if (!params.isDisconnectLikeError(err)) {
        logError("Failed to list sessions while resolving fleet sessions.", err);
      }
      for (const agent of agentsResult.agents) {
        mainSessionKeyByAgent.set(agent.id, null);
      }
    }
  }

  let statusSummary: SummaryStatusSnapshot | null = null;
  let previewResult: SummaryPreviewSnapshot | null = null;
  try {
    const sessionKeys = Array.from(
      new Set(
        agentsResult.agents
          .filter((agent) => Boolean(mainSessionKeyByAgent.get(agent.id)))
          .map((agent) => buildAgentMainSessionKey(agent.id, mainKey))
          .filter((key) => key.trim().length > 0)
      )
    ).slice(0, 64);
    if (sessionKeys.length > 0) {
      const snapshot = await Promise.all([
        callGateway<SummaryStatusSnapshot>(params.client, "status", {}),
        callGateway<SummaryPreviewSnapshot>(params.client, "sessions.preview", {
          keys: sessionKeys,
          limit: SUMMARY_PREVIEW_LIMIT,
          maxChars: SUMMARY_PREVIEW_MAX_CHARS,
        }),
      ]);
      statusSummary = snapshot[0] ?? null;
      previewResult = snapshot[1] ?? null;
    }
  } catch (err) {
    if (!params.isDisconnectLikeError(err)) {
      logError("Failed to load initial summary snapshot.", err);
    }
  }

  const derived = deriveHydrateAgentFleetResult({
    gatewayUrl: params.gatewayUrl,
    configSnapshot: configSnapshot ?? null,
    settings,
    execApprovalsSnapshot,
    agentsResult,
    identityByAgent,
    mainSessionByAgentId: mainSessionKeyByAgent,
    statusSummary,
    previewResult,
  });

  return derived;
}
