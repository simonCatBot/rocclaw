import { buildAgentMainSessionKey } from "@/lib/gateway/session-keys";
import { type GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import { type ROCclawSettings } from "@/lib/rocclaw/settings";
import {
  type SummaryPreviewSnapshot,
  type SummarySnapshotPatch,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import type { AgentFileName } from "@/lib/agents/agentFiles";
import { parsePersonalityFiles } from "@/lib/agents/personalityBuilder";
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
  client: GatewayClientLike,
  agentIds: string[],
  parallel = 6
): Promise<IdentityByAgent> => {
  const results: IdentityByAgent = {};

  // Process in batches to avoid overwhelming the gateway
  for (let i = 0; i < agentIds.length; i += parallel) {
    const batch = agentIds.slice(i, i + parallel);
    const files = await Promise.all(
      batch.map(async (agentId) => {
        try {
          const response = await callGateway<{
            file?: { missing?: unknown; content?: unknown };
          }>(client, "agents.files.get", { agentId, name: "IDENTITY.md" as AgentFileName });

          const file = response?.file;
          const fileRecord = file && typeof file === "object" ? (file as Record<string, unknown>) : null;
          const missing = fileRecord?.missing === true;
          const content =
            fileRecord && typeof fileRecord.content === "string" ? fileRecord.content : "";

          if (missing || !content.trim()) {
            return { agentId, name: "", emoji: "" };
          }

          const draft = parsePersonalityFiles({
            "IDENTITY.md": { content, exists: true },
          } as Record<AgentFileName, { content: string; exists: boolean }>);
          return {
            agentId,
            name: draft.identity.name || "",
            emoji: draft.identity.emoji || "",
          };
        } catch {
          return { agentId, name: "", emoji: "" };
        }
      })
    );

    for (const entry of files) {
      results[entry.agentId] = { name: entry.name, emoji: entry.emoji };
    }
  }

  return results;
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

  // Fetch identity files for all agents in parallel
  const identityByAgent = await fetchIdentityFilesForAgents(
    params.client,
    agentsResult.agents.map((a) => a.id)
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
