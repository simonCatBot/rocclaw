// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import { deriveDefaultIndex, buildDefaultAvatarUrl } from "@/features/agents/components/AgentAvatar";

describe("deriveDefaultIndex", () => {
  it("returns a number within [0, 23] for any seed", () => {
    for (let i = 0; i < 100; i++) {
      const index = deriveDefaultIndex(`agent-${i}`, 0);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(24);
    }
  });

  it("produces different indices for different seeds", () => {
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(deriveDefaultIndex(`agent-${i}`, 0));
    }
    // With 20 agents and 24 options, we expect most to be unique
    expect(results.size).toBeGreaterThan(1);
  });

  it("different explicitIndex values yield different results for the same seed", () => {
    const base = deriveDefaultIndex("same-seed", 0);
    const withIndex = deriveDefaultIndex("same-seed", 5);
    expect(withIndex).not.toBe(base);
  });

  it("same seed + same index always returns the same value (deterministic)", () => {
    const first = deriveDefaultIndex("deterministic-agent", 3);
    for (let i = 0; i < 10; i++) {
      expect(deriveDefaultIndex("deterministic-agent", 3)).toBe(first);
    }
  });

  it("handles empty seed string", () => {
    const index = deriveDefaultIndex("", 0);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(24);
  });

  it("handles negative explicitIndex as UNSET (uses seed hash only)", () => {
    // -1 is UNSET_INDEX sentinel
    const withNeg = deriveDefaultIndex("test-seed", -1);
    expect(typeof withNeg).toBe("number");
  });

  it("handles very large explicitIndex by wrapping into range", () => {
    const index = deriveDefaultIndex("agent-1", 9999);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(24);
  });
});

describe("buildDefaultAvatarUrl", () => {
  it("returns a /avatars/ path for any index", () => {
    const url = buildDefaultAvatarUrl(0);
    expect(url).toMatch(/^\/avatars\/(profile|cat-profile)-(\d+)\.png$/);
  });

  it("returns profile-1.png for index 0", () => {
    const url = buildDefaultAvatarUrl(0);
    expect(url).toBe("/avatars/profile-1.png");
  });

  it("returns profile-12.png for index 11", () => {
    const url = buildDefaultAvatarUrl(11);
    expect(url).toBe("/avatars/profile-12.png");
  });

  it("returns cat-profile-01.png for index 12 (first cat avatar)", () => {
    const url = buildDefaultAvatarUrl(12);
    expect(url).toBe("/avatars/cat-profile-01.png");
  });

  it("returns cat-profile-12.png for index 23 (last cat avatar)", () => {
    const url = buildDefaultAvatarUrl(23);
    expect(url).toBe("/avatars/cat-profile-12.png");
  });

  it("wraps index 24 back to profile-1.png", () => {
    const url = buildDefaultAvatarUrl(24);
    expect(url).toBe("/avatars/profile-1.png");
  });

  it("wraps negative index to valid range", () => {
    const url = buildDefaultAvatarUrl(-1);
    expect(url).toMatch(/^\/avatars\/(profile|cat-profile)-(\d+)\.png$/);
  });

  it("handles large indices by wrapping", () => {
    const url = buildDefaultAvatarUrl(999);
    expect(url).toMatch(/^\/avatars\/(profile|cat-profile)-(\d+)\.png$/);
  });
});
