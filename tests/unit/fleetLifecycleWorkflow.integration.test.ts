// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  buildLatestUpdatePatch,
  resolveLatestUpdateIntent,
} from "@/features/agents/operations/latestUpdateWorkflow";
import {
  buildReconcileTerminalPatch,
  resolveReconcileEligibility,
  resolveReconcileWaitOutcome,
} from "@/features/agents/operations/fleetLifecycleWorkflow";
import type { AgentState } from "@/features/agents/state/store";

describe("fleetLifecycleWorkflow integration", () => {
  it("page adapter applies latest-update reset/update intents without behavior drift", () => {
    const resetIntent = resolveLatestUpdateIntent({
      message: "regular prompt",
      agentId: "agent-1",
      sessionKey: "agent:agent-1:main",
      hasExistingOverride: true,
    });
    expect(resetIntent).toEqual({ kind: "reset" });
    expect(buildLatestUpdatePatch("")).toEqual({
      latestOverride: null,
      latestOverrideKind: null,
    });

    const heartbeatIntent = resolveLatestUpdateIntent({
      message: "heartbeat status please",
      agentId: "",
      sessionKey: "agent:agent-1:main",
      hasExistingOverride: false,
    });
    expect(heartbeatIntent).toEqual({
      kind: "fetch-heartbeat",
      agentId: "agent-1",
      sessionLimit: 48,
      historyLimit: 200,
    });
    expect(buildLatestUpdatePatch("Heartbeat is healthy.", "heartbeat")).toEqual({
      latestOverride: "Heartbeat is healthy.",
      latestOverrideKind: "heartbeat",
    });
  });

  it("run reconciliation preserves terminal transition semantics and history reload trigger", () => {
    const runReconcileAdapter = (params: {
      status: AgentState["status"];
      sessionCreated: boolean;
      runId: string | null;
      waitStatus: unknown;
    }) => {
      const eligibility = resolveReconcileEligibility({
        status: params.status,
        sessionCreated: params.sessionCreated,
        runId: params.runId,
      });
      if (!eligibility.shouldCheck) {
        return { patch: null, shouldReloadHistory: false };
      }
      const outcome = resolveReconcileWaitOutcome(params.waitStatus);
      if (!outcome) {
        return { patch: null, shouldReloadHistory: false };
      }
      return {
        patch: buildReconcileTerminalPatch({ outcome }),
        shouldReloadHistory: true,
      };
    };

    expect(
      runReconcileAdapter({
        status: "running",
        sessionCreated: true,
        runId: "run-1",
        waitStatus: "ok",
      })
    ).toEqual({
      patch: {
        status: "idle",
        runId: null,
        runStartedAt: null,
        streamText: null,
        thinkingTrace: null,
      },
      shouldReloadHistory: true,
    });
    expect(
      runReconcileAdapter({
        status: "running",
        sessionCreated: true,
        runId: "run-1",
        waitStatus: "error",
      })
    ).toEqual({
      patch: {
        status: "error",
        runId: null,
        runStartedAt: null,
        streamText: null,
        thinkingTrace: null,
      },
      shouldReloadHistory: true,
    });
  });
});
