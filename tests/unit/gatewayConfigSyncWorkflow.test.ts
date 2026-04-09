// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  resolveGatewayModelsSyncIntent,
  shouldRefreshGatewayConfigForSettingsRoute,
} from "@/features/agents/operations/gatewayConfigSyncWorkflow";

describe("gatewayConfigSyncWorkflow", () => {
  it("gates settings-route refresh on route flag, inspect agent id, and connected status", () => {
    expect(
      shouldRefreshGatewayConfigForSettingsRoute({
        status: "connected",
        settingsRouteActive: false,
        inspectSidebarAgentId: "agent-1",
      })
    ).toBe(false);

    expect(
      shouldRefreshGatewayConfigForSettingsRoute({
        status: "connected",
        settingsRouteActive: true,
        inspectSidebarAgentId: null,
      })
    ).toBe(false);

    expect(
      shouldRefreshGatewayConfigForSettingsRoute({
        status: "connecting",
        settingsRouteActive: true,
        inspectSidebarAgentId: "agent-1",
      })
    ).toBe(false);

    expect(
      shouldRefreshGatewayConfigForSettingsRoute({
        status: "connected",
        settingsRouteActive: true,
        inspectSidebarAgentId: "agent-1",
      })
    ).toBe(true);
  });

  it("returns model sync load intent only when connected", () => {
    expect(resolveGatewayModelsSyncIntent({ status: "connected" })).toEqual({ kind: "load" });
    expect(resolveGatewayModelsSyncIntent({ status: "connecting" })).toEqual({ kind: "clear" });
    expect(resolveGatewayModelsSyncIntent({ status: "disconnected" })).toEqual({ kind: "clear" });
  });
});
