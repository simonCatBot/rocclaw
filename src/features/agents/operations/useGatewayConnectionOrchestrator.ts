// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useROCclawGatewaySettings } from "@/lib/rocclaw/useROCclawGatewaySettings";
import { isGatewayConnected, type GatewayStatus } from "@/lib/gateway/gateway-status";
import { createROCclawSettingsCoordinator } from "@/lib/rocclaw/coordinator";
import { createRuntimeWriteTransport } from "@/features/agents/operations/runtimeWriteTransport";

export const useGatewayConnectionOrchestrator = () => {
  const [settingsCoordinator] = useState(() => createROCclawSettingsCoordinator());
  const {
    client,
    status,
    gatewayUrl,
    draftGatewayUrl,
    token,
    localGatewayDefaults,
    localGatewayDefaultsHasToken,
    hasStoredToken,
    hasUnsavedChanges,
    installContext,
    statusReason,
    error: gatewayError,
    testResult,
    saving: gatewaySaving,
    testing: gatewayTesting,
    disconnecting: gatewayDisconnecting,
    saveSettings,
    testConnection,
    disconnect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
    applyRuntimeStatusEvent,
    clearError: clearGatewayError,
  } = useROCclawGatewaySettings(settingsCoordinator);

  const gatewayStatus: GatewayStatus = status;
  const gatewayConnected = isGatewayConnected(gatewayStatus);
  const gatewayConnectionStatus: "disconnected" | "connecting" | "connected" = gatewayConnected
    ? "connected"
    : gatewayStatus === "connecting" || gatewayStatus === "reconnecting"
      ? "connecting"
      : "disconnected";
  const coreConnected = gatewayConnected;
  const coreStatus = gatewayConnectionStatus;

  const runtimeStreamResumeKey = useMemo(() => {
    const normalizedGatewayUrl = gatewayUrl.trim();
    if (!normalizedGatewayUrl) return null;
    return `domain:${normalizedGatewayUrl}`;
  }, [gatewayUrl]);

  const runtimeWriteTransport = useMemo(
    () =>
      createRuntimeWriteTransport({
        client,
        useDomainIntents: true,
      }),
    [client]
  );

  // Flush pending settings patches on pagehide / tab hidden
  useEffect(() => {
    const flushPending = () => {
      void settingsCoordinator.flushPending();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      flushPending();
    };
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushPending();
    };
  }, [settingsCoordinator]);

  return {
    settingsCoordinator,
    client,
    gatewayUrl,
    draftGatewayUrl,
    token,
    localGatewayDefaults,
    localGatewayDefaultsHasToken,
    hasStoredToken,
    hasUnsavedChanges,
    installContext,
    statusReason,
    gatewayError,
    testResult,
    gatewaySaving,
    gatewayTesting,
    gatewayDisconnecting,
    saveSettings,
    testConnection,
    disconnect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
    applyRuntimeStatusEvent,
    clearGatewayError,
    gatewayStatus,
    gatewayConnected,
    gatewayConnectionStatus,
    coreConnected,
    coreStatus,
    runtimeStreamResumeKey,
    runtimeWriteTransport,
  };
};
