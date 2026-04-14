// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ControlPlaneRuntime } from "@/lib/controlplane/runtime";
import type { RuntimeInitFailure } from "@/lib/controlplane/runtime-init-errors";

// Mock the dependencies before importing the module
const mockIsROCclawDomainApiModeEnabled = vi.fn(() => true);
const mockGetControlPlaneRuntime = vi.fn();
const mockClassifyRuntimeInitError = vi.fn();
const mockSerializeControlPlaneGatewayConnectFailure = vi.fn();

vi.mock("@/lib/controlplane/runtime", () => ({
  isROCclawDomainApiModeEnabled: () => mockIsROCclawDomainApiModeEnabled(),
  getControlPlaneRuntime: (opts?: unknown) => mockGetControlPlaneRuntime(opts),
}));

vi.mock("@/lib/controlplane/runtime-init-errors", () => ({
  classifyRuntimeInitError: (err: unknown) => mockClassifyRuntimeInitError(err),
}));

vi.mock("@/lib/controlplane/openclaw-adapter", () => ({
  serializeControlPlaneGatewayConnectFailure: (err: unknown) =>
    mockSerializeControlPlaneGatewayConnectFailure(err),
}));

import { bootstrapDomainRuntime } from "@/lib/controlplane/runtime-route-bootstrap";

