// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const AVATAR_MODE_KEY = "rocclaw-footer-avatar-mode";

export type AvatarDisplayMode = "auto" | "default" | "custom";

interface AvatarModeContextValue {
  mode: AvatarDisplayMode;
  setMode: (mode: AvatarDisplayMode) => void;
}

const AvatarModeContext = createContext<AvatarModeContextValue | null>(null);

function getStoredMode(): AvatarDisplayMode {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(AVATAR_MODE_KEY);
  if (stored === "auto" || stored === "default" || stored === "custom") return stored;
  return "auto";
}

function applyMode(mode: AvatarDisplayMode) {
  localStorage.setItem(AVATAR_MODE_KEY, mode);
}

/** Provider — wrap once at app root level */
export function AvatarModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AvatarDisplayMode>(getStoredMode);

  const setMode = useCallback((newMode: AvatarDisplayMode) => {
    setModeState(newMode);
    applyMode(newMode);
  }, []);

  return (
    <AvatarModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AvatarModeContext.Provider>
  );
}

/** Read current mode — call from any component */
export function useAvatarMode(): AvatarDisplayMode {
  const ctx = useContext(AvatarModeContext);
  if (!ctx) {
    // Fallback if not wrapped — shouldn't happen in normal usage
    return getStoredMode();
  }
  return ctx.mode;
}

/** Set mode — call from any component */
export function useSetAvatarMode(): (mode: AvatarDisplayMode) => void {
  const ctx = useContext(AvatarModeContext);
  if (!ctx) {
    // Fallback — direct localStorage write
    return applyMode;
  }
  return ctx.setMode;
}
