// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Server,
  Cpu,
  Globe,
  Shield,
  Zap,
  FolderOpen,
  Loader2
} from "lucide-react";

const THEME_KEY = "theme";
const COMPACT_KEY = "rocclaw-compact-mode";
type ThemeChoice = "light" | "dark" | "system";

function resolveSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeChoice(choice: ThemeChoice) {
  const effective = choice === "system" ? resolveSystemTheme() : choice;
  document.documentElement.classList.toggle("dark", effective === "dark");
  if (choice === "system") {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, choice);
  }
  // Notify other components (e.g. ColorSchemeToggle) about the change
  window.dispatchEvent(new Event("rocclaw-theme-change"));
}

function getStoredThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function applyCompactMode(enabled: boolean) {
  document.documentElement.classList.toggle("compact", enabled);
  localStorage.setItem(COMPACT_KEY, enabled ? "1" : "0");
}

function getStoredCompactMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COMPACT_KEY) === "1";
}

interface SettingsState {
  // Gateway settings
  gateway: {
    url: string;
    autoStart: boolean;
  };
  // Model settings
  models: {
    defaultModel: string;
    temperature: number;
    maxTokens: number;
  };
  // Agent settings
  agents: {
    defaultWorkspace: string;
    timezone: string;
  };
  // UI settings
  ui: {
    theme: ThemeChoice;
    compactMode: boolean;
  };
}

const DEFAULT_SETTINGS: SettingsState = {
  gateway: {
    url: "",
    autoStart: true,
  },
  models: {
    defaultModel: "",
    temperature: 0.7,
    maxTokens: 8192,
  },
  agents: {
    defaultWorkspace: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  },
  ui: {
    theme: "system",
    compactMode: false,
  },
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load settings from gateway config and localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // Fetch gateway config
        const configResponse = await fetch("/api/runtime/config", {
          signal: AbortSignal.timeout(5000),
        });

        if (configResponse.ok) {
          // Config data available but not yet integrated
          // const configData = await configResponse.json();
        }

        // Load UI preferences from the actual theme system
        setSettings(prev => ({
          ...prev,
          ui: {
            theme: getStoredThemeChoice(),
            compactMode: getStoredCompactMode(),
          },
        }));
      } catch (err) {
        console.error("[Settings] Failed to load:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Listen for system theme changes when "system" is selected
  useEffect(() => {
    if (settings.ui.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeChoice("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.ui.theme]);

  const handleThemeChange = useCallback((theme: ThemeChoice) => {
    setSettings(prev => ({ ...prev, ui: { ...prev.ui, theme } }));
    applyThemeChoice(theme);
  }, []);

  const handleCompactToggle = useCallback(() => {
    setSettings(prev => {
      const next = !prev.ui.compactMode;
      applyCompactMode(next);
      return { ...prev, ui: { ...prev.ui, compactMode: next } };
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border/50 bg-surface-1/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Gateway Settings — view only, managed via Connection tab */}
        <section className="ui-card space-y-4 p-5 opacity-75">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Gateway Connection</h3>
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Managed via Connection tab
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Gateway URL
              </label>
              <input
                type="text"
                value={settings.gateway.url}
                readOnly
                placeholder="ws://localhost:18789"
                className="h-10 w-full rounded-md border border-border bg-surface-2/50 px-3 text-sm text-muted-foreground outline-none cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-start gateway</p>
                  <p className="text-xs text-muted-foreground">Launch gateway when app starts</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={settings.gateway.autoStart}
                disabled
                className={`ui-switch cursor-not-allowed opacity-60 ${settings.gateway.autoStart ? "ui-switch--on" : ""}`}
              >
                <span className="ui-switch-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* Model Settings — view only, managed per-agent via chat composer */}
        <section className="ui-card space-y-4 p-5 opacity-75">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Default Model</h3>
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Configured per agent
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Primary Model
              </label>
              <select
                value={settings.models.defaultModel}
                disabled
                className="h-10 w-full rounded-md border border-border bg-surface-2/50 px-3 text-sm text-muted-foreground outline-none cursor-not-allowed"
              >
                <option value="">Select model...</option>
                <option value="ollama/minimax-m2.7:cloud">minimax-m2.7:cloud</option>
                <option value="ollama/kimi-k2.5:cloud">kimi-k2.5:cloud</option>
                <option value="ollama/llama3.1:latest">llama3.1:latest</option>
                <option value="ollama/qwen2.5:7b">qwen2.5:7b</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Temperature</span>
                <span className="font-mono text-[10px]">{settings.models.temperature.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.models.temperature}
                disabled
                className="h-2 w-full rounded-full bg-surface-2 cursor-not-allowed opacity-60"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Max Tokens
              </label>
              <input
                type="number"
                min="256"
                max="128000"
                step="256"
                value={settings.models.maxTokens}
                readOnly
                className="h-10 w-full rounded-md border border-border bg-surface-2/50 px-3 text-sm text-muted-foreground outline-none cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        {/* Agent Settings — view only */}
        <section className="ui-card space-y-4 p-5 opacity-75">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Agents</h3>
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Configured per agent
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Default Workspace
              </label>
              <input
                type="text"
                value={settings.agents.defaultWorkspace}
                readOnly
                placeholder="/path/to/workspace"
                className="h-10 w-full rounded-md border border-border bg-surface-2/50 px-3 text-sm text-muted-foreground outline-none cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Timezone
              </label>
              <select
                value={settings.agents.timezone}
                disabled
                className="h-10 w-full rounded-md border border-border bg-surface-2/50 px-3 text-sm text-muted-foreground outline-none cursor-not-allowed"
              >
                {Intl.supportedValuesOf("timeZone").map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* UI Settings */}
        <section className="ui-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Appearance</h3>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    aria-pressed={settings.ui.theme === theme}
                    className={`ui-card px-3 py-2 text-center text-xs font-medium capitalize transition ${
                      settings.ui.theme === theme
                        ? "ui-selected"
                        : "bg-surface-2/60 hover:bg-surface-3/90"
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Compact mode</p>
                <p className="text-xs text-muted-foreground">Reduce spacing and font sizes</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.ui.compactMode}
                onClick={handleCompactToggle}
                className={`ui-switch ${settings.ui.compactMode ? "ui-switch--on" : ""}`}
              >
                <span className="ui-switch-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="ui-card space-y-4 border-red-500/20 p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-foreground">Advanced</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-red-500/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Reset all settings</p>
                <p className="text-xs text-muted-foreground">Restore defaults for all settings</p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to reset all settings?")) {
                    setSettings(DEFAULT_SETTINGS);
                    applyThemeChoice("system");
                    applyCompactMode(false);
                  }
                }}
                className="ui-btn-danger rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em]"
              >
                Reset
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