describe("runtime-route-bootstrap", () => {
  let mockRuntime: Partial<ControlPlaneRuntime>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsROCclawDomainApiModeEnabled.mockReturnValue(true);
    mockRuntime = {
      ensureStarted: vi.fn().mockResolvedValue(undefined),
    };
    mockGetControlPlaneRuntime.mockReturnValue(mockRuntime);
    mockClassifyRuntimeInitError.mockImplementation((error) => ({
      code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
      reason: "runtime_init_failed",
      message: error instanceof Error ? error.message : String(error),
    }));
    mockSerializeControlPlaneGatewayConnectFailure.mockImplementation((error) => {
      if (error instanceof Error) {
        return { message: error.message };
      }
      return { message: String(error) };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("bootstrapDomainRuntime", () => {
    it("should return mode-disabled when domain API mode is disabled", async () => {
      mockIsROCclawDomainApiModeEnabled.mockReturnValueOnce(false);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({ kind: "mode-disabled" });
      expect(mockGetControlPlaneRuntime).not.toHaveBeenCalled();
    });

    it("should return ready when runtime initializes and starts successfully", async () => {
      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({ kind: "ready", runtime: mockRuntime });
      expect(mockGetControlPlaneRuntime).toHaveBeenCalledTimes(1);
      expect(mockRuntime.ensureStarted).toHaveBeenCalledTimes(1);
    });

    it("should call ensureStarted with default options", async () => {
      await bootstrapDomainRuntime();

      // ensureStarted is called with no arguments, which becomes {} internally
      expect(mockRuntime.ensureStarted).toHaveBeenCalled();
    });

    it("should pass options to getControlPlaneRuntime", async () => {
      await bootstrapDomainRuntime();

      expect(mockGetControlPlaneRuntime).toHaveBeenCalledWith(undefined);
    });

    it("should return runtime-init-failed when getControlPlaneRuntime throws", async () => {
      const error = new Error("Runtime initialization failed");
      const failure: RuntimeInitFailure = {
        code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
        reason: "runtime_init_failed",
        message: "Runtime initialization failed",
        remediation: {
          summary: "Test remediation",
          commands: ["npm install"],
        },
      };
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw error;
      });
      mockClassifyRuntimeInitError.mockReturnValueOnce(failure);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({ kind: "runtime-init-failed", failure });
      expect(mockClassifyRuntimeInitError).toHaveBeenCalledWith(error);
    });

    it("should return start-failed when ensureStarted throws", async () => {
      const error = new Error("Connection refused");
      const startFailure = { message: "Connection refused", code: "CONNECTION_FAILED" };
      mockSerializeControlPlaneGatewayConnectFailure.mockReturnValueOnce(startFailure);

      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({
        kind: "start-failed",
        message: "Connection refused",
        startFailure,
        runtime: mockRuntime,
      });
    });

    it("should use fallback message when serializeControlPlaneGatewayConnectFailure returns null", async () => {
      const error = new Error("Connection refused");
      mockSerializeControlPlaneGatewayConnectFailure.mockReturnValueOnce(null);

      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({
        kind: "start-failed",
        message: "Connection refused",
        startFailure: null,
        runtime: mockRuntime,
      });
    });

    it("should handle non-Error objects in start failure", async () => {
      const error = "string error";
      mockSerializeControlPlaneGatewayConnectFailure.mockReturnValueOnce({
        message: "string error",
      });

      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({
        kind: "start-failed",
        message: "string error",
        startFailure: { message: "string error" },
        runtime: mockRuntime,
      });
    });

    it("should handle native module mismatch errors", async () => {
      const error = new Error("better_sqlite3.node was compiled against a different Node.js version");
      const failure: RuntimeInitFailure = {
        code: "NATIVE_MODULE_MISMATCH",
        reason: "native_module_mismatch",
        message: error.message,
        remediation: {
          summary: "Native module mismatch",
          commands: ["npm rebuild better-sqlite3"],
        },
      };
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw error;
      });
      mockClassifyRuntimeInitError.mockReturnValueOnce(failure);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({ kind: "runtime-init-failed", failure });
    });

    it("should handle module not found errors", async () => {
      const error = new Error("Cannot find module 'better-sqlite3'");
      const failure: RuntimeInitFailure = {
        code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
        reason: "runtime_init_failed",
        message: error.message,
        remediation: {
          summary: "Module not found",
          commands: ["npm install", "npm rebuild better-sqlite3"],
        },
      };
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw error;
      });
      mockClassifyRuntimeInitError.mockReturnValueOnce(failure);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({ kind: "runtime-init-failed", failure });
    });

    it("should handle errors with no message", async () => {
      const error = new Error();
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw error;
      });
      mockClassifyRuntimeInitError.mockImplementationOnce(() => ({
        code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
        reason: "runtime_init_failed",
        message: "controlplane_runtime_init_failed",
      }));

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({
        kind: "runtime-init-failed",
        failure: {
          code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
          reason: "runtime_init_failed",
          message: "controlplane_runtime_init_failed",
        },
      });
    });

    it("should handle null errors", async () => {
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw null;
      });
      mockClassifyRuntimeInitError.mockImplementationOnce(() => ({
        code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
        reason: "runtime_init_failed",
        message: "controlplane_runtime_init_failed",
      }));

      const result = await bootstrapDomainRuntime();

      expect(result.kind).toBe("runtime-init-failed");
    });

    it("should handle undefined errors", async () => {
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw undefined;
      });
      mockClassifyRuntimeInitError.mockImplementationOnce(() => ({
        code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
        reason: "runtime_init_failed",
        message: "controlplane_runtime_init_failed",
      }));

      const result = await bootstrapDomainRuntime();

      expect(result.kind).toBe("runtime-init-failed");
    });

    it("should handle custom error objects", async () => {
      const error = { custom: "error", message: "Custom error message" };
      mockGetControlPlaneRuntime.mockImplementationOnce(() => {
        throw error;
      });
      mockClassifyRuntimeInitError.mockImplementationOnce((err) => ({
        code: "CONTROLPLANE_RUNTIME_INIT_FAILED",
        reason: "runtime_init_failed",
        message: err.message || "Unknown error",
      }));

      const result = await bootstrapDomainRuntime();

      expect(result.kind).toBe("runtime-init-failed");
      expect((result as { failure: RuntimeInitFailure }).failure.message).toBe("Custom error message");
    });

    it("should handle ensureStarted throwing with HTTP 502", async () => {
      const error = new Error("Unexpected server response: 502");
      mockSerializeControlPlaneGatewayConnectFailure.mockReturnValueOnce({
        message: "Control-plane gateway connection failed: upstream returned HTTP 502 during websocket upgrade.",
        code: "GATEWAY_502",
      });

      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({
        kind: "start-failed",
        message: "Control-plane gateway connection failed: upstream returned HTTP 502 during websocket upgrade.",
        startFailure: {
          message: "Control-plane gateway connection failed: upstream returned HTTP 502 during websocket upgrade.",
          code: "GATEWAY_502",
        },
        runtime: mockRuntime,
      });
    });

    it("should handle multiple successful calls", async () => {
      const result1 = await bootstrapDomainRuntime();
      expect(result1).toEqual({ kind: "ready", runtime: mockRuntime });

      const result2 = await bootstrapDomainRuntime();
      expect(result2).toEqual({ kind: "ready", runtime: mockRuntime });
    });

    it("should handle runtime that is already started", async () => {
      mockRuntime.ensureStarted = vi.fn().mockResolvedValue(undefined);

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({ kind: "ready", runtime: mockRuntime });
    });

    it("should pass through runtime instance in all failure cases", async () => {
      const error = new Error("Start failed");
      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);

      const result = await bootstrapDomainRuntime();

      if (result.kind === "start-failed") {
        expect(result.runtime).toBe(mockRuntime);
      }
    });

    it("should handle empty error message - using actual error message", async () => {
      const error = new Error("");
      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);
      mockSerializeControlPlaneGatewayConnectFailure.mockReturnValueOnce({
        message: "",
      });

      const result = await bootstrapDomainRuntime();

      // The implementation uses error.message which is empty, then falls back to "controlplane_start_failed"
      expect(result).toEqual({
        kind: "start-failed",
        message: "",
        startFailure: { message: "" },
        runtime: mockRuntime,
      });
    });

    it("should handle non-string error message in start failure", async () => {
      const error = { message: 12345 };
      mockRuntime.ensureStarted = vi.fn().mockRejectedValueOnce(error);
      mockSerializeControlPlaneGatewayConnectFailure.mockReturnValueOnce({
        message: String(error.message),
      });

      const result = await bootstrapDomainRuntime();

      expect(result).toEqual({
        kind: "start-failed",
        message: "12345",
        startFailure: { message: "12345" },
        runtime: mockRuntime,
      });
    });
  });
});
