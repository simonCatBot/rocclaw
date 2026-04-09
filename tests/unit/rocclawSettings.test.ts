// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  mergeROCclawSettings,
  normalizeROCclawSettings,
  resolveFocusedPreference,
} from "@/lib/rocclaw/settings";

describe("rocclaw settings normalization", () => {
  it("returns defaults for empty input", () => {
    const normalized = normalizeROCclawSettings(null);
    expect(normalized.version).toBe(1);
    expect(normalized.gateway).toBeNull();
    expect(normalized.focused).toEqual({});
    expect(normalized.avatars).toEqual({});
  });

  it("normalizes gateway entries", () => {
    const normalized = normalizeROCclawSettings({
      gateway: { url: " ws://localhost:18789 ", token: " token " },
    });

    expect(normalized.gateway?.url).toBe("ws://localhost:18789");
    expect(normalized.gateway?.token).toBe("token");
  });

  it("normalizes loopback ip gateway urls to localhost", () => {
    const normalized = normalizeROCclawSettings({
      gateway: { url: "ws://127.0.0.1:18789", token: "token" },
    });

    expect(normalized.gateway?.url).toBe("ws://localhost:18789");
  });

  it("normalizes focused preference keys to canonical loopback url", () => {
    const normalized = normalizeROCclawSettings({
      focused: {
        "ws://127.0.0.1:18789": {
          mode: "focused",
          selectedAgentId: "agent-2",
          filter: "all",
        },
      },
    });

    expect(normalized.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "agent-2",
      filter: "all",
    });
    expect(resolveFocusedPreference(normalized, "ws://127.0.0.1:18789")).toEqual({
      mode: "focused",
      selectedAgentId: "agent-2",
      filter: "all",
    });
    expect(resolveFocusedPreference(normalized, "ws://localhost:18789")).toEqual({
      mode: "focused",
      selectedAgentId: "agent-2",
      filter: "all",
    });
  });

  it("normalizes_dual_mode_preferences", () => {
    const normalized = normalizeROCclawSettings({
      focused: {
        " ws://localhost:18789 ": {
          mode: "focused",
          selectedAgentId: " agent-2 ",
          filter: "running",
        },
        bad: {
          mode: "nope",
          selectedAgentId: 12,
          filter: "bad-filter",
        },
      },
    });

    expect(normalized.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "agent-2",
      filter: "running",
    });
    expect(normalized.focused.bad).toEqual({
      mode: "focused",
      selectedAgentId: null,
      filter: "all",
    });
  });

  it("normalizes_legacy_idle_filter_to_approvals", () => {
    const normalized = normalizeROCclawSettings({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "agent-1",
          filter: "idle",
        },
      },
    });

    expect(normalized.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "agent-1",
      filter: "approvals",
    });
  });

  it("merges_dual_mode_preferences", () => {
    const current = normalizeROCclawSettings({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "main",
          filter: "all",
        },
      },
    });

    const merged = mergeROCclawSettings(current, {
      focused: {
        "ws://localhost:18789": {
          filter: "approvals",
        },
      },
    });

    expect(merged.focused["ws://localhost:18789"]).toEqual({
      mode: "focused",
      selectedAgentId: "main",
      filter: "approvals",
    });
  });

  it("merges focused patches across loopback aliases under one key", () => {
    const current = normalizeROCclawSettings({
      focused: {
        "ws://localhost:18789": {
          mode: "focused",
          selectedAgentId: "agent-1",
          filter: "all",
        },
      },
    });

    const merged = mergeROCclawSettings(current, {
      focused: {
        "ws://127.0.0.1:18789": {
          selectedAgentId: "agent-2",
        },
      },
    });

    expect(merged.focused).toEqual({
      "ws://localhost:18789": {
        mode: "focused",
        selectedAgentId: "agent-2",
        filter: "all",
      },
    });
  });

  it("preserves gateway token when patching only url", () => {
    const current = normalizeROCclawSettings({
      gateway: { url: "ws://gateway.old:18789", token: "secret-token" },
    });

    const merged = mergeROCclawSettings(current, {
      gateway: { url: "ws://gateway.new:18789" },
    });

    expect(merged.gateway).toEqual({
      url: "ws://gateway.new:18789",
      token: "secret-token",
    });
  });

  it("normalizes avatar seeds per gateway", () => {
    const normalized = normalizeROCclawSettings({
      avatars: {
        " ws://localhost:18789 ": {
          " agent-1 ": " seed-1 ",
          " agent-2 ": " ",
        },
        bad: "nope",
      },
    });

    expect(normalized.avatars["ws://localhost:18789"]).toEqual({
      "agent-1": "seed-1",
    });
  });

  it("merges avatar patches", () => {
    const current = normalizeROCclawSettings({
      avatars: {
        "ws://localhost:18789": {
          "agent-1": "seed-1",
        },
      },
    });

    const merged = mergeROCclawSettings(current, {
      avatars: {
        "ws://localhost:18789": {
          "agent-1": "seed-2",
          "agent-2": "seed-3",
        },
      },
    });

    expect(merged.avatars["ws://localhost:18789"]).toEqual({
      "agent-1": "seed-2",
      "agent-2": "seed-3",
    });
  });
});
