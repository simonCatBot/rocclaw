import { describe, expect, it } from "vitest";
import {
  normalizeROCclawSettings,
  mergeROCclawSettings,
  resolveFocusedPreference,
  resolveAgentAvatarSeed,
  resolveAgentAvatarConfig,

  normalizeGatewayKey,
} from "@/lib/rocclaw/settings";

describe("normalizeGatewayKey", () => {
  it("normalizes https://127.0.0.1:18789 → localhost:18789", () => {
    expect(normalizeGatewayKey("https://127.0.0.1:18789/")).toMatch(/localhost/);
  });

  it("preserves non-loopback URLs", () => {
    expect(normalizeGatewayKey("https://gateway.example.com:9000")).toBe(
      "https://gateway.example.com:9000"
    );
  });

  it("returns null for empty string", () => {
    expect(normalizeGatewayKey("")).toBe(null);
  });

  it("trims whitespace", () => {
    expect(normalizeGatewayKey("  https://127.0.0.1:18789  ")).toMatch(/localhost/);
  });
});

describe("normalizeROCclawSettings", () => {
  it("returns defaults when input is null/undefined", () => {
    const result = normalizeROCclawSettings(null);
    expect(result.gateway).toBe(null);
    expect(result.gatewayAutoStart).toBe(true);
    expect(result.version).toBe(1);
    expect(result.focused).toEqual({});
    expect(result.avatars).toEqual({});
    expect(result.avatarSources).toEqual({});
  });

  it("accepts minimal valid input", () => {
    const result = normalizeROCclawSettings({});
    expect(result.version).toBe(1);
    expect(result.gatewayAutoStart).toBe(true);
  });

  it("normalizes loopback gateway URLs", () => {
    const result = normalizeROCclawSettings({
      gateway: { url: "https://user:pass@127.0.0.1:18789/", token: "secret" },
    });
    expect(result.gateway?.url).toMatch(/localhost/);
    expect(result.gateway?.token).toBe("secret");
  });

  it("drops gateway with missing URL", () => {
    const result = normalizeROCclawSettings({ gateway: { token: "tok" } });
    expect(result.gateway).toBe(null);
  });

  it("normalizes avatar entries with loopback keys", () => {
    const result = normalizeROCclawSettings({
      avatars: {
        "https://127.0.0.1:18789/": {
          "agent-1": "my-seed",
        },
      },
    });
    expect(Object.keys(result.avatars)[0]).toMatch(/localhost/);
  });

  it("ignores empty agent IDs in avatars", () => {
    const result = normalizeROCclawSettings({
      avatars: {
        "https://127.0.0.1:18789/": {
          "": "seed",
          "  ": "seed2",
        },
      },
    });
    const normalizedKey = Object.keys(result.avatars)[0];
    expect(Object.keys(result.avatars[normalizedKey])).toHaveLength(0);
  });
});

describe("mergeROCclawSettings", () => {
  it("merges gateway URL without touching token", () => {
    const current = normalizeROCclawSettings({
      gateway: { url: "https://127.0.0.1:18789", token: "old-token" },
    });
    const result = mergeROCclawSettings(current, {
      gateway: { url: "https://newhost:9999" },
    });
    expect(result.gateway?.url).toMatch(/newhost/);
    expect(result.gateway?.token).toBe("old-token");
  });

  it("clears gateway when patch sets it to null", () => {
    const current = normalizeROCclawSettings({
      gateway: { url: "https://127.0.0.1:18789", token: "tok" },
    });
    const result = mergeROCclawSettings(current, { gateway: null });
    expect(result.gateway).toBe(null);
  });

  it("merges focused preference for a gateway key", () => {
    const current = normalizeROCclawSettings({});
    const result = mergeROCclawSettings(current, {
      focused: {
        "https://127.0.0.1:18789": { filter: "running" },
      },
    });
    expect(result.focused[Object.keys(result.focused)[0]]?.filter).toBe("running");
  });

  it("deletes focused entry when set to null", () => {
    const current = normalizeROCclawSettings({
      focused: { "https://127.0.0.1:18789": { filter: "all" } },
    });
    const key = Object.keys(current.focused)[0];
    const result = mergeROCclawSettings(current, { focused: { [key]: null } });
    expect(result.focused[key]).toBeUndefined();
  });

  it("deep-merges avatars per agent within a gateway", () => {
    const current = normalizeROCclawSettings({
      avatars: {
        "https://127.0.0.1:18789": {
          "agent-1": "seed-1",
        },
      },
    });
    const key = Object.keys(current.avatars)[0];
    const result = mergeROCclawSettings(current, {
      avatars: {
        [key]: { "agent-2": "seed-2" },
      },
    });
    expect(result.avatars[key]?.["agent-1"]).toBe("seed-1");
    expect(result.avatars[key]?.["agent-2"]).toBe("seed-2");
  });

  it("deletes an agent avatar when seed is set to null", () => {
    const current = normalizeROCclawSettings({
      avatars: {
        "https://127.0.0.1:18789": {
          "agent-1": "seed-1",
        },
      },
    });
    const key = Object.keys(current.avatars)[0];
    const result = mergeROCclawSettings(current, {
      avatars: { [key]: { "agent-1": null } },
    });
    expect(result.avatars[key]?.["agent-1"]).toBeUndefined();
  });

  it("deep-merges avatarSources per agent", () => {
    const current = normalizeROCclawSettings({
      avatarSources: {
        "https://127.0.0.1:18789": {
          "agent-1": { source: "default", defaultIndex: 3 },
        },
      },
    });
    const key = Object.keys(current.avatarSources)[0];
    const result = mergeROCclawSettings(current, {
      avatarSources: {
        [key]: { "agent-1": { source: "custom", url: "https://example.com/img.png" } },
      },
    });
    expect(result.avatarSources[key]?.["agent-1"]?.source).toBe("custom");
    expect(result.avatarSources[key]?.["agent-1"]?.defaultIndex).toBe(3); // preserved
    expect(result.avatarSources[key]?.["agent-1"]?.url).toBe("https://example.com/img.png");
  });
});

