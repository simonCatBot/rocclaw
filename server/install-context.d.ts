// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { ROCclawInstallContext } from "../src/lib/rocclaw/install-context";

export type InstallContextCommandRunner = (
  file: string,
  args: string[],
  options: {
    timeout: number;
    maxBuffer: number;
    windowsHide: boolean;
    encoding: string;
  }
) => Promise<{ stdout?: string }>;

export function detectInstallContext(
  env?: NodeJS.ProcessEnv,
  options?: {
    resolveHosts?: (env?: NodeJS.ProcessEnv) => string[];
    isPublicHost?: (host: string) => boolean;
    readOpenclawGatewayDefaults?: (
      env?: NodeJS.ProcessEnv
    ) => { url: string; token: string } | null;
    runCommand?: InstallContextCommandRunner;
    fetch?: typeof fetch;
  }
): Promise<ROCclawInstallContext>;

export function buildStartupGuidance(params: {
  installContext: ROCclawInstallContext;
  port: number;
}): string[];
