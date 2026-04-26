// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  Server,
  Shield,
  Key,
  Link,
  Wifi,
  WifiOff,
  Terminal,
  Zap,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import {
  resolveDefaultSetupScenario,
  resolveGatewayConnectionWarnings,
  type ROCclawConnectionWarning,
  type ROCclawInstallContext,
} from "@/lib/rocclaw/install-context";
import type { ROCclawGatewaySettings } from "@/lib/rocclaw/settings";

type ConnectionTab = "local" | "client" | "cloud" | "remote";

const CONNECTION_TABS: { id: ConnectionTab; label: string; icon: typeof Monitor }[] = [
  { id: "local", label: "Local", icon: Monitor },
  { id: "client", label: "Client", icon: Server },
  { id: "cloud", label: "Cloud", icon: Terminal },
  { id: "remote", label: "Remote", icon: Shield },
];

export interface ConnectionPageProps {
  savedGatewayUrl: string;
  draftGatewayUrl: string;
  token: string;
  localGatewayDefaults: ROCclawGatewaySettings | null;
  localGatewayDefaultsHasToken: boolean;
  hasStoredToken: boolean;
  hasUnsavedChanges: boolean;
  installContext: ROCclawInstallContext;
  status: GatewayStatus;
  statusReason: string | null;
  error: string | null;
  testResult: { kind: "success" | "error"; message: string } | null;
  saving: boolean;
  testing: boolean;
  disconnecting: boolean;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onUseLocalDefaults: () => void;
  onSaveSettings: () => void;
  onTestConnection: () => void;
  onDisconnect: () => void;
  onConnect?: () => void;
  onClearError?: () => void;
}