describe("resolveFocusedPreference", () => {
  it("returns null when no focused settings exist", () => {
    const settings = normalizeROCclawSettings({});
    expect(resolveFocusedPreference(settings, "https://127.0.0.1:18789")).toBe(null);
  });

  it("returns the focused preference for a matching gateway URL", () => {
    const settings = normalizeROCclawSettings({
      focused: {
        "https://127.0.0.1:18789": { filter: "running" },
      },
    });
    const result = resolveFocusedPreference(settings, "https://127.0.0.1:18789");
    expect(result?.filter).toBe("running");
  });

  it("normalizes loopback URL when resolving", () => {
    const settings = normalizeROCclawSettings({
      focused: {
        "https://127.0.0.1:18789": { filter: "approvals" },
      },
    });
    const result = resolveFocusedPreference(settings, "https://127.0.0.1:18789");
    expect(result?.filter).toBe("approvals");
  });
});

describe("resolveAgentAvatarSeed", () => {
  it("returns null when no avatar settings exist", () => {
    const settings = normalizeROCclawSettings({});
    expect(resolveAgentAvatarSeed(settings, "https://127.0.0.1:18789", "agent-1")).toBe(null);
  });

  it("returns the seed for a matching agent", () => {
    const settings = normalizeROCclawSettings({
      avatars: {
        "https://127.0.0.1:18789": {
          "agent-1": "my-seed-value",
        },
      },
    });
    const result = resolveAgentAvatarSeed(settings, "https://127.0.0.1:18789", "agent-1");
    expect(result).toBe("my-seed-value");
  });

  it("returns null for unknown agent", () => {
    const settings = normalizeROCclawSettings({
      avatars: {
        "https://127.0.0.1:18789": {
          "agent-1": "seed",
        },
      },
    });
    const result = resolveAgentAvatarSeed(settings, "https://127.0.0.1:18789", "agent-unknown");
    expect(result).toBe(null);
  });
});

describe("resolveAgentAvatarConfig", () => {
  it("returns null when no config exists", () => {
    const settings = normalizeROCclawSettings({});
    expect(resolveAgentAvatarConfig(settings, "https://127.0.0.1:18789", "agent-1")).toBe(null);
  });

  it("returns the full config for a matching agent", () => {
    const settings = normalizeROCclawSettings({
      avatarSources: {
        "https://127.0.0.1:18789": {
          "agent-1": { source: "custom", defaultIndex: 5, url: "https://img.cload/avatar.png" },
        },
      },
    });
    const result = resolveAgentAvatarConfig(settings, "https://127.0.0.1:18789", "agent-1");
    expect(result?.source).toBe("custom");
    expect(result?.defaultIndex).toBe(5);
    expect(result?.url).toBe("https://img.cload/avatar.png");
  });

  it("returns partial config when some fields are missing", () => {
    const settings = normalizeROCclawSettings({
      avatarSources: {
        "https://127.0.0.1:18789": {
          "agent-1": { source: "default" },
        },
      },
    });
    const result = resolveAgentAvatarConfig(settings, "https://127.0.0.1:18789", "agent-1");
    expect(result?.source).toBe("default");
    expect(result?.defaultIndex).toBeUndefined();
    expect(result?.url).toBeUndefined();
  });
});
