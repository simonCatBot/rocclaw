// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { hydrateAgentFleetFromGateway } from "@/features/agents/operations/agentFleetHydration";
import {
  planBootstrapSelection,
  planFocusedFilterPatch,
  planFocusedPreferenceRestore,
  planFocusedSelectionPatch,
} from "@/features/agents/operations/bootstrapWorkflow";
import type { AgentState, AgentStoreSeed, FocusFilter } from "@/features/agents/state/store";
import { fetchJson } from "@/lib/http";
import type { GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import type { ROCclawSettings, ROCclawSettingsPatch } from "@/lib/rocclaw/settings";
import { normalizeGatewayKey } from "@/lib/rocclaw/settings";

export type ROCclawBootstrapLoadCommand =
  | { kind: "set-gateway-config-snapshot"; snapshot: GatewayModelPolicySnapshot }
  | { kind: "hydrate-agents"; seeds: AgentStoreSeed[]; initialSelectedAgentId: string | undefined }
  | { kind: "mark-session-created"; agentId: string; sessionSettingsSynced: boolean }
  | { kind: "apply-summary-patch"; agentId: string; patch: Partial<AgentState> }
  | { kind: "set-error"; message: string };

export async function runROCclawBootstrapLoadOperation(params: {
  cachedConfigSnapshot: GatewayModelPolicySnapshot | null;
  preferredSelectedAgentId: string | null;
  hasCurrentSelection: boolean;
}): Promise<ROCclawBootstrapLoadCommand[]> {
  try {
    const result = (
      await fetchJson<{ result: Awaited<ReturnType<typeof hydrateAgentFleetFromGateway>> }>(
        "/api/runtime/fleet",
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cachedConfigSnapshot: params.cachedConfigSnapshot }),
        }
      )
    ).result;

    const selectionIntent = planBootstrapSelection({
      hasCurrentSelection: params.hasCurrentSelection,
      preferredSelectedAgentId: params.preferredSelectedAgentId,
      availableAgentIds: result.seeds.map((seed) => seed.agentId),
      suggestedSelectedAgentId: result.suggestedSelectedAgentId,
    });

    const commands: ROCclawBootstrapLoadCommand[] = [];
    if (!params.cachedConfigSnapshot && result.configSnapshot) {
      commands.push({
        kind: "set-gateway-config-snapshot",
        snapshot: result.configSnapshot,
      });
    }

    commands.push({
      kind: "hydrate-agents",
      seeds: result.seeds,
      initialSelectedAgentId: selectionIntent.initialSelectedAgentId,
    });

    const sessionSettingsSyncedAgentIds = new Set(result.sessionSettingsSyncedAgentIds);
    for (const agentId of result.sessionCreatedAgentIds) {
      commands.push({
        kind: "mark-session-created",
        agentId,
        sessionSettingsSynced: sessionSettingsSyncedAgentIds.has(agentId),
      });
    }

    for (const entry of result.summaryPatches) {
      commands.push({
        kind: "apply-summary-patch",
        agentId: entry.agentId,
        patch: entry.patch,
      });
    }

    return commands;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load agents.";
    return [{ kind: "set-error", message }];
  }
}

export function executeROCclawBootstrapLoadCommands(params: {
  commands: ROCclawBootstrapLoadCommand[];
  setGatewayConfigSnapshot: (snapshot: GatewayModelPolicySnapshot) => void;
  hydrateAgents: (agents: AgentStoreSeed[], selectedAgentId?: string) => void;
  dispatchUpdateAgent: (agentId: string, patch: Partial<AgentState>) => void;
  setError: (message: string) => void;
}): void {
  for (const command of params.commands) {
    if (command.kind === "set-gateway-config-snapshot") {
      params.setGatewayConfigSnapshot(command.snapshot);
      continue;
    }
    if (command.kind === "hydrate-agents") {
      params.hydrateAgents(command.seeds, command.initialSelectedAgentId);
      continue;
    }
    if (command.kind === "mark-session-created") {
      params.dispatchUpdateAgent(command.agentId, {
        sessionCreated: true,
        sessionSettingsSynced: command.sessionSettingsSynced,
      });
      continue;
    }
    if (command.kind === "apply-summary-patch") {
      params.dispatchUpdateAgent(command.agentId, command.patch);
      continue;
    }
    params.setError(command.message);
  }
}

type ROCclawFocusedPreferenceLoadCommand =
  | { kind: "set-focused-preferences-loaded"; value: boolean }
  | { kind: "set-preferred-selected-agent-id"; agentId: string | null }
  | { kind: "set-focus-filter"; filter: FocusFilter }
  | { kind: "log-error"; message: string; error: unknown };

