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
  Save,
  Loader2
} from "lucide-react";

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
    theme: "light" | "dark" | "system";
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings from gateway config
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch gateway config
        const configResponse = await fetch("/api/runtime/config", {
          signal: AbortSignal.timeout(5000),
        });
        
        if (configResponse.ok) {
          // Config data available but not yet integrated
          // const configData = await configResponse.json();
        }
        
        // Load from localStorage for UI preferences
        const savedUi = localStorage.getItem("rocclaw-ui-settings");
        if (savedUi) {
          try {
            const parsed = JSON.parse(savedUi);
            setSettings(prev => ({
              ...prev,
              ui: { ...prev.ui, ...parsed },
            }));
          } catch {
            // Ignore parse errors
          }
        }
      } catch (err) {
        console.error("[Settings] Failed to load:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setSaved(false);
      setError(null);
      
      // Save UI preferences to localStorage
      localStorage.setItem("rocclaw-ui-settings", JSON.stringify(settings.ui));
      
      // Gateway settings would need to be saved via the settings API
      // For now, UI preferences are saved locally
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // Update handlers
  const updateSetting = <K extends keyof SettingsState>(
    section: K,
    updates: Partial<SettingsState[K]>
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
    setSaved(false);
  };

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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-green-500">Saved!</span>
            )}
            {error && (
              <span className="text-xs text-red-500">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="ui-btn-primary flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Gateway Settings */}
        <section className="ui-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Gateway Connection</h3>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Gateway URL
              </label>
              <input
                type="text"
                value={settings.gateway.url}
                onChange={(e) => updateSetting("gateway", { url: e.target.value })}
                placeholder="ws://localhost:18789"
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-primary"
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
                onClick={() => updateSetting("gateway", { autoStart: !settings.gateway.autoStart })}
                className={`ui-switch ${settings.gateway.autoStart ? "ui-switch--on" : ""}`}
              >
                <span className="ui-switch-thumb" />
              </button>
            </div>
          </div>
        </section>

        {/* Model Settings */}
        <section className="ui-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Default Model</h3>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Primary Model
              </label>
              <select
                value={settings.models.defaultModel}
                onChange={(e) => updateSetting("models", { defaultModel: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-primary"
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
                onChange={(e) => updateSetting("models", { temperature: parseFloat(e.target.value) })}
                className="h-2 w-full cursor-pointer rounded-full bg-surface-2"
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
                onChange={(e) => updateSetting("models", { maxTokens: parseInt(e.target.value) || 8192 })}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* Agent Settings */}
        <section className="ui-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Agents</h3>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Default Workspace
              </label>
              <input
                type="text"
                value={settings.agents.defaultWorkspace}
                onChange={(e) => updateSetting("agents", { defaultWorkspace: e.target.value })}
                placeholder="/path/to/workspace"
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Timezone
              </label>
              <select
                value={settings.agents.timezone}
                onChange={(e) => updateSetting("agents", { timezone: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:border-primary"
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
                    onClick={() => updateSetting("ui", { theme })}
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
                onClick={() => updateSetting("ui", { compactMode: !settings.ui.compactMode })}
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
                    localStorage.removeItem("rocclaw-ui-settings");
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
