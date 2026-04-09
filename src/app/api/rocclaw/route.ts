// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { NextResponse } from "next/server";

import { type ROCclawSettingsPatch } from "@/lib/rocclaw/settings";
import { defaultROCclawInstallContext } from "@/lib/rocclaw/install-context";
import {
  getControlPlaneRuntime,
  isROCclawDomainApiModeEnabled,
  peekControlPlaneRuntime,
} from "@/lib/controlplane/runtime";
import {
  applyROCclawSettingsPatch,
  loadLocalGatewayDefaults,
  loadROCclawSettings,
  redactLocalGatewayDefaultsSecrets,
  redactROCclawSettingsSecrets,
} from "@/lib/rocclaw/settings-store";
import { detectInstallContext } from "../../../../server/rocclaw-install-context";

export const runtime = "nodejs";

const isPatch = (value: unknown): value is ROCclawSettingsPatch =>
  Boolean(value && typeof value === "object");

type RuntimeReconnectMetadata = {
  attempted: boolean;
  restarted: boolean;
  reason?: string;
  previousStatus?: string;
  error?: string;
};

const normalizeGatewaySettings = (settings: ReturnType<typeof loadROCclawSettings>) => {
  const gateway = settings.gateway ?? null;
  return {
    url: typeof gateway?.url === "string" ? gateway.url.trim() : "",
    token: typeof gateway?.token === "string" ? gateway.token.trim() : "",
  };
};

const gatewaySettingsChanged = (
  previous: ReturnType<typeof loadROCclawSettings>,
  next: ReturnType<typeof loadROCclawSettings>
) => {
  const left = normalizeGatewaySettings(previous);
  const right = normalizeGatewaySettings(next);
  return left.url !== right.url || left.token !== right.token;
};

const hasGatewayConfiguration = (settings: ReturnType<typeof loadROCclawSettings>) => {
  const gateway = normalizeGatewaySettings(settings);
  return Boolean(gateway.url && gateway.token);
};

const reconnectRuntimeForGatewaySettingsChange = async (
  previous: ReturnType<typeof loadROCclawSettings>,
  next: ReturnType<typeof loadROCclawSettings>
): Promise<RuntimeReconnectMetadata | null> => {
  if (!isROCclawDomainApiModeEnabled()) {
    return {
      attempted: false,
      restarted: false,
      reason: "domain_api_mode_disabled",
    };
  }
  const runtime = peekControlPlaneRuntime() ?? getControlPlaneRuntime();
  const previousStatus = runtime.connectionStatus();
  if (previousStatus === "stopped") {
    if (!hasGatewayConfiguration(next)) {
      return {
        attempted: false,
        restarted: false,
        reason: "gateway_not_configured",
        previousStatus,
      };
    }
    try {
      await runtime.ensureStarted({ force: true });
      return {
        attempted: true,
        restarted: true,
        previousStatus,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "controlplane_reconnect_failed";
      console.error("Failed to reconnect control-plane runtime after gateway settings update.", error);
      return {
        attempted: true,
        restarted: false,
        previousStatus,
        error: message,
      };
    }
  }
  if (!gatewaySettingsChanged(previous, next)) return null;
  if (!hasGatewayConfiguration(next)) {
    return {
      attempted: false,
      restarted: false,
      reason: "gateway_not_configured",
      previousStatus,
    };
  }
  try {
    await runtime.reconnectForGatewaySettingsChange();
    return {
      attempted: true,
      restarted: true,
      previousStatus,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "controlplane_reconnect_failed";
    console.error("Failed to reconnect control-plane runtime after gateway settings update.", error);
    return {
      attempted: true,
      restarted: false,
      previousStatus,
      error: message,
    };
  }
};

const buildSettingsResponseBody = async (metadata?: RuntimeReconnectMetadata | null) => {
  const settings = loadROCclawSettings();
  const localGatewayDefaults = loadLocalGatewayDefaults();
  let installContext = defaultROCclawInstallContext();
  try {
    installContext = await detectInstallContext(process.env);
  } catch (error) {
    console.error("Failed to detect ROCclaw install context.", error);
  }
  return {
    settings: redactROCclawSettingsSecrets(settings),
    localGatewayDefaults: redactLocalGatewayDefaultsSecrets(localGatewayDefaults),
    localGatewayDefaultsMeta: {
      hasToken: Boolean(localGatewayDefaults?.token?.trim()),
    },
    gatewayMeta: {
      hasStoredToken: Boolean(settings.gateway?.token?.trim()),
    },
    installContext,
    domainApiModeEnabled: isROCclawDomainApiModeEnabled(),
    ...(metadata ? { runtimeReconnect: metadata } : {}),
  };
};

export async function GET() {
  try {
    return NextResponse.json(await buildSettingsResponseBody());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load rocclaw settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isPatch(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const previousSettings = loadROCclawSettings();
    const nextSettings = applyROCclawSettingsPatch({
      ...body,
      gatewayAutoStart: true,
    });
    const runtimeReconnect = await reconnectRuntimeForGatewaySettingsChange(
      previousSettings,
      nextSettings
    );
    return NextResponse.json(await buildSettingsResponseBody(runtimeReconnect));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save rocclaw settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
