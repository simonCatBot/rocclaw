// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";

describe("multiavatar helpers", () => {
  it("buildAvatarDataUrl returns a data url", () => {
    const url = buildAvatarDataUrl("Agent A");
    expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(url).toContain("%3Csvg");
  });
});
