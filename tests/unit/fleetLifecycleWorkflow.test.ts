// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  buildReconcileTerminalPatch,
  resolveReconcileEligibility,
  resolveReconcileWaitOutcome,
} from "@/features/agents/operations/fleetLifecycleWorkflow";

describe("fleetLifecycleWorkflow", () => {
  it("maps reconcile wait result ok/error to idle/error terminal patch", () => {
    expect(resolveReconcileWaitOutcome("ok")).toBe("ok");
    expect(resolveReconcileWaitOutcome("error")).toBe("error");
    expect(resolveReconcileWaitOutcome("running")).toBeNull();
    expect(buildReconcileTerminalPatch({ outcome: "ok" })).toEqual({
      status: "idle",
      runId: null,
      runStartedAt: null,
      streamText: null,
      thinkingTrace: null,
    });
    expect(buildReconcileTerminalPatch({ outcome: "error" })).toEqual({
      status: "error",
      runId: null,
      runStartedAt: null,
      streamText: null,
      thinkingTrace: null,
    });
  });

  it("rejects reconcile intent for non-running or missing-run agents", () => {
    expect(
      resolveReconcileEligibility({
        status: "idle",
        sessionCreated: true,
        runId: "run-1",
      })
    ).toEqual({
      shouldCheck: false,
      reason: "not-running",
    });
    expect(
      resolveReconcileEligibility({
        status: "running",
        sessionCreated: false,
        runId: "run-1",
      })
    ).toEqual({
      shouldCheck: false,
      reason: "not-session-created",
    });
    expect(
      resolveReconcileEligibility({
        status: "running",
        sessionCreated: true,
        runId: "   ",
      })
    ).toEqual({
      shouldCheck: false,
      reason: "missing-run-id",
    });
    expect(
      resolveReconcileEligibility({
        status: "running",
        sessionCreated: true,
        runId: "run-1",
      })
    ).toEqual({
      shouldCheck: true,
      reason: "ok",
    });
  });
});
