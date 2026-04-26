// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { ROCclawInstallContext } from "@/lib/rocclaw/install-context";

type BootScreenProps = {
  connecting: boolean;
  installContext?: ROCclawInstallContext | null;
  onEditSettings: () => void;
};

export const BootScreen = ({ connecting, installContext, onEditSettings }: BootScreenProps) => {
  const probeHealthy = installContext?.localGateway.probeHealthy ?? false;
  const cliAvailable = installContext?.localGateway.cliAvailable ?? false;

  const environmentHint = probeHealthy
    ? "Local gateway detected"
    : cliAvailable
      ? "OpenClaw CLI available"
      : null;

  return (
    <div className="relative min-h-dvh w-screen overflow-hidden bg-background">
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass-panel ui-panel flex w-full max-w-md flex-col items-center px-6 py-6 text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            rocCLAW
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {connecting ? "Connecting to gateway\u2026" : "Booting\u2026"}
          </div>
          {environmentHint && (
            <div className="mt-2 text-xs text-muted-foreground/70">
              {environmentHint}
            </div>
          )}
          <button
            type="button"
            className="ui-btn-secondary mt-4 px-4 py-2 text-xs font-semibold tracking-[0.05em] text-foreground"
            onClick={onEditSettings}
          >
            Edit connection settings
          </button>
        </div>
      </div>
    </div>
  );
};
