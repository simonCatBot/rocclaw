import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { X, Wifi, WifiOff, Loader, CheckCircle, XCircle } from "lucide-react";
import { resolveGatewayStatusBadgeClass, resolveGatewayStatusLabel } from "./colorSemantics";

type ConnectionPanelProps = {
  savedGatewayUrl: string;
  draftGatewayUrl: string;
  token: string;
  hasStoredToken: boolean;
  localGatewayDefaultsHasToken: boolean;
  hasUnsavedChanges: boolean;
  status: GatewayStatus;
  statusReason: string | null;
  error: string | null;
  testResult:
    | {
        kind: "success" | "error";
        message: string;
      }
    | null;
  saving: boolean;
  testing: boolean;
  disconnecting: boolean;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onSaveSettings: () => void;
  onTestConnection: () => void;
  onDisconnect: () => void;
  onClose?: () => void;
};

export const ConnectionPanel = ({
  savedGatewayUrl,
  draftGatewayUrl,
  token,
  hasStoredToken,
  localGatewayDefaultsHasToken,
  hasUnsavedChanges,
  status,
  statusReason,
  error,
  testResult,
  saving,
  testing,
  disconnecting,
  onGatewayUrlChange,
  onTokenChange,
  onSaveSettings,
  onTestConnection,
  onDisconnect,
  onClose,
}: ConnectionPanelProps) => {
  const actionBusy = saving || testing || disconnecting;
  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || status === "reconnecting";

  const tokenHelper = hasStoredToken
    ? "Stored token on this rocCLAW host — leave blank to keep it."
    : localGatewayDefaultsHasToken
      ? "Local OpenClaw token found — leave blank to use it."
      : "Token for this upstream gateway (optional if the gateway has none).";

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-1 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-400" />
          ) : isConnecting ? (
            <Loader className="h-5 w-5 animate-spin text-amber-400" />
          ) : (
            <WifiOff className="h-5 w-5 text-neutral-400" />
          )}
          <div>
            <h2 className="text-sm font-semibold text-foreground">Gateway Connection</h2>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? `Connected · ${savedGatewayUrl}`
                : isConnecting
                  ? "Connecting…"
                  : "Not connected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`ui-chip px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] ${resolveGatewayStatusBadgeClass(status)}`}
            data-status={status}
          >
            {resolveGatewayStatusLabel(status)}
          </span>
          {onClose ? (
            <button
              data-testid="gateway-connection-close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              type="button"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 px-6 py-5">
        {/* URL + Token fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Upstream gateway URL
            </span>
            <input
              data-testid="gateway-url-input"
              className="h-10 rounded-xl border border-border bg-surface-2 px-4 font-mono text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              type="text"
              value={draftGatewayUrl}
              onChange={(e) => onGatewayUrlChange(e.target.value)}
              placeholder="ws://localhost:18789"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Upstream token
              </span>
              {(hasStoredToken || localGatewayDefaultsHasToken) && (
                <span className="text-[10px] text-green-400/70">stored · safe</span>
              )}
            </span>
            <input
              className="h-10 rounded-xl border border-border bg-surface-2 px-4 font-mono text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              type="password"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="••••••••"
              spellCheck={false}
            />
          </label>
        </div>

        {/* Token helper */}
        <p className="-mt-1 text-xs text-muted-foreground/70">{tokenHelper}</p>

        {/* Status reason */}
        {statusReason && (
          <p className="rounded-lg bg-surface-2 px-4 py-2 text-xs text-muted-foreground">
            {statusReason}
          </p>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-xl px-4 py-3 ${
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

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs font-medium text-red-400">{error}</p>
          </div>
        )}

        {/* Unsaved indicator */}
        {hasUnsavedChanges && (
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Unsaved changes
          </p>
        )}
      </div>

      {/* Actions footer */}
      <div className="flex items-center justify-between border-t border-border/60 bg-surface-2/40 px-6 py-4 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onDisconnect}
              disabled={actionBusy}
            >
              {disconnecting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : null}
          {!isConnected && (
            <button
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-border/80 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onTestConnection}
              disabled={actionBusy || !draftGatewayUrl.trim()}
            >
              {testing ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
              {testing ? "Testing…" : "Test connection"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isConnected && savedGatewayUrl ? (
            <p className="text-[10px] text-muted-foreground/50">
              Saved: <span className="font-mono">{savedGatewayUrl}</span>
            </p>
          ) : null}
          <button
            data-testid="gateway-save-settings"
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onSaveSettings}
            disabled={actionBusy || !draftGatewayUrl.trim()}
          >
            {saving ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
};
