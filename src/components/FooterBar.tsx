// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAgentStore } from "@/features/agents/state/store";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
import { buildDefaultAvatarUrl, deriveDefaultIndex } from "@/features/agents/components/AgentAvatar";
import { resolveGatewayStatusLabel } from "@/features/agents/components/colorSemantics";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { AvatarModeToggle } from "@/components/AvatarModeToggle";
import { useAvatarMode, type AvatarDisplayMode } from "@/components/AvatarModeContext";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { Users, Plug } from "lucide-react";

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

interface FooterBarProps {
  status: GatewayStatus;
  gatewayVersion?: string | null;
  onConnectionSettings: () => void;
}

export function FooterBar({ status, gatewayVersion: initialVersion, onConnectionSettings }: FooterBarProps) {
  const { state } = useAgentStore();
  const agents = state.agents;
  const [gatewayVersion, setGatewayVersion] = useState<string | null>(initialVersion ?? null);
  const avatarMode = useAvatarMode();

  // Fetch gateway version from /api/gateway-info when connected
  useEffect(() => {
    if (status !== "connected") return;
    const controller = new AbortController();
    fetch("/api/gateway-info", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.presence?.version) {
          setGatewayVersion(data.presence.version);
        }
      })
      .catch(() => {
        // Best-effort — leave existing value
      });
    return () => controller.abort();
  }, [status]);

  const agentCount = agents.length;
  const runningCount = agents.filter((a) => a.status === "running").length;
  const runningAgents = agents.filter((a) => a.status === "running").slice(0, 5);

  const getFooterAvatarSrc = (
    agent: ReturnType<typeof useAgentStore>["state"]["agents"][number],
    avatarMode: AvatarDisplayMode
  ) => {
    const source = agent.avatarSource;
    // custom URL always wins if set
    if (source === "custom" && agent.avatarUrl?.trim()) {
      return agent.avatarUrl.trim();
    }
    // Use context mode
    if (avatarMode === "default") {
      return buildDefaultAvatarUrl(deriveDefaultIndex(agent.avatarSeed ?? agent.agentId, agent.defaultAvatarIndex ?? 0));
    }
    // auto
    return buildAvatarDataUrl(agent.avatarSeed ?? agent.agentId ?? "default");
  };

  return (
    <footer className="grid h-auto grid-cols-[1fr_auto_1fr] items-center border-t border-border/60 bg-surface-1/70 px-5 py-3 text-xs text-muted-foreground">
      {/* Left — connection status + version */}
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="font-medium">{resolveGatewayStatusLabel(status)}</span>
        {gatewayVersion && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <span className="whitespace-nowrap font-mono text-muted-foreground/60">OpenClaw Version:{gatewayVersion}</span>
          </>
        )}
      </div>

      {/* Center — rocCLAW */}
      <div className="flex items-center justify-center px-6">
        <span className="whitespace-nowrap font-mono text-muted-foreground/40">rocCLAW</span>
      </div>

      {/* Right — agents + avatars + connection + theme */}
      <div className="flex items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>
            {agentCount} {agentCount === 1 ? "agent" : "agents"}
            {runningCount > 0 ? ` · ${runningCount} running` : ""}
          </span>
        </div>
        {runningAgents.length > 0 && (
          <>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex items-center -space-x-1.5">
              {runningAgents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="relative overflow-hidden rounded-full ring-1 ring-black/20 dark:ring-white/10"
                  title={agent.name}
                >
                  <Image
                    src={getFooterAvatarSrc(agent, avatarMode)}
                    alt={agent.name}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="h-4 w-px bg-border/60" />

        {/* Connection settings button */}
        <button
          type="button"
          onClick={onConnectionSettings}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:border-border/80 hover:text-foreground"
          title="Gateway connection settings"
        >
          <Plug className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border/60" />

        {/* Avatar mode + theme — always visible, side by side */}
        <AvatarModeToggle />

        <div className="h-4 w-px bg-border/60" />

        <ColorSchemeToggle />
      </div>
    </footer>
  );
}
