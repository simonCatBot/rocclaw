// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";
import {
  buildQueuedMutationBlock,
  resolveMutationStartGuard,
} from "@/features/agents/operations/mutationLifecycleWorkflow";

describe("mutationLifecycleWorkflow", () => {
  it("blocks mutation starts when another mutation block is active", () => {
    expect(
      resolveMutationStartGuard({
        status: "disconnected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "deny", reason: "not-connected" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: true,
        hasRenameBlock: false,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "deny", reason: "create-block-active" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: true,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "deny", reason: "rename-block-active" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: true,
      })
    ).toEqual({ kind: "deny", reason: "delete-block-active" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "allow" });
  });

  it("builds deterministic queued block transitions", () => {
    const queued = buildQueuedMutationBlock({
      kind: "rename-agent",
      agentId: "agent-1",
      agentName: "Agent One",
      startedAt: 123,
    });

    expect(queued).toEqual({
      kind: "rename-agent",
      agentId: "agent-1",
      agentName: "Agent One",
      phase: "queued",
      startedAt: 123,
      sawDisconnect: false,
    });
  });
});
