// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";
import {
  buildQueuedMutationBlock,
  resolveConfigMutationStatusLine,
  resolveMutationStartGuard,
} from "@/features/agents/operations/mutationLifecycleWorkflow";
import { shouldStartNextConfigMutation } from "@/features/agents/operations/configMutationGatePolicy";

describe("mutationLifecycleWorkflow integration", () => {
  it("page create handler uses shared start guard and queued block shape", () => {
    const denied = resolveMutationStartGuard({
      status: "disconnected",
      hasCreateBlock: false,
      hasRenameBlock: false,
      hasDeleteBlock: false,
    });
    expect(denied).toEqual({ kind: "deny", reason: "not-connected" });

    const allowed = resolveMutationStartGuard({
      status: "connected",
      hasCreateBlock: false,
      hasRenameBlock: false,
      hasDeleteBlock: false,
    });
    expect(allowed).toEqual({ kind: "allow" });

    const queued = buildQueuedMutationBlock({
      kind: "create-agent",
      agentId: "",
      agentName: "Agent One",
      startedAt: 42,
    });
    expect(queued).toEqual({
      kind: "create-agent",
      agentId: "",
      agentName: "Agent One",
      phase: "queued",
      startedAt: 42,
      sawDisconnect: false,
    });
  });

  it("preserves queue gating when restart block is active", () => {
    expect(
      shouldStartNextConfigMutation({
        status: "connected",
        hasRunningAgents: false,
        nextMutationRequiresIdleAgents: false,
        hasActiveMutation: false,
        hasRestartBlockInProgress: true,
        queuedCount: 1,
      })
    ).toBe(false);

    expect(
      shouldStartNextConfigMutation({
        status: "connected",
        hasRunningAgents: false,
        nextMutationRequiresIdleAgents: false,
        hasActiveMutation: false,
        hasRestartBlockInProgress: false,
        queuedCount: 1,
      })
    ).toBe(true);
  });

  it("preserves lock-status text behavior across queued, mutating, and awaiting-restart phases", () => {
    expect(
      resolveConfigMutationStatusLine({
        block: { phase: "queued", sawDisconnect: false },
        status: "connected",
      })
    ).toBe("Waiting for active runs to finish");

    expect(
      resolveConfigMutationStatusLine({
        block: { phase: "mutating", sawDisconnect: false },
        status: "connected",
      })
    ).toBe("Submitting config change");

    expect(
      resolveConfigMutationStatusLine({
        block: { phase: "awaiting-restart", sawDisconnect: false },
        status: "connected",
      })
    ).toBe("Waiting for gateway to restart");

    expect(
      resolveConfigMutationStatusLine({
        block: { phase: "awaiting-restart", sawDisconnect: true },
        status: "disconnected",
      })
    ).toBe("Gateway restart in progress");

    expect(
      resolveConfigMutationStatusLine({
        block: { phase: "awaiting-restart", sawDisconnect: true },
        status: "connected",
      })
    ).toBe("Gateway is back online, syncing agents");
  });
});
