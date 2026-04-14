// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  defaultROCclawSettings,
  mergeROCclawSettings,
  normalizeGatewayKey,
  normalizeROCclawSettings,
  resolveAgentAvatarConfig,
  resolveAgentAvatarSeed,
  resolveFocusedPreference,
  type AvatarConfig,
  type ROCclawSettings,
  type ROCclawSettingsPatch,
} from "@/lib/rocclaw/settings";

describe("settings", () => {
  describe("normalizeGatewayKey", () => {
    it("should return null for empty string", () => {
      expect(normalizeGatewayKey("")).toBeNull();
    });

    it("should return null for whitespace only", () => {
      expect(normalizeGatewayKey("   ")).toBeNull();
      expect(normalizeGatewayKey("\t\n")).toBeNull();
    });

    it("should return null for null/undefined", () => {
      expect(normalizeGatewayKey(null)).toBeNull();
      expect(normalizeGatewayKey(undefined)).toBeNull();
    });

    it("should normalize localhost URLs", () => {
      expect(normalizeGatewayKey("ws://localhost:18789")).toBe("ws://localhost:18789");
    });

    it("should convert 127.0.0.1 to localhost", () => {
      expect(normalizeGatewayKey("ws://127.0.0.1:18789")).toBe("ws://localhost:18789");
      expect(normalizeGatewayKey("http://127.0.0.1:8080/path")).toBe("http://localhost:8080/path");
    });

    it("should handle [::1] (IPv6 loopback brackets are not normalized)", () => {
      // Note: [::1] is not converted because the URL parser keeps brackets in hostname
      // The implementation only normalizes un-bracketed loopback addresses
      expect(normalizeGatewayKey("ws://[::1]:18789")).toBe("ws://[::1]:18789");
    });

    it("should convert 0.0.0.0 to localhost", () => {
      expect(normalizeGatewayKey("ws://0.0.0.0:18789")).toBe("ws://localhost:18789");
    });

    it("should preserve credentials in loopback URLs", () => {
      expect(normalizeGatewayKey("ws://user:pass@127.0.0.1:18789")).toBe("ws://user:pass@localhost:18789");
    });

    it("should preserve path, search, and hash", () => {
      expect(normalizeGatewayKey("ws://127.0.0.1:18789/path?query=1#hash")).toBe("ws://localhost:18789/path?query=1#hash");
    });

    it("should return non-loopback URLs unchanged", () => {
      expect(normalizeGatewayKey("wss://example.com:18789")).toBe("wss://example.com:18789");
      expect(normalizeGatewayKey("ws://192.168.1.1:18789")).toBe("ws://192.168.1.1:18789");
      expect(normalizeGatewayKey("ws://tailscale.ts.net")).toBe("ws://tailscale.ts.net");
    });

    it("should handle URLs without port", () => {
      expect(normalizeGatewayKey("ws://127.0.0.1")).toBe("ws://localhost");
    });

    it("should return string as-is if not a valid URL", () => {
      expect(normalizeGatewayKey("not-a-url")).toBe("not-a-url");
    });

    it("should trim input before processing", () => {
      expect(normalizeGatewayKey("  ws://127.0.0.1:18789  ")).toBe("ws://localhost:18789");
    });
  });

  describe("normalizeROCclawSettings", () => {
    it("should return default settings for null", () => {
      const result = normalizeROCclawSettings(null);
      expect(result).toEqual(defaultROCclawSettings());
    });

    it("should return default settings for undefined", () => {
      const result = normalizeROCclawSettings(undefined);
      expect(result).toEqual(defaultROCclawSettings());
    });

    it("should return default settings for non-object", () => {
      const result = normalizeROCclawSettings("string");
      expect(result).toEqual(defaultROCclawSettings());
    });

    it("should return default settings for array", () => {
      const result = normalizeROCclawSettings([1, 2, 3]);
      expect(result).toEqual(defaultROCclawSettings());
    });

    it("should normalize gateway settings", () => {
      const raw = {
        gateway: { url: "ws://127.0.0.1:18789", token: "token123" },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.gateway).toEqual({ url: "ws://localhost:18789", token: "token123" });
    });

    it("should return null gateway for invalid gateway settings", () => {
      const raw = { gateway: { url: "", token: "token" } };
      const result = normalizeROCclawSettings(raw);
      expect(result.gateway).toBeNull();
    });

    it("should return null gateway for non-object gateway", () => {
      const raw = { gateway: "not-an-object" };
      const result = normalizeROCclawSettings(raw);
      expect(result.gateway).toBeNull();
    });

    it("should normalize gatewayAutoStart to boolean", () => {
      expect(normalizeROCclawSettings({ gatewayAutoStart: false }).gatewayAutoStart).toBe(false);
      expect(normalizeROCclawSettings({ gatewayAutoStart: true }).gatewayAutoStart).toBe(true);
      expect(normalizeROCclawSettings({}).gatewayAutoStart).toBe(true);
      expect(normalizeROCclawSettings({ gatewayAutoStart: "true" }).gatewayAutoStart).toBe(true);
    });

    it("should normalize focused preferences", () => {
      const raw = {
        focused: {
          "ws://localhost:18789": {
            mode: "focused",
            selectedAgentId: "agent-1",
            filter: "running",
          },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.focused["ws://localhost:18789"]).toEqual({
        mode: "focused",
        selectedAgentId: "agent-1",
        filter: "running",
      });
    });

    it("should convert 127.0.0.1 to localhost in focused keys", () => {
      const raw = {
        focused: {
          "ws://127.0.0.1:18789": { mode: "focused", selectedAgentId: null, filter: "all" },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.focused["ws://localhost:18789"]).toBeDefined();
      expect(result.focused["ws://127.0.0.1:18789"]).toBeUndefined();
    });

    it("should skip invalid focused gateway keys", () => {
      const raw = {
        focused: {
          "": { mode: "focused", selectedAgentId: null, filter: "all" },
          "ws://localhost:18789": { mode: "focused", selectedAgentId: null, filter: "all" },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(Object.keys(result.focused)).toHaveLength(1);
      expect(result.focused["ws://localhost:18789"]).toBeDefined();
    });

    it("should normalize avatar seeds", () => {
      const raw = {
        avatars: {
          "ws://localhost:18789": {
            "agent-1": "seed-1",
            "agent-2": "seed-2",
          },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.avatars["ws://localhost:18789"]).toEqual({
        "agent-1": "seed-1",
        "agent-2": "seed-2",
      });
    });

    it("should skip invalid avatar entries", () => {
      const raw = {
        avatars: {
          "ws://localhost:18789": {
            "": "seed-1",
            "agent-2": "",
            "agent-3": "valid-seed",
          },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.avatars["ws://localhost:18789"]).toEqual({
        "agent-3": "valid-seed",
      });
    });

    it("should normalize avatar sources", () => {
      const raw = {
        avatarSources: {
          "ws://localhost:18789": {
            "agent-1": { source: "initials", defaultIndex: 1, url: null },
            "agent-2": { source: "url", url: "http://example.com/avatar.png" },
          },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.avatarSources["ws://localhost:18789"]["agent-1"]).toEqual({
        source: "initials",
        defaultIndex: 1,
        url: undefined,
      });
    });

    it("should handle legacy focus filter values", () => {
      const raw: Record<string, unknown> = {
        focused: {
          "ws://localhost:18789": {
            mode: "focused",
            selectedAgentId: null,
            filter: "needs-attention",
          },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.focused["ws://localhost:18789"].filter).toBe("all");
    });

    it("should handle legacy idle filter value", () => {
      const raw: Record<string, unknown> = {
        focused: {
          "ws://localhost:18789": {
            mode: "focused",
            selectedAgentId: null,
            filter: "idle",
          },
        },
      };
      const result = normalizeROCclawSettings(raw);
      expect(result.focused["ws://localhost:18789"].filter).toBe("approvals");
    });

    it("should set correct version", () => {
      const result = normalizeROCclawSettings({});
      expect(result.version).toBe(1);
    });
  });

  describe("mergeROCclawSettings", () => {
    const baseSettings: ROCclawSettings = {
      version: 1,
      gateway: { url: "ws://localhost:18789", token: "old-token" },
      gatewayAutoStart: true,
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "agent-1",
          filter: "all",
        },
      },
      avatars: {
        "ws://localhost:18789": {
          "agent-1": "seed-1",
        },
      },
      avatarSources: {},
    };

    it("should merge gateway settings", () => {
      const patch: ROCclawSettingsPatch = {
        gateway: { url: "ws://newhost:18789", token: "new-token" },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.gateway).toEqual({ url: "ws://newhost:18789", token: "new-token" });
    });

    it("should update only gateway url when token not provided in patch", () => {
      const patch: ROCclawSettingsPatch = {
        gateway: { url: "ws://newhost:18789" },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.gateway).toEqual({ url: "ws://newhost:18789", token: "old-token" });
    });

    it("should update only gateway token when url not provided in patch", () => {
      const patch: ROCclawSettingsPatch = {
        gateway: { token: "new-token" },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.gateway).toEqual({ url: "ws://localhost:18789", token: "new-token" });
    });

    it("should set gateway to null when patch.gateway is null", () => {
      const patch: ROCclawSettingsPatch = {
        gateway: null,
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.gateway).toBeNull();
    });

    it("should not change gateway when patch.gateway is undefined", () => {
      const patch: ROCclawSettingsPatch = {};
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.gateway).toEqual(baseSettings.gateway);
    });

    it("should merge gatewayAutoStart", () => {
      const result = mergeROCclawSettings(baseSettings, { gatewayAutoStart: false });
      expect(result.gatewayAutoStart).toBe(false);
    });

    it("should preserve gatewayAutoStart when not in patch", () => {
      const result = mergeROCclawSettings(baseSettings, {});
      expect(result.gatewayAutoStart).toBe(true);
    });

    it("should add focused preference for new gateway", () => {
      const patch: ROCclawSettingsPatch = {
        focused: {
          "ws://newhost:18789": { mode: "focused", selectedAgentId: "agent-2", filter: "running" },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.focused["ws://newhost:18789"]).toEqual({
        mode: "focused",
        selectedAgentId: "agent-2",
        filter: "running",
      });
    });

    it("should update existing focused preference", () => {
      const patch: ROCclawSettingsPatch = {
        focused: {
          "ws://localhost:18789": { filter: "approvals" },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.focused["ws://localhost:18789"]).toEqual({
        mode: "focused",
        selectedAgentId: "agent-1",
        filter: "approvals",
      });
    });

    it("should delete focused preference when value is null", () => {
      const patch: ROCclawSettingsPatch = {
        focused: {
          "ws://localhost:18789": null,
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.focused["ws://localhost:18789"]).toBeUndefined();
    });

    it("should convert 127.0.0.1 to localhost in focused merge", () => {
      const patch: ROCclawSettingsPatch = {
        focused: {
          "ws://127.0.0.1:18789": { selectedAgentId: "agent-3" },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.focused["ws://localhost:18789"].selectedAgentId).toBe("agent-3");
    });

    it("should merge avatars", () => {
      const patch: ROCclawSettingsPatch = {
        avatars: {
          "ws://localhost:18789": {
            "agent-2": "seed-2",
          },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.avatars["ws://localhost:18789"]).toEqual({
        "agent-1": "seed-1",
        "agent-2": "seed-2",
      });
    });

    it("should update existing avatar seed", () => {
      const patch: ROCclawSettingsPatch = {
        avatars: {
          "ws://localhost:18789": {
            "agent-1": "new-seed",
          },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.avatars["ws://localhost:18789"]["agent-1"]).toBe("new-seed");
    });

    it("should delete avatar when seed is null", () => {
      const patch: ROCclawSettingsPatch = {
        avatars: {
          "ws://localhost:18789": {
            "agent-1": null,
          },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.avatars["ws://localhost:18789"]["agent-1"]).toBeUndefined();
    });

    it("should delete all avatars for gateway when patch value is null", () => {
      const patch: ROCclawSettingsPatch = {
        avatars: {
          "ws://localhost:18789": null,
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.avatars["ws://localhost:18789"]).toBeUndefined();
    });

    it("should delete avatar when seed is empty string", () => {
      const patch: ROCclawSettingsPatch = {
        avatars: {
          "ws://localhost:18789": {
            "agent-1": "",
          },
        },
      };
      const result = mergeROCclawSettings(baseSettings, patch);
      expect(result.avatars["ws://localhost:18789"]["agent-1"]).toBeUndefined();
    });

    it("should merge avatar sources", () => {
      const settingsWithSources: ROCclawSettings = {
        ...baseSettings,
        avatarSources: {
          "ws://localhost:18789": {
            "agent-1": { source: "initials" },
          },
        },
      };
      const patch: ROCclawSettingsPatch = {
        avatarSources: {
          "ws://localhost:18789": {
            "agent-1": { url: "http://example.com/avatar.png" },
            "agent-2": { source: "url", url: "http://example.com/2.png" },
          },
        },
      };
      const result = mergeROCclawSettings(settingsWithSources, patch);
      expect(result.avatarSources["ws://localhost:18789"]["agent-1"]).toEqual({
        source: "initials",
        url: "http://example.com/avatar.png",
      });
      expect(result.avatarSources["ws://localhost:18789"]["agent-2"]).toEqual({
        source: "url",
        url: "http://example.com/2.png",
      });
    });

    it("should delete avatar source when config is null", () => {
      const settingsWithSources: ROCclawSettings = {
        ...baseSettings,
        avatarSources: {
          "ws://localhost:18789": {
            "agent-1": { source: "initials" },
          },
        },
      };
      const patch: ROCclawSettingsPatch = {
        avatarSources: {
          "ws://localhost:18789": {
            "agent-1": null,
          },
        },
      };
      const result = mergeROCclawSettings(settingsWithSources, patch);
      expect(result.avatarSources["ws://localhost:18789"]["agent-1"]).toBeUndefined();
    });

    it("should delete all avatar sources for gateway when patch value is null", () => {
      const settingsWithSources: ROCclawSettings = {
        ...baseSettings,
        avatarSources: {
          "ws://localhost:18789": {
            "agent-1": { source: "initials" },
          },
        },
      };
      const patch: ROCclawSettingsPatch = {
        avatarSources: {
          "ws://localhost:18789": null,
        },
      };
      const result = mergeROCclawSettings(settingsWithSources, patch);
      expect(result.avatarSources["ws://localhost:18789"]).toBeUndefined();
    });
  });

  describe("resolveFocusedPreference", () => {
    const settings: ROCclawSettings = {
      version: 1,
      gateway: null,
      gatewayAutoStart: true,
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "agent-1",
          filter: "running",
        },
      },
      avatars: {},
      avatarSources: {},
    };

    it("should return preference for matching gateway", () => {
      const result = resolveFocusedPreference(settings, "ws://localhost:18789");
      expect(result).toEqual({
        mode: "focused",
        selectedAgentId: "agent-1",
        filter: "running",
      });
    });

    it("should return null for non-existent gateway", () => {
      const result = resolveFocusedPreference(settings, "ws://other:18789");
      expect(result).toBeNull();
    });

    it("should normalize gateway key before lookup", () => {
      const result = resolveFocusedPreference(settings, "ws://127.0.0.1:18789");
      expect(result).toEqual({
        mode: "focused",
        selectedAgentId: "agent-1",
        filter: "running",
      });
    });

    it("should return null for empty gateway URL", () => {
      const result = resolveFocusedPreference(settings, "");
      expect(result).toBeNull();
    });
  });

  describe("resolveAgentAvatarSeed", () => {
    const settings: ROCclawSettings = {
      version: 1,
      gateway: null,
      gatewayAutoStart: true,
      focused: {},
      avatars: {
        "ws://localhost:18789": {
          "agent-1": "seed-1",
        },
      },
      avatarSources: {},
    };

    it("should return seed for matching agent", () => {
      const result = resolveAgentAvatarSeed(settings, "ws://localhost:18789", "agent-1");
      expect(result).toBe("seed-1");
    });

    it("should return null for non-existent agent", () => {
      const result = resolveAgentAvatarSeed(settings, "ws://localhost:18789", "agent-2");
      expect(result).toBeNull();
    });

    it("should return null for non-existent gateway", () => {
      const result = resolveAgentAvatarSeed(settings, "ws://other:18789", "agent-1");
      expect(result).toBeNull();
    });

    it("should normalize gateway key before lookup", () => {
      const result = resolveAgentAvatarSeed(settings, "ws://127.0.0.1:18789", "agent-1");
      expect(result).toBe("seed-1");
    });

    it("should return null for empty agent ID", () => {
      const result = resolveAgentAvatarSeed(settings, "ws://localhost:18789", "");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only agent ID", () => {
      const result = resolveAgentAvatarSeed(settings, "ws://localhost:18789", "   ");
      expect(result).toBeNull();
    });
  });

  describe("resolveAgentAvatarConfig", () => {
    const config: AvatarConfig = { source: "initials", defaultIndex: 2 };
    const settings: ROCclawSettings = {
      version: 1,
      gateway: null,
      gatewayAutoStart: true,
      focused: {},
      avatars: {},
      avatarSources: {
        "ws://localhost:18789": {
          "agent-1": config,
        },
      },
    };

    it("should return config for matching agent", () => {
      const result = resolveAgentAvatarConfig(settings, "ws://localhost:18789", "agent-1");
      expect(result).toEqual(config);
    });

    it("should return null for non-existent agent", () => {
      const result = resolveAgentAvatarConfig(settings, "ws://localhost:18789", "agent-2");
      expect(result).toBeNull();
    });

    it("should return null for non-existent gateway", () => {
      const result = resolveAgentAvatarConfig(settings, "ws://other:18789", "agent-1");
      expect(result).toBeNull();
    });

    it("should normalize gateway key before lookup", () => {
      const result = resolveAgentAvatarConfig(settings, "ws://127.0.0.1:18789", "agent-1");
      expect(result).toEqual(config);
    });

    it("should return null for empty agent ID", () => {
      const result = resolveAgentAvatarConfig(settings, "ws://localhost:18789", "");
      expect(result).toBeNull();
    });
  });

  describe("defaultROCclawSettings", () => {
    it("should return settings with correct structure", () => {
      const result = defaultROCclawSettings();
      expect(result.version).toBe(1);
      expect(result.gateway).toBeNull();
      expect(result.gatewayAutoStart).toBe(true);
      expect(result.focused).toEqual({});
      expect(result.avatars).toEqual({});
      expect(result.avatarSources).toEqual({});
    });

    it("should return new object on each call", () => {
      const result1 = defaultROCclawSettings();
      const result2 = defaultROCclawSettings();
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });
});
