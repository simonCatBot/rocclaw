// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

type ReconcileEligibility = {
  shouldCheck: boolean;
  reason: "ok" | "not-running" | "missing-run-id" | "not-session-created";
};

export const resolveReconcileEligibility = (params: {
  status: "running" | "idle" | "error";
  sessionCreated: boolean;
  runId: string | null;
}): ReconcileEligibility => {
  if (params.status !== "running") {
    return { shouldCheck: false, reason: "not-running" };
  }
  if (!params.sessionCreated) {
    return { shouldCheck: false, reason: "not-session-created" };
  }
  const runId = params.runId?.trim() ?? "";
  if (!runId) {
    return { shouldCheck: false, reason: "missing-run-id" };
  }
  return { shouldCheck: true, reason: "ok" };
};

export const buildReconcileTerminalPatch = (params: {
  outcome: "ok" | "error";
}): {
  status: "idle" | "error";
  runId: null;
  runStartedAt: null;
  streamText: null;
  thinkingTrace: null;
} => {
  return {
    status: params.outcome === "error" ? "error" : "idle",
    runId: null,
    runStartedAt: null,
    streamText: null,
    thinkingTrace: null,
  };
};

export const resolveReconcileWaitOutcome = (status: unknown): "ok" | "error" | null => {
  if (status === "ok" || status === "error") {
    return status;
  }
  return null;
};
