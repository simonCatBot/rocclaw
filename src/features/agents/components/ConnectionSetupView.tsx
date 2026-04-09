// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPage, type ConnectionPageProps } from "@/components/ConnectionPage";

type ConnectionSetupViewProps = ConnectionPageProps & {
  settingsRouteActive: boolean;
  onBackToChat: () => void;
};

export const ConnectionSetupView = ({
  settingsRouteActive,
  onBackToChat,
  ...connectionProps
}: ConnectionSetupViewProps) => (
  <div className="relative min-h-dvh w-screen overflow-y-auto bg-background">
    <div className="relative z-10 flex min-h-dvh flex-col">
      <HeaderBar />
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-3 sm:px-4 sm:pb-6 sm:pt-4 md:px-6 md:pt-4">
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
        <ConnectionPage {...connectionProps} />
      </div>
    </div>
  </div>
);
