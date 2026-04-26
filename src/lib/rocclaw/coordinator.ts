// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { fetchJson } from "@/lib/http";
import type {
  ROCclawFocusedPreference,
  ROCclawGatewaySettings,
  ROCclawSettings,
  ROCclawSettingsPatch,
} from "@/lib/rocclaw/settings";
import type { ROCclawInstallContext } from "@/lib/rocclaw/install-context";

export type ROCclawSettingsResponse = {
  settings: ROCclawSettings;
  localGatewayDefaults?: ROCclawGatewaySettings | null;
  localGatewayDefaultsMeta?: {
    hasToken: boolean;
  };
  gatewayMeta?: {
    hasStoredToken: boolean;
  };
  installContext?: ROCclawInstallContext;
  domainApiModeEnabled?: boolean;
  runtimeReconnect?: {
    attempted: boolean;
    restarted: boolean;
    reason?: string;
    previousStatus?: string;
    error?: string;
  } | null;
};

type FocusedPatch = Record<string, Partial<ROCclawFocusedPreference> | null>;
type AvatarsPatch = Record<string, Record<string, string | null> | null>;

type ROCclawSettingsCoordinatorTransport = {
  fetchSettings: () => Promise<ROCclawSettingsResponse>;
  updateSettings: (patch: ROCclawSettingsPatch) => Promise<ROCclawSettingsResponse>;
};

const mergeFocusedPatch = (
  current: FocusedPatch | undefined,
  next: FocusedPatch | undefined
): FocusedPatch | undefined => {
  if (!current && !next) return undefined;
  return {
    ...(current ?? {}),
    ...(next ?? {}),
  };
};

const mergeAvatarsPatch = (
  current: AvatarsPatch | undefined,
  next: AvatarsPatch | undefined
): AvatarsPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: AvatarsPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = { ...existing, ...value };
      continue;
    }
    merged[gatewayKey] = { ...value };
  }
  return merged;
};

const mergeROCclawPatch = (
  current: ROCclawSettingsPatch | null,
  next: ROCclawSettingsPatch
): ROCclawSettingsPatch => {
  if (!current) {
    return {
      ...(next.gateway !== undefined ? { gateway: next.gateway } : {}),
      ...(next.gatewayAutoStart !== undefined ? { gatewayAutoStart: next.gatewayAutoStart } : {}),
      ...(next.focused ? { focused: { ...next.focused } } : {}),
      ...(next.avatars ? { avatars: { ...next.avatars } } : {}),
      ...(next.avatarSources ? { avatarSources: { ...next.avatarSources } } : {}),
    };
  }
  const focused = mergeFocusedPatch(current.focused, next.focused);
  const avatars = mergeAvatarsPatch(current.avatars, next.avatars);
  // For avatarSources, last-write-wins (same as gateway)
  const avatarSources = next.avatarSources !== undefined
    ? next.avatarSources
    : current.avatarSources !== undefined
      ? current.avatarSources
      : undefined;
  return {
    ...(next.gateway !== undefined
      ? { gateway: next.gateway }
      : current.gateway !== undefined
        ? { gateway: current.gateway }
        : {}),
    ...(next.gatewayAutoStart !== undefined
      ? { gatewayAutoStart: next.gatewayAutoStart }
      : current.gatewayAutoStart !== undefined
        ? { gatewayAutoStart: current.gatewayAutoStart }
        : {}),
    ...(focused ? { focused } : {}),
    ...(avatars ? { avatars } : {}),
    ...(avatarSources ? { avatarSources } : {}),
  };
};

export class ROCclawSettingsCoordinator {
  private pendingPatch: ROCclawSettingsPatch | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly transport: ROCclawSettingsCoordinatorTransport,
    private readonly defaultDebounceMs: number = 350
  ) {}

  async loadSettings(): Promise<ROCclawSettings | null> {
    const result = await this.loadSettingsEnvelope();
    return result.settings ?? null;
  }

  async loadSettingsEnvelope(): Promise<ROCclawSettingsResponse> {
    return await this.transport.fetchSettings();
  }

  schedulePatch(patch: ROCclawSettingsPatch, debounceMs: number = this.defaultDebounceMs): void {
    if (this.disposed) return;
    this.pendingPatch = mergeROCclawPatch(this.pendingPatch, patch);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flushPending().catch((err) => {
        console.error("Failed to flush pending rocclaw settings patch.", err);
      });
    }, debounceMs);
  }

  async applyPatchNow(patch: ROCclawSettingsPatch): Promise<void> {
    if (this.disposed) return;
    this.pendingPatch = mergeROCclawPatch(this.pendingPatch, patch);
    await this.flushPending();
  }

  async flushPending(): Promise<void> {
    if (this.disposed) {
      return this.queue;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const patch = this.pendingPatch;
    if (!patch) {
      return this.queue;
    }
    const write = this.queue.then(async () => {
      if (this.pendingPatch === patch) {
        this.pendingPatch = null;
      }
      try {
        await this.transport.updateSettings(patch);
      } catch (err) {
        this.pendingPatch = mergeROCclawPatch(this.pendingPatch, patch);
        throw err;
      }
    });
    this.queue = write.catch((err) => {
      console.error("Failed to persist rocclaw settings patch.", err);
    });
    return write;
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingPatch = null;
    this.disposed = true;
  }
}

const fetchROCclawSettings = async (): Promise<ROCclawSettingsResponse> => {
  return fetchJson<ROCclawSettingsResponse>("/api/rocclaw", { cache: "no-store" });
};

const updateROCclawSettings = async (
  patch: ROCclawSettingsPatch
): Promise<ROCclawSettingsResponse> => {
  return fetchJson<ROCclawSettingsResponse>("/api/rocclaw", {
    method: "PUT",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
};

export const createROCclawSettingsCoordinator = (options?: {
  debounceMs?: number;
}): ROCclawSettingsCoordinator => {
  return new ROCclawSettingsCoordinator(
    {
      fetchSettings: fetchROCclawSettings,
      updateSettings: updateROCclawSettings,
    },
    options?.debounceMs
  );
};
