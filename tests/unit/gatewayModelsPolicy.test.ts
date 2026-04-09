// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  buildGatewayModelChoices,
  resolveConfiguredModelKey,
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";

describe("gateway model policy helpers", () => {
  it("resolves configured aliases and shorthand ids", () => {
    const modelAliases = {
      "anthropic/claude-sonnet-4-5": { alias: "sonnet" },
      "openai/gpt-4o": { alias: "omni" },
    };

    expect(resolveConfiguredModelKey("sonnet", modelAliases)).toBe(
      "anthropic/claude-sonnet-4-5"
    );
    expect(resolveConfiguredModelKey("omni", modelAliases)).toBe("openai/gpt-4o");
    expect(resolveConfiguredModelKey("claude-opus-4", modelAliases)).toBe(
      "anthropic/claude-opus-4"
    );
    expect(resolveConfiguredModelKey("openai/o3", modelAliases)).toBe("openai/o3");
    expect(resolveConfiguredModelKey("   ", modelAliases)).toBeNull();
  });

  it("filters model catalog and appends configured extras", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: {
        agents: {
          defaults: {
            model: "sonnet",
            models: {
              "anthropic/claude-sonnet-4-5": { alias: "sonnet" },
              "openai/o3": {},
            },
          },
        },
      },
    };
    const catalog = [
      {
        provider: "anthropic",
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
      },
      {
        provider: "openai",
        id: "gpt-4o",
        name: "GPT-4o",
      },
    ];

    expect(buildGatewayModelChoices(catalog, snapshot)).toEqual([
      {
        provider: "anthropic",
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
      },
      {
        provider: "openai",
        id: "o3",
        name: "openai/o3",
      },
    ]);
  });

  it("returns the catalog unchanged when no config allowlist is present", () => {
    const catalog = [
      {
        provider: "anthropic",
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
      },
    ];

    expect(buildGatewayModelChoices(catalog, null)).toEqual(catalog);
  });
});
