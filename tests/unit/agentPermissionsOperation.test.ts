// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  resolveAgentPermissionsDraft,
  resolvePresetDefaultsForRole,
  resolveRoleForCommandMode,
  resolveToolGroupOverrides,
} from "@/features/agents/operations/agentPermissionsOperation";

describe("agentPermissionsOperation", () => {
  it("maps command mode to preset role", () => {
    expect(resolveRoleForCommandMode("off")).toBe("conservative");
    expect(resolveRoleForCommandMode("ask")).toBe("collaborative");
    expect(resolveRoleForCommandMode("auto")).toBe("autonomous");
  });

  it("resolves autonomous preset defaults to permissive capabilities", () => {
    expect(resolvePresetDefaultsForRole("autonomous")).toEqual({
      commandMode: "auto",
      webAccess: true,
      fileTools: true,
    });
  });

  it("merges group toggles while preserving allow mode", () => {
    const overrides = resolveToolGroupOverrides({
      existingTools: {
        allow: ["group:web", "custom:tool"],
        deny: ["group:runtime", "group:fs"],
      },
      runtimeEnabled: true,
      webEnabled: false,
      fsEnabled: true,
    });

    expect(overrides.tools.allow).toEqual(
      expect.arrayContaining(["custom:tool", "group:runtime", "group:fs"])
    );
    expect(overrides.tools.allow).not.toEqual(expect.arrayContaining(["group:web"]));
    expect(overrides.tools.deny).toEqual(expect.arrayContaining(["group:web"]));
    expect(overrides.tools.deny).not.toEqual(
      expect.arrayContaining(["group:runtime", "group:fs"])
    );
  });

  it("merges group toggles while preserving alsoAllow mode", () => {
    const overrides = resolveToolGroupOverrides({
      existingTools: {
        alsoAllow: ["group:web"],
        deny: [],
      },
      runtimeEnabled: true,
      webEnabled: true,
      fsEnabled: false,
    });

    expect(overrides.tools).not.toHaveProperty("allow");
    expect(overrides.tools.alsoAllow).toEqual(
      expect.arrayContaining(["group:web", "group:runtime"])
    );
    expect(overrides.tools.deny).toEqual(expect.arrayContaining(["group:fs"]));
  });

  it("resolves draft from session role and config group overrides", () => {
    const draft = resolveAgentPermissionsDraft({
      agent: {
        sessionExecSecurity: "allowlist",
        sessionExecAsk: "always",
      },
      existingTools: {
        allow: ["group:web"],
        deny: ["group:fs"],
      },
    });

    expect(draft).toEqual({
      commandMode: "ask",
      webAccess: true,
      fileTools: false,
    });
  });

});
