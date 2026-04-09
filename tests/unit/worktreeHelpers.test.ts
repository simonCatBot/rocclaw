// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import { buildAgentInstruction } from "@/lib/text/message-extract";

describe("buildAgentInstruction", () => {
  it("returns trimmed message text", () => {
    const message = buildAgentInstruction({
      message: "Ship it",
    });

    expect(message).toBe("Ship it");
  });
});
