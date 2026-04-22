// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";

/**
 * Tests for the cat profile avatars and extended avatar set.
 *
 * The avatar system was extended from 12 → 24 images:
 * - Indices 0-11: original profile images (profile-{1-12}.png)
 * - Indices 12-23: cat profile images (cat-profile-{01-12}.png)
 */

import {
  deriveDefaultIndex,
  buildDefaultAvatarUrl,
} from "@/features/agents/components/AgentAvatar";

describe("buildDefaultAvatarUrl: cat profile avatars", () => {
  it("returns original profile URLs for indices 0-11", () => {
    expect(buildDefaultAvatarUrl(0)).toBe("/avatars/profile-1.png");
    expect(buildDefaultAvatarUrl(5)).toBe("/avatars/profile-6.png");
    expect(buildDefaultAvatarUrl(11)).toBe("/avatars/profile-12.png");
  });

  it("returns cat profile URLs for indices 12-23", () => {
    expect(buildDefaultAvatarUrl(12)).toBe("/avatars/cat-profile-01.png");
    expect(buildDefaultAvatarUrl(13)).toBe("/avatars/cat-profile-02.png");
    expect(buildDefaultAvatarUrl(17)).toBe("/avatars/cat-profile-06.png");
    expect(buildDefaultAvatarUrl(23)).toBe("/avatars/cat-profile-12.png");
  });

  it("wraps index 24 back to profile-1.png", () => {
    expect(buildDefaultAvatarUrl(24)).toBe("/avatars/profile-1.png");
  });

  it("wraps index 25 to profile-2.png", () => {
    expect(buildDefaultAvatarUrl(25)).toBe("/avatars/profile-2.png");
  });

  it("wraps index 36 to cat-profile-01.png (24 + 12)", () => {
    expect(buildDefaultAvatarUrl(36)).toBe("/avatars/cat-profile-01.png");
  });

  it("handles negative index by wrapping", () => {
    const url = buildDefaultAvatarUrl(-1);
    // -1 mod 24 = 23, so it should be the last cat profile
    expect(url).toBe("/avatars/cat-profile-12.png");
  });

  it("handles large index by wrapping into cat range", () => {
    // 50 mod 24 = 2, so profile-3.png
    expect(buildDefaultAvatarUrl(50)).toBe("/avatars/profile-3.png");
  });

  it("always returns a valid path pattern for any integer", () => {
    for (let i = -50; i < 100; i++) {
      const url = buildDefaultAvatarUrl(i);
      expect(url).toMatch(/^\/avatars\/(profile|cat-profile)-\d+\.png$/);
    }
  });
});

describe("deriveDefaultIndex: 24-avatar range", () => {
  it("returns values within [0, 23] for any seed", () => {
    for (let i = 0; i < 200; i++) {
      const index = deriveDefaultIndex(`agent-${i}`, 0);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(24);
    }
  });

  it("distributes across both original and cat avatar ranges", () => {
    const indices = new Set<number>();
    for (let i = 0; i < 100; i++) {
      indices.add(deriveDefaultIndex(`agent-${i}`, 0));
    }
    // With 100 agents and 24 slots, we should hit both ranges
    const hasOriginal = [...indices].some((i) => i < 12);
    const hasCat = [...indices].some((i) => i >= 12);
    expect(hasOriginal).toBe(true);
    expect(hasCat).toBe(true);
  });

  it("wraps large explicitIndex into valid range", () => {
    const index = deriveDefaultIndex("test", 9999);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(24);
  });
});