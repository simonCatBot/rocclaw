// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPage, type ConnectionPageProps } from "@/components/ConnectionPage";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { resolveGatewayStatusLabel } from "@/features/agents/components/colorSemantics";

function StatusDot({ status }: { status: GatewayStatus }) {
  const colorMap: Record<GatewayStatus, string> = {
    connected: "bg-green-400",
    disconnected: "bg-neutral-400",
    connecting: "bg-amber-400 animate-pulse",
    reconnecting: "bg-amber-400 animate-pulse",
    error: "bg-red-400",
  };
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorMap[status] ?? "bg-neutral-400"}`}
    />
  );
}

type ConnectionSetupViewProps = ConnectionPageProps & {
  settingsRouteActive: boolean;
  onBackToChat: () => void;
};

export const ConnectionSetupView = ({
  settingsRouteActive,
  onBackToChat,
  ...connectionProps
}: ConnectionSetupViewProps) => (
  <div className="relative min-h-dvh w-screen overflow-hidden bg-background">
    <div className="relative z-10 flex h-dvh flex-col">
      <HeaderBar />

      {/* Main content — matches main dashboard padding */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3 md:px-5 md:pb-5 md:pt-3">
        {settingsRouteActive ? (
          <div className="w-full">
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em]"
              onClick={onBackToChat}
            >
              Back to chat
            </button>
          </div>
        ) : null}

        {/* Panel wrapper — matches how Connection tab renders in main dashboard */}
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <ConnectionPage {...connectionProps} />
        </div>
      </main>

      {/* Footer — simplified version matching main dashboard FooterBar */}
      <footer
        aria-label="Application status"
        className="grid h-auto grid-cols-[1fr_auto_1fr] items-center border-t border-border/60 bg-surface-1/70 px-5 py-3 text-xs text-muted-foreground"
      >
        {/* Left — connection status */}
        <div className="flex items-center gap-2">
          <StatusDot status={connectionProps.status} />
          <span className="font-medium">
            {resolveGatewayStatusLabel(connectionProps.status)}
          </span>
        </div>

        {/* Center — branding */}
        <div className="flex items-center justify-center px-6">
          <span className="whitespace-nowrap font-mono text-muted-foreground/40">
            rocCLAW
          </span>
        </div>

        {/* Right — theme toggle */}
        <div className="flex items-center justify-end gap-4">
          <ColorSchemeToggle />
        </div>
      </footer>
    </div>
  </div>
);
