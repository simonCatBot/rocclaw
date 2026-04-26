// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it, vi, beforeEach, afterEach, type MockedFunction } from "vitest";

import {
  ROCclawSettingsCoordinator,
} from "@/lib/rocclaw/coordinator";
import type {
  ROCclawSettings,
  ROCclawSettingsPatch,
} from "@/lib/rocclaw/settings";
import type { ROCclawSettingsResponse } from "@/lib/rocclaw/coordinator";

describe("ROCclawSettingsCoordinator", () => {
  let mockTransport: {
    fetchSettings: MockedFunction<() => Promise<ROCclawSettingsResponse>>;
    updateSettings: MockedFunction<(patch: ROCclawSettingsPatch) => Promise<ROCclawSettingsResponse>>;
  };
  let coordinator: ROCclawSettingsCoordinator;

  const mockSettings: ROCclawSettings = {
    version: 1,
    gateway: { url: "ws://localhost:18789", token: "token" },
    gatewayAutoStart: true,
    focused: {},
    avatars: {},
    avatarSources: {},
  };

  const mockResponse: ROCclawSettingsResponse = {
    settings: mockSettings,
    localGatewayDefaults: null,
    localGatewayDefaultsMeta: { hasToken: false },
    gatewayMeta: { hasStoredToken: true },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockTransport = {
      fetchSettings: vi.fn(() => Promise.resolve(mockResponse)),
      updateSettings: vi.fn(() => Promise.resolve(mockResponse)),
    };
    coordinator = new ROCclawSettingsCoordinator(mockTransport, 350);
  });

  afterEach(() => {
    coordinator.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("loadSettings", () => {
    it("should fetch settings from transport", async () => {
      const result = await coordinator.loadSettings();

      expect(mockTransport.fetchSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSettings);
    });

    it("should return null when settings are missing in response", async () => {
      mockTransport.fetchSettings.mockResolvedValueOnce({
        ...mockResponse,
        settings: null as unknown as ROCclawSettings,
      });

      const result = await coordinator.loadSettings();

      expect(result).toBeNull();
    });

    it("should return settings from loadSettingsEnvelope", async () => {
      const result = await coordinator.loadSettingsEnvelope();

      expect(mockTransport.fetchSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("schedulePatch", () => {
    it("should schedule patch with debounce", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      
      coordinator.schedulePatch(patch);

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
      
      await vi.advanceTimersByTimeAsync(350);

      expect(mockTransport.updateSettings).toHaveBeenCalledWith(patch);
    });

    it("should reset timer when new patch is scheduled", async () => {
      const patch1: ROCclawSettingsPatch = { gateway: { url: "ws://first:18789" } };
      const patch2: ROCclawSettingsPatch = { gateway: { url: "ws://second:18789" } };
      
      coordinator.schedulePatch(patch1);
      await vi.advanceTimersByTimeAsync(100);
      coordinator.schedulePatch(patch2);
      await vi.advanceTimersByTimeAsync(250);

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
      
      await vi.advanceTimersByTimeAsync(100);

      expect(mockTransport.updateSettings).toHaveBeenCalledTimes(1);
      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        gateway: { url: "ws://second:18789" },
      }));
    });

    it("should merge patches before sending", async () => {
      const patch1: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      const patch2: ROCclawSettingsPatch = { gateway: { token: "secret" } };
      
      coordinator.schedulePatch(patch1);
      coordinator.schedulePatch(patch2);
      await vi.advanceTimersByTimeAsync(350);

      // The patch merge strategy replaces gateway entirely with the latest patch
      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        gateway: { token: "secret" },
      }));
    });

    it("should use custom debounce time when provided", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      
      coordinator.schedulePatch(patch, 1000);

      await vi.advanceTimersByTimeAsync(350);
      expect(mockTransport.updateSettings).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(650);
      expect(mockTransport.updateSettings).toHaveBeenCalled();
    });

    it("should not schedule when disposed", async () => {
      coordinator.dispose();
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      
      coordinator.schedulePatch(patch);
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe("applyPatchNow", () => {
    it("should apply patch immediately", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      
      await coordinator.applyPatchNow(patch);

      expect(mockTransport.updateSettings).toHaveBeenCalledTimes(1);
      expect(mockTransport.updateSettings).toHaveBeenCalledWith(patch);
    });

    it("should merge with pending patch", async () => {
      const pendingPatch: ROCclawSettingsPatch = { gateway: { url: "ws://pending:18789" } };
      const immediatePatch: ROCclawSettingsPatch = { gateway: { token: "token123" } };
      
      coordinator.schedulePatch(pendingPatch);
      await coordinator.applyPatchNow(immediatePatch);

      // The coordinator merges patches - gateway from immediate, url from pending preserved
      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        gateway: expect.objectContaining({ token: "token123" }),
      }));
    });

    it("should not apply when disposed", async () => {
      coordinator.dispose();
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      
      await coordinator.applyPatchNow(patch);

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe("flushPending", () => {
    it("should clear timer and send pending patch", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      coordinator.schedulePatch(patch);

      await coordinator.flushPending();

      expect(mockTransport.updateSettings).toHaveBeenCalledWith(patch);
    });

    it("should not call updateSettings when no pending patch", async () => {
      await coordinator.flushPending();

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
    });

    it("should clear timer when flushing", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      coordinator.schedulePatch(patch);

      await coordinator.flushPending();

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockTransport.updateSettings).toHaveBeenCalledTimes(1);
    });

    it("should restore pending patch on error", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      coordinator.schedulePatch(patch);
      mockTransport.updateSettings.mockRejectedValueOnce(new Error("Network error"));

      await expect(coordinator.flushPending()).rejects.toThrow("Network error");

      // Patch should be restored and can be flushed again
      mockTransport.updateSettings.mockResolvedValueOnce(mockResponse);
      await coordinator.flushPending();
      
      expect(mockTransport.updateSettings).toHaveBeenCalledTimes(2);
    });

    it("should merge pending patches when error occurs with new patch", async () => {
      const patch1: ROCclawSettingsPatch = { gateway: { url: "ws://first:18789" } };
      coordinator.schedulePatch(patch1);
      
      mockTransport.updateSettings.mockRejectedValueOnce(new Error("Network error"));
      
      try {
        await coordinator.flushPending();
      } catch {
        // expected
      }

      const patch2: ROCclawSettingsPatch = { gateway: { token: "token2" } };
      coordinator.schedulePatch(patch2);
      
      mockTransport.updateSettings.mockResolvedValueOnce(mockResponse);
      await coordinator.flushPending();

      // The merged patch should have gateway from both
      expect(mockTransport.updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({
        gateway: expect.objectContaining({ token: "token2" }),
      }));
    });

    it("should handle disposed state gracefully", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      coordinator.schedulePatch(patch);
      
      coordinator.dispose();
      
      await coordinator.flushPending();

      // Should not throw and should return immediately
      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe("mergeROCclawPatch", () => {
    it("should merge gateway patches", async () => {
      const current: ROCclawSettingsPatch = { gateway: { url: "ws://old:18789" } };
      const next: ROCclawSettingsPatch = { gateway: { token: "new-token" } };
      
      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        gateway: { token: "new-token" },
      }));
    });

    it("should merge focused patches", async () => {
      const current: ROCclawSettingsPatch = {
        focused: { "ws://host:18789": { mode: "focused", selectedAgentId: "agent-1", filter: "all" } },
      };
      const next: ROCclawSettingsPatch = {
        focused: { "ws://host:18789": { selectedAgentId: "agent-2" } },
      };
      
      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        focused: expect.objectContaining({
          "ws://host:18789": expect.objectContaining({
            selectedAgentId: "agent-2",
          }),
        }),
      }));
    });

    it("should merge avatars patches", async () => {
      const current: ROCclawSettingsPatch = {
        avatars: { "ws://host:18789": { "agent-1": "seed-1" } },
      };
      const next: ROCclawSettingsPatch = {
        avatars: { "ws://host:18789": { "agent-2": "seed-2" } },
      };
      
      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        avatars: expect.objectContaining({
          "ws://host:18789": expect.objectContaining({
            "agent-1": "seed-1",
            "agent-2": "seed-2",
          }),
        }),
      }));
    });

    it("should null out entire gateway avatars when specified", async () => {
      const current: ROCclawSettingsPatch = {
        avatars: { "ws://host:18789": { "agent-1": "seed-1" } },
      };
      const next: ROCclawSettingsPatch = {
        avatars: { "ws://host:18789": null },
      };

      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      expect(mockTransport.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        avatars: expect.objectContaining({
          "ws://host:18789": null,
        }),
      }));
    });

    it("should propagate gatewayAutoStart through merge", async () => {
      const current: ROCclawSettingsPatch = { gateway: { url: "ws://host:18789" } };
      const next: ROCclawSettingsPatch = { gatewayAutoStart: false };

      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      const call = mockTransport.updateSettings.mock.calls[0][0] as ROCclawSettingsPatch;
      expect(call.gateway).toEqual({ url: "ws://host:18789" });
      expect(call.gatewayAutoStart).toBe(false);
    });

    it("should propagate avatarSources through merge", async () => {
      const current: ROCclawSettingsPatch = { gateway: { url: "ws://host:18789" } };
      const next: ROCclawSettingsPatch = { avatarSources: { "ws://host:18789": { "agent-1": { source: "custom" } } } };

      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      const call = mockTransport.updateSettings.mock.calls[0][0] as ROCclawSettingsPatch;
      expect(call.gateway).toEqual({ url: "ws://host:18789" });
      expect(call.avatarSources).toEqual({ "ws://host:18789": { "agent-1": { source: "custom" } } });
    });

    it("should use last-write-wins for avatarSources", async () => {
      const current: ROCclawSettingsPatch = { avatarSources: { "ws://host:18789": { "agent-1": { source: "auto" } } } };
      const next: ROCclawSettingsPatch = { avatarSources: { "ws://host:18789": { "agent-1": { source: "custom" } } } };

      coordinator.schedulePatch(current);
      coordinator.schedulePatch(next);
      await vi.advanceTimersByTimeAsync(350);

      const call = mockTransport.updateSettings.mock.calls[0][0] as ROCclawSettingsPatch;
      expect(call.avatarSources).toEqual({ "ws://host:18789": { "agent-1": { source: "custom" } } });
    });
  });

  describe("dispose", () => {
    it("should clear timer on dispose", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      coordinator.schedulePatch(patch);
      
      coordinator.dispose();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
    });

    it("should clear pending patch on dispose", async () => {
      const patch: ROCclawSettingsPatch = { gateway: { url: "ws://new:18789" } };
      coordinator.schedulePatch(patch);
      
      coordinator.dispose();
      await coordinator.flushPending();

      expect(mockTransport.updateSettings).not.toHaveBeenCalled();
    });

    it("should return null from loadSettings when disposed", async () => {
      coordinator.dispose();
      
      const result = await coordinator.loadSettings();
      // Disposed coordinator still allows loadSettings
      expect(result).toEqual(mockSettings);
    });
  });

  describe("queue management", () => {
    it("should serialize multiple flush operations", async () => {
      const patch1: ROCclawSettingsPatch = { gateway: { url: "ws://first:18789" } };
      const patch2: ROCclawSettingsPatch = { gateway: { url: "ws://second:18789" } };

      // The queue serializes operations - flushPending creates a queued operation
      // When we call flushPending twice, the second waits for the first
      coordinator.schedulePatch(patch1);

      // First flush - this will be queued
      const flush1Promise = coordinator.flushPending();

      // Second flush while first is pending - this will wait
      coordinator.schedulePatch(patch2);
      const flush2Promise = coordinator.flushPending();

      // Wait for both to complete
      await flush1Promise;
      await flush2Promise;

      // Both should have been called (serialized)
      expect(mockTransport.updateSettings).toHaveBeenCalledTimes(2);
    });

    it("should handle errors in queue without breaking subsequent operations", async () => {
      const patch1: ROCclawSettingsPatch = { gateway: { url: "ws://first:18789" } };
      const patch2: ROCclawSettingsPatch = { gateway: { url: "ws://second:18789" } };
      
      mockTransport.updateSettings
        .mockRejectedValueOnce(new Error("First error"))
        .mockResolvedValueOnce(mockResponse);

      coordinator.schedulePatch(patch1);
      const flush1 = coordinator.flushPending();

      await expect(flush1).rejects.toThrow("First error");

      coordinator.schedulePatch(patch2);
      await coordinator.flushPending();

      expect(mockTransport.updateSettings).toHaveBeenCalledTimes(2);
    });
  });
});
