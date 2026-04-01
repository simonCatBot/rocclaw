"use client";

import { Cog, Menu, Plug } from "lucide-react";
import Image from "next/image";
import { resolveGatewayStatusBadgeClass } from "@/features/agents/components/colorSemantics";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";

type HeaderBarProps = {
  status?: GatewayStatus;
  onConnectionSettings?: () => void;
  showConnectionSettings?: boolean;
  onMenuToggle?: () => void;
};

export const HeaderBar = ({
  status,
  onConnectionSettings,
  showConnectionSettings = true,
  onMenuToggle,
}: HeaderBarProps) => {
  return (
    <div className="ui-topbar border-none relative z-[180]">
      <div className="grid h-[7.5rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-4 md:px-5">
        {/* Left — menu + connection status */}
        <div className="flex items-center gap-2">
          {onMenuToggle ? (
            <button
              data-testid="studio-menu-toggle"
              type="button"
              onClick={onMenuToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          {showConnectionSettings && status && onConnectionSettings ? (
            <button
              type="button"
              onClick={onConnectionSettings}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${resolveGatewayStatusBadgeClass(status)}`}
              title={`Status: ${status}`}
            >
              <Plug className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{status}</span>
            </button>
          ) : null}
        </div>

        {/* Center — logo */}
        <div className="flex items-center justify-center">
          <div className="relative flex h-[7.5rem] w-auto items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="rocCLAW control"
              width={400}
              height={112}
              className="h-[7.5rem] w-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Right — settings */}
        <div className="flex items-center justify-end gap-2">
          {onConnectionSettings && (
            <button
              data-testid="gateway-settings-toggle"
              type="button"
              onClick={onConnectionSettings}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Connection settings"
            >
              <Cog className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
