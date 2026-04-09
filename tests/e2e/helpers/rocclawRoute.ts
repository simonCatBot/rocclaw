// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { Page, Route, Request } from "@playwright/test";
import type { ROCclawInstallContext } from "@/lib/rocclaw/install-context";

type ROCclawSettingsFixture = {
  version: 1;
  gateway: { url: string; token: string } | null;
  focused: Record<string, { mode: "focused"; filter: string; selectedAgentId: string | null }>;
  avatars: Record<string, Record<string, string>>;
};

type ROCclawRouteEnvelopeFixture = {
  localGatewayDefaults?: { url: string; token: string } | null;
  localGatewayDefaultsMeta?: { hasToken: boolean };
  gatewayMeta?: { hasStoredToken: boolean };
  installContext?: ROCclawInstallContext;
  domainApiModeEnabled?: boolean;
};

const DEFAULT_SETTINGS: ROCclawSettingsFixture = {
  version: 1,
  gateway: null,
  focused: {},
  avatars: {},
};

// Normalize gateway URL keys to match app behavior
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const normalizeGatewayKey = (value: string): string => {
  if (!value) return value;
  try {
    const parsed = new URL(value);
    if (!LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      return value;
    }
    const auth = parsed.username || parsed.password
      ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
      : "";
    const host = parsed.port ? `localhost:${parsed.port}` : "localhost";
    const dropDefaultPath = parsed.pathname === "/" && !value.endsWith("/") && !parsed.search && !parsed.hash;
    const pathname = dropDefaultPath ? "" : parsed.pathname;
    return `${parsed.protocol}//${auth}${host}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
};

const createROCclawRoute = (
  initial: ROCclawSettingsFixture = DEFAULT_SETTINGS,
  envelope: ROCclawRouteEnvelopeFixture = {}
) => {
  let settings: ROCclawSettingsFixture = {
    version: 1,
    gateway: initial.gateway ?? null,
    focused: { ...(initial.focused ?? {}) },
    avatars: { ...(initial.avatars ?? {}) },
  };
  const responseEnvelope = () => ({
    settings,
    localGatewayDefaults: envelope.localGatewayDefaults ?? null,
    localGatewayDefaultsMeta: envelope.localGatewayDefaultsMeta ?? {
      hasToken: Boolean(envelope.localGatewayDefaults?.token),
    },
    gatewayMeta: envelope.gatewayMeta ?? {
      hasStoredToken: Boolean(settings.gateway?.token),
    },
    installContext: envelope.installContext,
    domainApiModeEnabled: envelope.domainApiModeEnabled ?? true,
  });

  return async (route: Route, request: Request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseEnvelope()),
      });
      return;
    }
    if (request.method() !== "PUT") {
      await route.fallback();
      return;
    }

    const patch = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
    const next = { ...settings };

    if ("gateway" in patch) {
      const gatewayPatch = (patch.gateway ?? null) as
        | { url?: string; token?: string }
        | null;
      if (gatewayPatch === null) {
        next.gateway = null;
      } else {
        const existing = next.gateway ?? { url: "", token: "" };
        next.gateway = {
          url: gatewayPatch.url ?? existing.url,
          token: gatewayPatch.token ?? existing.token,
        };
      }
    }

    if (patch.focused && typeof patch.focused === "object") {
      const focusedPatch = patch.focused as Record<string, Record<string, unknown>>;
      const focusedNext = { ...next.focused };
      for (const [key, value] of Object.entries(focusedPatch)) {
        const normalizedKey = normalizeGatewayKey(key);
        const existing = focusedNext[normalizedKey] ?? {
          mode: "focused" as const,
          filter: "all",
          selectedAgentId: null,
        };
        focusedNext[normalizedKey] = {
          mode: (value.mode as "focused") ?? existing.mode,
          filter: (value.filter as string) ?? existing.filter,
          selectedAgentId:
            "selectedAgentId" in value
              ? ((value.selectedAgentId as string | null) ?? null)
              : existing.selectedAgentId,
        };
      }
      next.focused = focusedNext;
    }

    if (patch.avatars && typeof patch.avatars === "object") {
      const avatarsPatch = patch.avatars as Record<string, Record<string, string | null> | null>;
      const avatarsNext: ROCclawSettingsFixture["avatars"] = { ...next.avatars };
      for (const [gatewayKey, gatewayPatch] of Object.entries(avatarsPatch)) {
        if (gatewayPatch === null) {
          delete avatarsNext[gatewayKey];
          continue;
        }
        const existing = avatarsNext[gatewayKey] ? { ...avatarsNext[gatewayKey] } : {};
        for (const [agentId, seedPatch] of Object.entries(gatewayPatch)) {
          if (seedPatch === null) {
            delete existing[agentId];
            continue;
          }
          const seed = typeof seedPatch === "string" ? seedPatch.trim() : "";
          if (!seed) {
            delete existing[agentId];
            continue;
          }
          existing[agentId] = seed;
        }
        avatarsNext[gatewayKey] = existing;
      }
      next.avatars = avatarsNext;
    }

    settings = next;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseEnvelope()),
    });
  };
};

export const stubRocclawRoute = async (
  page: Page,
  initial: ROCclawSettingsFixture = DEFAULT_SETTINGS,
  envelope?: ROCclawRouteEnvelopeFixture
) => {
  await page.route("**/api/rocclaw", createROCclawRoute(initial, envelope));
};
