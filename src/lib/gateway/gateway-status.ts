// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

export type GatewayStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export const isGatewayConnected = (status: GatewayStatus): boolean => status === "connected";

export type GatewayGapInfo = {
  expected: number;
  received: number;
};
