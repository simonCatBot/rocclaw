// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

export type ROCclawGatewaySettings = {
  url: string;
  token: string;
};

type ROCclawGatewaySettingsPatch = {
  url?: string | null;
  token?: string | null;
};

type FocusFilter = "all" | "running" | "approvals";
type ROCclawViewMode = "focused";

export type ROCclawFocusedPreference = {
  mode: ROCclawViewMode;
  selectedAgentId: string | null;
  filter: FocusFilter;
};

export type ROCclawSettings = {
  version: 1;
  gateway: ROCclawGatewaySettings | null;
  gatewayAutoStart: boolean;
  focused: Record<string, ROCclawFocusedPreference>;
  avatars: Record<string, Record<string, string>>;
  avatarSources: Record<string, Record<string, AvatarConfig>>;
};

export type ROCclawSettingsPatch = {
  gateway?: ROCclawGatewaySettingsPatch | null;
  gatewayAutoStart?: boolean | null;
  focused?: Record<string, Partial<ROCclawFocusedPreference> | null>;
  avatars?: Record<string, Record<string, string | null> | null>;
  avatarSources?: Record<string, Record<string, AvatarConfig | null> | null>;
};

export type AvatarConfig = {
  source?: string;
  defaultIndex?: number;
  url?: string | null;
};

const SETTINGS_VERSION = 1 as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const coerceString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "0.0.0.0"]);

