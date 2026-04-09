// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

export type GatewayConnectionStatus = "disconnected" | "connecting" | "connected";

export const shouldRefreshGatewayConfigForSettingsRoute = (params: {
  status: GatewayConnectionStatus;
  settingsRouteActive: boolean;
  inspectSidebarAgentId: string | null;
}): boolean => {
  if (!params.settingsRouteActive) return false;
  if (!params.inspectSidebarAgentId) return false;
  if (params.status !== "connected") return false;
  return true;
};

type GatewayModelsSyncIntent = { kind: "clear" } | { kind: "load" };

export const resolveGatewayModelsSyncIntent = (params: {
  status: GatewayConnectionStatus;
}): GatewayModelsSyncIntent => {
  if (params.status !== "connected") {
    return { kind: "clear" };
  }
  return { kind: "load" };
};
