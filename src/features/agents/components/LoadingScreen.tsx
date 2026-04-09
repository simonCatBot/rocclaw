// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

export const LoadingScreen = () => (
  <div className="relative min-h-dvh w-screen overflow-hidden bg-background">
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="glass-panel ui-panel w-full max-w-md px-6 py-6 text-center">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          rocCLAW
        </div>
        <div className="mt-3 text-sm text-muted-foreground">Loading agents&hellip;</div>
      </div>
    </div>
  </div>
);