const normalizeGatewayUrl = (value: unknown) => {
  const url = coerceString(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      return url;
    }
    const auth =
      parsed.username || parsed.password
        ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
        : "";
    const host = parsed.port ? `localhost:${parsed.port}` : "localhost";
    const dropDefaultPath =
      parsed.pathname === "/" && !url.endsWith("/") && !parsed.search && !parsed.hash;
    const pathname = dropDefaultPath ? "" : parsed.pathname;
    return `${parsed.protocol}//${auth}${host}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
};

export function normalizeGatewayKey(value: unknown): string | null {
  const key = normalizeGatewayUrl(value);
  return key ? key : null;
};

const normalizeFocusFilter = (
  value: unknown,
  fallback: FocusFilter = "all"
): FocusFilter => {
  const filter = coerceString(value);
  if (filter === "needs-attention") return "all";
  if (filter === "idle") return "approvals";
  if (
    filter === "all" ||
    filter === "running" ||
    filter === "approvals"
  ) {
    return filter;
  }
  return fallback;
};

const normalizeViewMode = (
  value: unknown,
  fallback: ROCclawViewMode = "focused"
): ROCclawViewMode => {
  const mode = coerceString(value);
  if (mode === "focused") {
    return mode;
  }
  return fallback;
};

const normalizeSelectedAgentId = (value: unknown, fallback: string | null = null) => {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const defaultFocusedPreference = (): ROCclawFocusedPreference => ({
  mode: "focused",
  selectedAgentId: null,
  filter: "all",
});

const normalizeFocusedPreference = (
  value: unknown,
  fallback: ROCclawFocusedPreference = defaultFocusedPreference()
): ROCclawFocusedPreference => {
  if (!isRecord(value)) return fallback;
  return {
    mode: normalizeViewMode(value.mode, fallback.mode),
    selectedAgentId: normalizeSelectedAgentId(
      value.selectedAgentId,
      fallback.selectedAgentId
    ),
    filter: normalizeFocusFilter(value.filter, fallback.filter),
  };
};

const normalizeGatewaySettings = (value: unknown): ROCclawGatewaySettings | null => {
  if (!isRecord(value)) return null;
  const url = normalizeGatewayUrl(value.url);
  if (!url) return null;
  const token = coerceString(value.token);
  return { url, token };
};

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const mergeGatewaySettings = (
  current: ROCclawGatewaySettings | null,
  patch: ROCclawGatewaySettingsPatch | null | undefined
): ROCclawGatewaySettings | null => {
  if (patch === undefined) return current;
  if (patch === null) return null;
  if (!isRecord(patch)) return current;

  const nextUrl = hasOwn(patch, "url") ? normalizeGatewayUrl(patch.url) : current?.url ?? "";
  const nextToken = hasOwn(patch, "token") ? coerceString(patch.token) : current?.token ?? "";
  if (!nextUrl) return null;
  return { url: nextUrl, token: nextToken };
};

const normalizeFocused = (value: unknown): Record<string, ROCclawFocusedPreference> => {
  if (!isRecord(value)) return {};
  const focused: Record<string, ROCclawFocusedPreference> = {};
  for (const [gatewayKeyRaw, focusedRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    focused[gatewayKey] = normalizeFocusedPreference(focusedRaw);
  }
  return focused;
};

const normalizeAvatars = (value: unknown): Record<string, Record<string, string>> => {
  if (!isRecord(value)) return {};
  const avatars: Record<string, Record<string, string>> = {};
  for (const [gatewayKeyRaw, gatewayRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    if (!isRecord(gatewayRaw)) continue;
    const entries: Record<string, string> = {};
    for (const [agentIdRaw, seedRaw] of Object.entries(gatewayRaw)) {
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      const seed = coerceString(seedRaw);
      if (!seed) continue;
      entries[agentId] = seed;
    }
    avatars[gatewayKey] = entries;
  }
  return avatars;
};

const normalizeAvatarSources = (value: unknown): Record<string, Record<string, AvatarConfig>> => {
  if (!isRecord(value)) return {};
  const sources: Record<string, Record<string, AvatarConfig>> = {};
  for (const [gatewayKeyRaw, gatewayRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    if (!isRecord(gatewayRaw)) continue;
    const entries: Record<string, AvatarConfig> = {};
    for (const [agentIdRaw, configRaw] of Object.entries(gatewayRaw)) {
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      if (!isRecord(configRaw)) continue;
      entries[agentId] = {
        source: coerceString(configRaw.source) || undefined,
        defaultIndex:
          typeof configRaw.defaultIndex === "number" && Number.isFinite(configRaw.defaultIndex)
            ? configRaw.defaultIndex
            : undefined,
        url: configRaw.url == null ? undefined : coerceString(configRaw.url) || undefined,
      };
    }
    sources[gatewayKey] = entries;
  }
  return sources;
};

export const defaultROCclawSettings = (): ROCclawSettings => ({
  version: SETTINGS_VERSION,
  gateway: null,
  gatewayAutoStart: true,
  focused: {},
  avatars: {},
  avatarSources: {},
});

export const normalizeROCclawSettings = (raw: unknown): ROCclawSettings => {
  if (!isRecord(raw)) return defaultROCclawSettings();
  const gateway = normalizeGatewaySettings(raw.gateway);
  const gatewayAutoStart = typeof raw.gatewayAutoStart === "boolean" ? raw.gatewayAutoStart : true;
  const focused = normalizeFocused(raw.focused);
  const avatars = normalizeAvatars(raw.avatars);
  const avatarSources = normalizeAvatarSources(raw.avatarSources);
  return {
    version: SETTINGS_VERSION,
    gateway,
    gatewayAutoStart,
    focused,
    avatars,
    avatarSources,
  };
};

export const mergeROCclawSettings = (
  current: ROCclawSettings,
  patch: ROCclawSettingsPatch
): ROCclawSettings => {
  const nextGateway = mergeGatewaySettings(current.gateway, patch.gateway);
  const nextGatewayAutoStart =
    typeof patch.gatewayAutoStart === "boolean" ? patch.gatewayAutoStart : current.gatewayAutoStart;
  const nextFocused = { ...current.focused };
  const nextAvatars = { ...current.avatars };
  const nextAvatarSources = { ...current.avatarSources };
  if (patch.focused) {
    for (const [keyRaw, value] of Object.entries(patch.focused)) {
      const key = normalizeGatewayKey(keyRaw);
      if (!key) continue;
      if (value === null) {
        delete nextFocused[key];
        continue;
      }
      const fallback = nextFocused[key] ?? defaultFocusedPreference();
      nextFocused[key] = normalizeFocusedPreference(value, fallback);
    }
  }
  if (patch.avatars) {
    for (const [gatewayKeyRaw, gatewayPatch] of Object.entries(patch.avatars)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (gatewayPatch === null) {
        delete nextAvatars[gatewayKey];
        continue;
      }
      if (!isRecord(gatewayPatch)) continue;
      const existing = nextAvatars[gatewayKey] ? { ...nextAvatars[gatewayKey] } : {};
      for (const [agentIdRaw, seedPatchRaw] of Object.entries(gatewayPatch)) {
        const agentId = coerceString(agentIdRaw);
        if (!agentId) continue;
        if (seedPatchRaw === null) {
          delete existing[agentId];
          continue;
        }
        const seed = coerceString(seedPatchRaw);
        if (!seed) {
          delete existing[agentId];
          continue;
        }
        existing[agentId] = seed;
      }
      nextAvatars[gatewayKey] = existing;
    }
  }
  if (patch.avatarSources) {
    for (const [gatewayKeyRaw, gatewayPatch] of Object.entries(patch.avatarSources)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (gatewayPatch === null) {
        delete nextAvatarSources[gatewayKey];
        continue;
      }
      if (!isRecord(gatewayPatch)) continue;
      const existing = nextAvatarSources[gatewayKey] ? { ...nextAvatarSources[gatewayKey] } : {};
      for (const [agentIdRaw, configPatch] of Object.entries(gatewayPatch)) {
        const agentId = coerceString(agentIdRaw);
        if (!agentId) continue;
        if (configPatch === null) {
          delete existing[agentId];
          continue;
        }
        if (!isRecord(configPatch)) continue;
        const prev = existing[agentId] ?? {};
        existing[agentId] = {
          source:
            "source" in configPatch && typeof configPatch.source === "string"
              ? configPatch.source
              : prev.source,
          defaultIndex:
            "defaultIndex" in configPatch && typeof configPatch.defaultIndex === "number"
              ? configPatch.defaultIndex
              : prev.defaultIndex,
          url:
            "url" in configPatch && (typeof configPatch.url === "string" || configPatch.url === null) ? configPatch.url : prev.url,
        };
      }
      nextAvatarSources[gatewayKey] = existing;
    }
  }
  return {
    version: SETTINGS_VERSION,
    gateway: nextGateway ?? null,
    gatewayAutoStart: nextGatewayAutoStart,
    focused: nextFocused,
    avatars: nextAvatars,
    avatarSources: nextAvatarSources,
  };
};

export const resolveFocusedPreference = (
  settings: ROCclawSettings,
  gatewayUrl: string
): ROCclawFocusedPreference | null => {
  const key = normalizeGatewayKey(gatewayUrl);
  if (!key) return null;
  return settings.focused[key] ?? null;
};

export const resolveAgentAvatarSeed = (
  settings: ROCclawSettings,
  gatewayUrl: string,
  agentId: string
): string | null => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return null;
  const agentKey = coerceString(agentId);
  if (!agentKey) return null;
  return settings.avatars[gatewayKey]?.[agentKey] ?? null;
};

export const resolveAgentAvatarConfig = (
  settings: ROCclawSettings,
  gatewayUrl: string,
  agentId: string
): AvatarConfig | null => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return null;
  const agentKey = coerceString(agentId);
  if (!agentKey) return null;
  return settings.avatarSources[gatewayKey]?.[agentKey] ?? null;
};