export async function runROCclawFocusedPreferenceLoadOperation(params: {
  gatewayUrl: string;
  loadROCclawSettings: () => Promise<ROCclawSettings | null>;
  isFocusFilterTouched: () => boolean;
}): Promise<ROCclawFocusedPreferenceLoadCommand[]> {
  const key = params.gatewayUrl.trim();
  if (!key) {
    return [
      { kind: "set-preferred-selected-agent-id", agentId: null },
      { kind: "set-focused-preferences-loaded", value: true },
    ];
  }

  try {
    const settings = await params.loadROCclawSettings();
    if (!settings || params.isFocusFilterTouched()) {
      return [{ kind: "set-focused-preferences-loaded", value: true }];
    }

    const normalizedKey = normalizeGatewayKey(key);
    const restoreIntent = planFocusedPreferenceRestore({
      settings,
      gatewayKey: normalizedKey ?? key,
      focusFilterTouched: false,
    });

    return [
      {
        kind: "set-preferred-selected-agent-id",
        agentId: restoreIntent.preferredSelectedAgentId,
      },
      {
        kind: "set-focus-filter",
        filter: restoreIntent.focusFilter,
      },
      { kind: "set-focused-preferences-loaded", value: true },
    ];
  } catch (error) {
    return [
      {
        kind: "log-error",
        message: "Failed to load focused preference.",
        error,
      },
      { kind: "set-focused-preferences-loaded", value: true },
    ];
  }
}

export function executeROCclawFocusedPreferenceLoadCommands(params: {
  commands: ROCclawFocusedPreferenceLoadCommand[];
  setFocusedPreferencesLoaded: (value: boolean) => void;
  setPreferredSelectedAgentId: (agentId: string | null) => void;
  setFocusFilter: (filter: FocusFilter) => void;
  logError: (message: string, error: unknown) => void;
}): void {
  for (const command of params.commands) {
    if (command.kind === "set-focused-preferences-loaded") {
      params.setFocusedPreferencesLoaded(command.value);
      continue;
    }
    if (command.kind === "set-preferred-selected-agent-id") {
      params.setPreferredSelectedAgentId(command.agentId);
      continue;
    }
    if (command.kind === "set-focus-filter") {
      params.setFocusFilter(command.filter);
      continue;
    }
    params.logError(command.message, command.error);
  }
}

type ROCclawFocusedPatchCommand = {
  kind: "schedule-settings-patch";
  patch: ROCclawSettingsPatch;
  debounceMs: number;
} | {
  kind: "apply-settings-patch-now";
  patch: ROCclawSettingsPatch;
};

export function runROCclawFocusFilterPersistenceOperation(params: {
  gatewayUrl: string;
  focusFilterTouched: boolean;
  focusFilter: FocusFilter;
}): ROCclawFocusedPatchCommand[] {
  const patchIntent = planFocusedFilterPatch({
    gatewayKey: params.gatewayUrl,
    focusFilterTouched: params.focusFilterTouched,
    focusFilter: params.focusFilter,
  });
  if (patchIntent.kind !== "patch") {
    return [];
  }
  return [
    {
      kind: "schedule-settings-patch",
      patch: patchIntent.patch,
      debounceMs: patchIntent.debounceMs,
    },
  ];
}

export function runROCclawFocusedSelectionPersistenceOperation(params: {
  gatewayUrl: string;
  status: "connected" | "connecting" | "disconnected";
  focusedPreferencesLoaded: boolean;
  agentsLoadedOnce: boolean;
  selectedAgentId: string | null;
  lastPersistedSelectedAgentId?: string | null;
}): ROCclawFocusedPatchCommand[] {
  const patchIntent = planFocusedSelectionPatch({
    gatewayKey: params.gatewayUrl,
    status: params.status,
    focusedPreferencesLoaded: params.focusedPreferencesLoaded,
    agentsLoadedOnce: params.agentsLoadedOnce,
    selectedAgentId: params.selectedAgentId,
    lastPersistedSelectedAgentId: params.lastPersistedSelectedAgentId,
  });

  if (patchIntent.kind !== "patch") {
    return [];
  }

  if (patchIntent.persistence === "immediate") {
    return [
      {
        kind: "apply-settings-patch-now",
        patch: patchIntent.patch,
      },
    ];
  }

  return [];
}

export function executeROCclawFocusedPatchCommands(params: {
  commands: ROCclawFocusedPatchCommand[];
  schedulePatch: (patch: ROCclawSettingsPatch, debounceMs?: number) => void;
  applyPatchNow: (patch: ROCclawSettingsPatch) => Promise<void>;
  logError?: (message: string, error: unknown) => void;
}): void {
  for (const command of params.commands) {
    if (command.kind === "schedule-settings-patch") {
      params.schedulePatch(command.patch, command.debounceMs);
      continue;
    }
    void params.applyPatchNow(command.patch).catch((error) => {
      if (params.logError) {
        params.logError("Failed to persist focused rocclaw preference immediately.", error);
      }
    });
  }
}