const resolveLocalGatewayPort = (gatewayUrl: string): number => {
  try {
    const parsed = new URL(gatewayUrl);
    const port = Number(parsed.port);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {}
  return 18789;
};

function CommandBlock({
  label,
  command,
  copiedCommand,
  onCopy,
}: {
  label?: string;
  command: string;
  copiedCommand: string | null;
  onCopy: (value: string) => void;
}) {
  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      )}
      <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
          {command}
        </code>
        <button
          type="button"
          className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
          onClick={() => onCopy(command)}
        >
          {copiedCommand === command ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ConnectionPage({
  savedGatewayUrl,
  draftGatewayUrl,
  token,
  localGatewayDefaults,
  localGatewayDefaultsHasToken,
  hasStoredToken,
  hasUnsavedChanges,
  installContext,
  status,
  statusReason,
  error,
  testResult,
  saving,
  testing,
  disconnecting,
  onGatewayUrlChange,
  onTokenChange,
  onUseLocalDefaults,
  onSaveSettings,
  onTestConnection,
  onDisconnect,
  onConnect,
  onClearError,
}: ConnectionPageProps) {
  const inferredTab = useMemo((): ConnectionTab => {
    const scenario = resolveDefaultSetupScenario({
      installContext,
      gatewayUrl: draftGatewayUrl || savedGatewayUrl,
    });
    if (scenario === "remote-gateway") return "remote";
    if (scenario === "same-cloud-host") return "cloud";
    return "local";
  }, [installContext, draftGatewayUrl, savedGatewayUrl]);

  const [activeTab, setActiveTab] = useState<ConnectionTab>(inferredTab);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const localPort = useMemo(
    () => resolveLocalGatewayPort(draftGatewayUrl || savedGatewayUrl),
    [draftGatewayUrl, savedGatewayUrl]
  );

  const localGatewayCommand = `openclaw gateway --port ${localPort}`;

  const rocclawTunnelCommand = "ssh -L 3000:127.0.0.1:3000 user@<remote-host>";
  const gatewayTunnelCommand = `ssh -L ${localPort}:127.0.0.1:${localPort} user@<gateway-host>`;
  const combinedTunnelCommand = `ssh -L 3000:127.0.0.1:3000 -L ${localPort}:127.0.0.1:${localPort} user@<remote-host>`;

  const warnings = useMemo<ROCclawConnectionWarning[]>(() => {
    return resolveGatewayConnectionWarnings({
      gatewayUrl: draftGatewayUrl,
      installContext,
      scenario: activeTab === "local" ? "same-computer" :
                activeTab === "client" ? "remote-gateway" : "same-cloud-host",
      hasStoredToken,
      hasLocalGatewayToken: localGatewayDefaultsHasToken,
    });
  }, [draftGatewayUrl, hasStoredToken, installContext, localGatewayDefaultsHasToken, activeTab]);

  const actionBusy = saving || testing || disconnecting;

  // URL validation
  const urlValidationError = (() => {
    const url = draftGatewayUrl.trim();
    if (!url) return null;
    if (!/^wss?:\/\//i.test(url)) return "URL must start with ws:// or wss://";
    try {
      new URL(url);
    } catch {
      return "Invalid URL format";
    }
    return null;
  })();
  const isConnected = status === "connected";

  const tokenHelper = hasStoredToken
    ? "A token is already stored. Leave blank to keep it."
    : localGatewayDefaultsHasToken
      ? "A local token is available. Leave blank to use it."
      : "Enter the gateway token.";

  const copyCommand = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCommand(value);
      window.setTimeout(() => setCopiedCommand((prev) => prev === value ? null : prev), 1200);
    } catch {
      // Silently fail — clipboard API may not be available
    }
  };

  const handleCopy = (value: string) => {
    void copyCommand(value);
  };

  const applyLoopbackUrl = () => {
    onGatewayUrlChange(`ws://localhost:${localPort}`);
  };

  // Resolve banner state
  const probeHealthy = installContext.localGateway.probeHealthy;
  const cliAvailable = installContext.localGateway.cliAvailable;
  const localGatewayUrl = installContext.localGateway.url;

  // Tab content definitions
  const tabContents: Record<ConnectionTab, { title: string; description: string; content: React.ReactNode }> = {
    local: {
      title: "Local Connection",
      description: "rocCLAW and OpenClaw on the same machine",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Start OpenClaw</p>
                <p className="text-xs text-muted-foreground">Run this command on your machine</p>
              </div>
            </div>
            <CommandBlock command={localGatewayCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Quick Connect</p>
                <p className="text-xs text-muted-foreground">Use local defaults if available</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="ui-btn-secondary h-9 px-4 text-xs font-semibold"
                onClick={applyLoopbackUrl}
              >
                Use localhost:{localPort}
              </button>
              {localGatewayDefaults && (
                <button
                  type="button"
                  className="ui-btn-secondary h-9 px-4 text-xs font-semibold"
                  onClick={onUseLocalDefaults}
                >
                  Use Local Defaults
                </button>
              )}
            </div>
          </div>
        </div>
      ),
    },
    client: {
      title: "Client Connection",
      description: "Local rocCLAW connecting to remote OpenClaw via SSH",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">SSH Tunnel to Gateway</p>
                <p className="text-xs text-muted-foreground">Forward the gateway port to your local machine</p>
              </div>
            </div>
            <CommandBlock label="Run on your local machine" command={gatewayTunnelCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
            <p className="text-xs text-muted-foreground mt-3">
              This forwards the remote gateway port to <code className="font-mono">localhost:{localPort}</code>.
              Replace <code className="font-mono">user@&lt;gateway-host&gt;</code> with your SSH login.
            </p>
            <button
              type="button"
              className="ui-btn-secondary h-9 px-4 text-xs font-semibold mt-3"
              onClick={applyLoopbackUrl}
            >
              Use localhost:{localPort}
            </button>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Persistent Tunnel</p>
                <p className="text-xs text-muted-foreground">Keep the tunnel alive with autossh</p>
              </div>
            </div>
            <CommandBlock command={`autossh -M 0 -f -N -L ${localPort}:127.0.0.1:${localPort} user@<gateway-host>`} copiedCommand={copiedCommand} onCopy={handleCopy} />
            <p className="text-xs text-muted-foreground mt-3">
              Install with <code className="font-mono">sudo apt install autossh</code>. The tunnel auto-reconnects on failure.
            </p>
          </div>
        </div>
      ),
    },
    cloud: {
      title: "Cloud Setup",
      description: "rocCLAW and OpenClaw on same cloud/remote machine",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Start Both Services</p>
                <p className="text-xs text-muted-foreground">Run on the cloud machine</p>
              </div>
            </div>
            <CommandBlock label="Start the gateway" command={localGatewayCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="ui-btn-secondary h-9 px-4 text-xs font-semibold"
                onClick={applyLoopbackUrl}
              >
                Use Localhost
              </button>
              {localGatewayDefaults && (
                <button
                  type="button"
                  className="ui-btn-secondary h-9 px-4 text-xs font-semibold"
                  onClick={onUseLocalDefaults}
                >
                  Use Local Defaults
                </button>
              )}
            </div>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Access via SSH Tunnel</p>
                <p className="text-xs text-muted-foreground">Forward both ports to your local machine</p>
              </div>
            </div>
            <CommandBlock label="Run on your local machine" command={combinedTunnelCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
            <p className="text-xs text-muted-foreground mt-3">
              Then open <code className="font-mono">http://localhost:3000</code> in your local browser.
              Both rocCLAW and the gateway are forwarded through the SSH tunnel.
            </p>
          </div>
        </div>
      ),
    },
    remote: {
      title: "Remote Access",
      description: "Access rocCLAW and OpenClaw from anywhere via SSH",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">SSH Tunnel — Both Ports</p>
                <p className="text-xs text-muted-foreground">Forward rocCLAW and the gateway to your local machine</p>
              </div>
            </div>
            <CommandBlock label="Combined tunnel (recommended)" command={combinedTunnelCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
            <div className="space-y-3 mt-4">
              <CommandBlock label="Or forward separately — rocCLAW" command={rocclawTunnelCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
              <CommandBlock label="And gateway" command={gatewayTunnelCommand} copiedCommand={copiedCommand} onCopy={handleCopy} />
            </div>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Persistent Tunnel</p>
                <p className="text-xs text-muted-foreground">Auto-reconnect with autossh</p>
              </div>
            </div>
            <CommandBlock command={`autossh -M 0 -f -N -L 3000:127.0.0.1:3000 -L ${localPort}:127.0.0.1:${localPort} user@<remote-host>`} copiedCommand={copiedCommand} onCopy={handleCopy} />
            <p className="text-xs text-muted-foreground mt-3">
              After connecting, open <code className="font-mono">http://localhost:3000</code> in your local browser.
            </p>
          </div>
        </div>
      ),
    },
  };

  const currentTab = tabContents[activeTab];

  return (
    <div className="ui-panel ui-depth-workspace flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-surface-1/30 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="ui-card p-1.5 sm:p-2 rounded-lg">
            <Link className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-foreground">Connection</h1>
            <p className="hidden xs:block text-xs text-muted-foreground">Configure how rocCLAW connects to OpenClaw</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-border/50 px-4 sm:px-6 pt-3 sm:pt-4 overflow-x-auto">
        <div role="tablist" aria-label="Connection methods" className="flex gap-1 min-w-max">
          {CONNECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-surface-2 text-foreground border-t border-x border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-1/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">

          {/* Environment Detection Banner */}
          {isConnected ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <Wifi className="h-5 w-5 shrink-0 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Connected to OpenClaw</p>
                <p className="text-xs text-muted-foreground">{savedGatewayUrl}</p>
              </div>
              <button
                type="button"
                className="ui-btn-ghost h-9 px-4 text-xs font-semibold text-foreground"
                onClick={() => void onDisconnect()}
                disabled={actionBusy}
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disconnect
              </button>
            </div>
          ) : probeHealthy ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <Monitor className="h-5 w-5 shrink-0 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Local gateway detected</p>
                <p className="text-xs text-muted-foreground">
                  {localGatewayUrl ? `at ${localGatewayUrl}` : "Ready to connect"}
                </p>
              </div>
              <button
                type="button"
                className="ui-btn-primary h-9 px-4 text-xs font-semibold"
                onClick={() => {
                  if (localGatewayDefaults) onUseLocalDefaults();
                  onConnect?.();
                }}
                disabled={actionBusy}
              >
                Connect
              </button>
            </div>
          ) : cliAvailable ? (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <Terminal className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Gateway found but not responding</p>
                <p className="text-xs text-muted-foreground">
                  Try starting it with <code className="font-mono">openclaw gateway</code>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1/50 px-4 py-3">
              <WifiOff className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">No local gateway detected</p>
                <p className="text-xs text-muted-foreground">
                  Start the gateway with <code className="font-mono">openclaw gateway</code>
                </p>
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column - Instructions */}
            <div className="space-y-4 sm:space-y-6">
              {/* Tab description */}
              <div className="ui-card p-4">
                <p className="text-sm font-semibold text-foreground">{currentTab.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentTab.description}</p>
              </div>

              {/* Tab-specific content */}
              {currentTab.content}

              {/* CLI update warning */}
              {installContext.rocclawCli.installed && installContext.rocclawCli.updateAvailable && (
                <div className="ui-alert-danger rounded-md px-4 py-2 text-sm">
                  openclaw-rocclaw CLI {installContext.rocclawCli.currentVersion?.trim() || "current"} is installed, but {installContext.rocclawCli.latestVersion?.trim() || "a newer version"} is available. Run <code className="font-mono">npx -y openclaw-rocclaw@latest</code> to update.
                </div>
              )}

              {/* Public host security warning */}
              {installContext.rocclawHost.publicHosts.length > 0 && (
                <div className="ui-alert-danger rounded-md px-4 py-2 text-sm">
                  This rocCLAW is bound beyond loopback. <code className="font-mono">ROCCLAW_ACCESS_TOKEN</code> is required and each browser must visit <code className="font-mono">/?access_token=...</code> once.
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="space-y-2">
                  {warnings.map((warning) => (
                    <div
                      key={warning.id}
                      className={
                        warning.tone === "warn"
                          ? "ui-alert-danger rounded-md px-4 py-2 text-sm"
                          : "ui-card rounded-md px-4 py-2 text-sm text-muted-foreground"
                      }
                    >
                      {warning.message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column — Connection Form */}
            <div className="space-y-4 sm:space-y-6">
              {/* Connection Form */}
              <div className="ui-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="ui-card p-2 rounded-lg">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Gateway URL & Token</p>
                    <p className="text-xs text-muted-foreground">Enter your connection details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="gateway-url" className="text-xs font-medium text-muted-foreground">
                      Gateway URL
                    </label>
                    <input
                      id="gateway-url"
                      type="text"
                      value={draftGatewayUrl}
                      onChange={(e) => onGatewayUrlChange(e.target.value)}
                      placeholder={`ws://localhost:${localPort}`}
                      className={`ui-input h-11 w-full rounded-md px-4 text-sm ${urlValidationError ? "border-red-500/60" : ""}`}
                      spellCheck={false}
                      aria-invalid={!!urlValidationError}
                      aria-describedby={urlValidationError ? "gateway-url-error" : undefined}
                    />
                    {urlValidationError && (
                      <p id="gateway-url-error" className="mt-1 text-xs text-red-500">
                        {urlValidationError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="gateway-token" className="text-xs font-medium text-muted-foreground">
                        Token
                      </label>
                      {hasStoredToken ? (
                        <span className="ui-chip text-[10px] font-semibold bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                          Stored
                        </span>
                      ) : localGatewayDefaultsHasToken ? (
                        <span className="ui-chip text-[10px] font-semibold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                          Auto-detected
                        </span>
                      ) : null}
                    </div>
                    <div className="relative">
                      <input
                        id="gateway-token"
                        type={showToken ? "text" : "password"}
                        value={token}
                        onChange={(e) => onTokenChange(e.target.value)}
                        placeholder={hasStoredToken || localGatewayDefaultsHasToken ? "keep existing" : "gateway token"}
                        className="ui-input h-11 w-full rounded-md px-4 pr-10 text-sm"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        aria-label={showToken ? "Hide token" : "Show token"}
                        className="absolute inset-y-0 right-0 my-auto h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setShowToken((prev) => !prev)}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{tokenHelper}</p>

                {hasUnsavedChanges && (
                  <p className="text-xs font-mono font-semibold text-muted-foreground">
                    Unsaved changes
                  </p>
                )}

                {/* Primary action button */}
                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    className="ui-btn-primary w-full h-11 text-sm font-semibold tracking-wide"
                    onClick={() => {
                      if (isConnected) {
                        void onDisconnect();
                      } else {
                        void onSaveSettings();
                      }
                    }}
                    disabled={actionBusy || (!isConnected && (!draftGatewayUrl.trim() || !!urlValidationError))}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                    {isConnected ? "Disconnect" : "Connect"}
                  </button>

                  {/* Test Connection — secondary text link */}
                  {!isConnected && (
                    <div className="text-center">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        onClick={() => void onTestConnection()}
                        disabled={actionBusy || !draftGatewayUrl.trim() || !!urlValidationError}
                      >
                        {testing ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1 inline" />
                            Testing…
                          </>
                        ) : (
                          "Test Connection"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="ui-card p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      status === "connected"
                        ? "bg-green-500"
                        : status === "connecting" || status === "reconnecting"
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-muted"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {status === "connected" && "Connected to OpenClaw"}
                      {status === "connecting" && "Connecting..."}
                      {status === "reconnecting" && "Reconnecting — retrying automatically..."}
                      {status === "error" && "Connection Error"}
                      {status === "disconnected" && "Disconnected"}
                    </p>
                    {statusReason && (
                      <p className="text-xs text-muted-foreground">{statusReason}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Test result display */}
              {testResult && (
                <div
                  className={`flex items-start gap-2 rounded-lg px-4 py-3 ${
                    testResult.kind === "error"
                      ? "border border-red-500/30 bg-red-500/10"
                      : "border border-green-500/30 bg-green-500/10"
                  }`}
                >
                  {testResult.kind === "error" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                  )}
                  <p
                    className={`text-xs font-medium ${
                      testResult.kind === "error" ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {testResult.message}
                  </p>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="flex-1 text-xs font-medium text-red-400">{error}</p>
                  {onClearError && (
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-300"
                      onClick={onClearError}
                      aria-label="Dismiss error"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
