"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { 
  Check, 
  Copy, 
  Eye, 
  EyeOff, 
  Loader2,
  Monitor,
  Cloud,
  Globe,
  Server,
  Zap,
  Shield,
  Key,
  Link
} from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import {
  isStudioLikelyRemote,
  resolveDefaultSetupScenario,
  resolveGatewayConnectionWarnings,
  type StudioConnectionWarning,
  type StudioInstallContext,
  type StudioSetupScenario,
} from "@/lib/rocclaw/install-context";
import type { StudioGatewaySettings } from "@/lib/rocclaw/settings";

type ConnectionTab = "local" | "client" | "cloud" | "remote";

const CONNECTION_TABS: { id: ConnectionTab; label: string; icon: typeof Monitor }[] = [
  { id: "local", label: "Local", icon: Monitor },
  { id: "client", label: "Client", icon: Server },
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "remote", label: "Remote", icon: Globe },
];

interface ConnectionPageProps {
  savedGatewayUrl: string;
  draftGatewayUrl: string;
  token: string;
  localGatewayDefaults: StudioGatewaySettings | null;
  localGatewayDefaultsHasToken: boolean;
  hasStoredToken: boolean;
  hasUnsavedChanges: boolean;
  installContext: StudioInstallContext;
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
}

const resolveLocalGatewayPort = (gatewayUrl: string): number => {
  try {
    const parsed = new URL(gatewayUrl);
    const port = Number(parsed.port);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {}
  return 18789;
};

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
}: ConnectionPageProps) {
  const [activeTab, setActiveTab] = useState<ConnectionTab>("local");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [showToken, setShowToken] = useState(false);

  const localPort = useMemo(
    () => resolveLocalGatewayPort(draftGatewayUrl || savedGatewayUrl),
    [draftGatewayUrl, savedGatewayUrl]
  );

  const localGatewayCommand = `openclaw gateway --port ${localPort}`;
  const gatewayServeCommand = `tailscale serve --yes --bg --https 443 http://127.0.0.1:${localPort}`;
  const studioServeCommand = "tailscale serve --yes --bg --https 443 http://127.0.0.1:3000";
  
  const studioOpenUrl = installContext.tailscale.loggedIn && installContext.tailscale.dnsName
    ? `https://${installContext.tailscale.dnsName}`
    : "https://<studio-host>.ts.net";

  const studioSshTarget = installContext.tailscale.dnsName || "<studio-host>";
  const studioTunnelCommand = `ssh -L 3000:127.0.0.1:3000 ${studioSshTarget}`;
  const gatewayTunnelCommand = `ssh -L ${localPort}:127.0.0.1:${localPort} user@<gateway-host>`;

  const warnings = useMemo<StudioConnectionWarning[]>(() => {
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
  const isConnected = status === "connected";
  
  const tokenHelper = hasStoredToken
    ? "A token is already stored. Leave blank to keep it."
    : localGatewayDefaultsHasToken
      ? "A local token is available. Leave blank to use it."
      : "Enter the gateway token.";

  const copyCommand = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  const applyLoopbackUrl = () => {
    onGatewayUrlChange(`ws://localhost:${localPort}`);
  };

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
            <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                {localGatewayCommand}
              </code>
              <button
                type="button"
                className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                onClick={() => void copyCommand(localGatewayCommand)}
              >
                {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
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
      description: "Local rocCLAW connecting to remote OpenClaw",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">On Gateway Host</p>
                <p className="text-xs text-muted-foreground">Expose OpenClaw with Tailscale</p>
              </div>
            </div>
            <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5 mb-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                {gatewayServeCommand}
              </code>
              <button
                type="button"
                className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                onClick={() => void copyCommand(gatewayServeCommand)}
              >
                {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Then enter <code className="font-mono">wss://&lt;gateway-host&gt;.ts.net</code> in the URL field.
            </p>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Fallback: SSH Tunnel</p>
                <p className="text-xs text-muted-foreground">If Tailscale is not available</p>
              </div>
            </div>
            <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5 mb-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                {gatewayTunnelCommand}
              </code>
              <button
                type="button"
                className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                onClick={() => void copyCommand(gatewayTunnelCommand)}
              >
                {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              className="ui-btn-secondary h-9 px-4 text-xs font-semibold"
              onClick={applyLoopbackUrl}
            >
              Use SSH Tunnel URL
            </button>
          </div>
        </div>
      ),
    },
    cloud: {
      title: "Cloud Setup",
      description: "rocCLAW and OpenClaw on same cloud machine",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Cloud className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Expose rocCLAW</p>
                <p className="text-xs text-muted-foreground">Make rocCLAW accessible via Tailscale</p>
              </div>
            </div>
            <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5 mb-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                {studioServeCommand}
              </code>
              <button
                type="button"
                className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                onClick={() => void copyCommand(studioServeCommand)}
              >
                {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Then open <code className="font-mono">{studioOpenUrl}</code>
            </p>
          </div>

          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Start OpenClaw</p>
                <p className="text-xs text-muted-foreground">On the same cloud machine</p>
              </div>
            </div>
            <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5 mb-3">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                {localGatewayCommand}
              </code>
              <button
                type="button"
                className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                onClick={() => void copyCommand(localGatewayCommand)}
              >
                {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-2">
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
        </div>
      ),
    },
    remote: {
      title: "Remote Access",
      description: "Access rocCLAW and OpenClaw from anywhere",
      content: (
        <div className="space-y-5">
          <div className="ui-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="ui-card p-2 rounded-lg">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">SSH Tunnel Access</p>
                <p className="text-xs text-muted-foreground">For when Tailscale isn&apos;t set up</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">rocCLAW tunnel</p>
                <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                    {studioTunnelCommand}
                  </code>
                  <button
                    type="button"
                    className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                    onClick={() => void copyCommand(studioTunnelCommand)}
                  >
                    {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Gateway tunnel</p>
                <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2.5">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">
                    {gatewayTunnelCommand}
                  </code>
                  <button
                    type="button"
                    className="ui-btn-icon ui-command-copy h-8 w-8 shrink-0"
                    onClick={() => void copyCommand(gatewayTunnelCommand)}
                  >
                    {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {installContext.tailscale.loggedIn === false && (
            <div className="ui-alert-warning rounded-md px-4 py-3 text-sm">
              Tailscale not detected. Consider setting it up for easier access.
            </div>
          )}
        </div>
      ),
    },
  };

  const currentTab = tabContents[activeTab];

  return (
    <div className="ui-panel ui-depth-workspace flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
        <div className="flex gap-1 min-w-max">
          {CONNECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
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

      {/* Content - two column layout */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
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

            {/* Right Column - Connection Form */}
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
                    <label className="text-xs font-medium text-muted-foreground">
                      Gateway URL
                    </label>
                    <input
                      type="text"
                      value={draftGatewayUrl}
                      onChange={(e) => onGatewayUrlChange(e.target.value)}
                      placeholder={activeTab === "local" ? `ws://localhost:${localPort}` : "wss://gateway.ts.net"}
                      className="ui-input h-11 w-full rounded-md px-4 text-sm"
                      spellCheck={false}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Token
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        value={token}
                        onChange={(e) => onTokenChange(e.target.value)}
                        placeholder={hasStoredToken || localGatewayDefaultsHasToken ? "keep existing" : "gateway token"}
                        className="ui-input h-11 w-full rounded-md px-4 pr-10 text-sm"
                        spellCheck={false}
                      />
                      <button
                        type="button"
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

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="ui-btn-primary h-10 px-5 text-xs font-semibold tracking-wide"
                    onClick={() => void onSaveSettings()}
                    disabled={actionBusy || !draftGatewayUrl.trim()}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Settings
                  </button>
                  <button
                    type="button"
                    className="ui-btn-secondary h-10 px-5 text-xs font-semibold tracking-wide"
                    onClick={() => void onTestConnection()}
                    disabled={actionBusy || !draftGatewayUrl.trim()}
                  >
                    {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Test Connection
                  </button>
                  {isConnected && (
                    <button
                      type="button"
                      className="ui-btn-ghost h-10 px-5 text-xs font-semibold tracking-wide text-foreground"
                      onClick={() => void onDisconnect()}
                      disabled={actionBusy}
                    >
                      {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Disconnect
                    </button>
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
                      {status === "reconnecting" && "Reconnecting..."}
                      {status === "error" && "Connection Error"}
                      {status === "disconnected" && "Disconnected"}
                    </p>
                    {statusReason && (
                      <p className="text-xs text-muted-foreground">{statusReason}</p>
                    )}
                  </div>
                  {isConnected && (
                    <span className="ui-chip text-xs font-mono font-semibold tracking-wide bg-green-500/10 text-green-500">
                      Connected
                    </span>
                  )}
                </div>
              </div>

              {/* Connect Now Button */}
              <button
                type="button"
                className={`ui-btn-primary w-full h-12 text-sm font-semibold tracking-wide rounded-lg ${
                  isConnected ? "bg-green-600 hover:bg-green-700" : ""
                }`}
                onClick={() => {
                  if (isConnected) {
                    onDisconnect?.();
                  } else {
                    onConnect?.() || onSaveSettings?.();
                  }
                }}
                disabled={actionBusy || (!draftGatewayUrl.trim() && !isConnected)}
              >
                {actionBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : isConnected ? (
                  "Disconnect"
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2 inline" />
                    Connect Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
