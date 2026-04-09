// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

// @vitest-environment node

import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("rocclaw setup paths", () => {
  it("resolves settings path under OPENCLAW_STATE_DIR when set", async () => {
    const { resolveROCclawSettingsPath } = await import("../../server/rocclaw-settings");
    const settingsPath = resolveROCclawSettingsPath({
      OPENCLAW_STATE_DIR: "/tmp/openclaw-state",
    } as unknown as NodeJS.ProcessEnv);
    expect(settingsPath).toBe("/tmp/openclaw-state/openclaw-rocclaw/settings.json");
  });

  it("resolves settings path under ~/.openclaw by default", async () => {
    const { resolveROCclawSettingsPath } = await import("../../server/rocclaw-settings");
    const settingsPath = resolveROCclawSettingsPath({} as NodeJS.ProcessEnv);
    expect(settingsPath).toBe(
      path.join(os.homedir(), ".openclaw", "openclaw-rocclaw", "settings.json")
    );
  });
});
