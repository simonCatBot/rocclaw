// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import {
  defaultROCclawSettings,
  mergeROCclawSettings,
  normalizeROCclawSettings,
  type ROCclawSettings,
  type ROCclawSettingsPatch,
} from "@/lib/rocclaw/settings";

const SETTINGS_DIRNAME = "openclaw-rocclaw";
const SETTINGS_FILENAME = "settings.json";
const OPENCLAW_CONFIG_FILENAME = "openclaw.json";

const resolveROCclawSettingsPath = () =>
  path.join(resolveStateDir(), SETTINGS_DIRNAME, SETTINGS_FILENAME);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const readOpenclawGatewayDefaults = (): { url: string; token: string } | null => {
  try {
    const configPath = path.join(resolveStateDir(), OPENCLAW_CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const gateway = isRecord(parsed.gateway) ? parsed.gateway : null;
    if (!gateway) return null;
    const auth = isRecord(gateway.auth) ? gateway.auth : null;
    const token = typeof auth?.token === "string" ? auth.token.trim() : "";
    const port = typeof gateway.port === "number" && Number.isFinite(gateway.port) ? gateway.port : null;
    if (!token) return null;
    const url = port ? `ws://localhost:${port}` : "";
    if (!url) return null;
    return { url, token };
  } catch {
    return null;
  }
};

export const loadLocalGatewayDefaults = () => {
  return readOpenclawGatewayDefaults();
};

export const redactROCclawSettingsSecrets = (settings: ROCclawSettings): ROCclawSettings => {
  if (!settings.gateway) return settings;
  return {
    ...settings,
    gateway: {
      ...settings.gateway,
      token: "",
    },
  };
};

export const redactLocalGatewayDefaultsSecrets = (
  defaults: { url: string; token: string } | null
): { url: string; token: string } | null => {
  if (!defaults) return null;
  return {
    ...defaults,
    token: "",
  };
};

export const loadROCclawSettings = (): ROCclawSettings => {
  const settingsPath = resolveROCclawSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    const defaults = defaultROCclawSettings();
    const gateway = loadLocalGatewayDefaults();
    return gateway ? { ...defaults, gateway } : defaults;
  }
  let parsed: unknown;
  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt or truncated settings file — fall back to defaults
    console.warn("[rocclaw] Failed to parse settings file, using defaults:", settingsPath);
    const defaults = defaultROCclawSettings();
    const gateway = loadLocalGatewayDefaults();
    return gateway ? { ...defaults, gateway } : defaults;
  }
  const settings = normalizeROCclawSettings(parsed);
  if (!settings.gateway?.token) {
    const gateway = loadLocalGatewayDefaults();
    if (gateway) {
      return {
        ...settings,
        gateway: settings.gateway?.url?.trim()
          ? { url: settings.gateway.url.trim(), token: gateway.token }
          : gateway,
      };
    }
  }
  return settings;
};

const saveROCclawSettings = (next: ROCclawSettings) => {
  const settingsPath = resolveROCclawSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), "utf8");
};

export const applyROCclawSettingsPatch = (patch: ROCclawSettingsPatch): ROCclawSettings => {
  const current = loadROCclawSettings();
  const next = mergeROCclawSettings(current, patch);
  saveROCclawSettings(next);
  return next;
};
