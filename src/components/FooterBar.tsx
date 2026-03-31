"use client";

import Image from "next/image";
import { useAgentStore } from "@/features/agents/state/store";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
import { resolveGatewayStatusLabel } from "@/features/agents/components/colorSemantics";
import { ThemeToggle } from "@/components/theme-toggle";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import { ExternalLink, Cpu, Users } from "lucide-react";

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
  gatewayUrl: string;
}

export function FooterBar({ status, gatewayUrl }: FooterBarProps) {
  const { state } = useAgentStore();
  const agents = state.agents;

  const agentCount = agents.length;
  const runningCount = agents.filter((a) => a.status === "running").length;
  const runningAgents = agents.filter((a) => a.status === "running").slice(0, 5);

  return (
    <footer className="grid h-auto grid-cols-[1fr_auto_1fr] items-center border-t border-border/60 bg-surface-1/70 px-5 py-3 text-xs text-muted-foreground">
      {/* Left — connection + agents */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="font-medium">{resolveGatewayStatusLabel(status)}</span>
        </div>
        <div className="h-4 w-px bg-border/60" />
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>
            {agentCount} {agentCount === 1 ? "agent" : "agents"}
            {runningCount > 0 ? ` · ${runningCount} running` : ""}
          </span>
        </div>
        <div className="h-4 w-px bg-border/60" />
        <div className="flex min-w-0 items-center gap-2">
          <Cpu className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate font-mono">{gatewayUrl}</span>
          <a
            href={gatewayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
            title="Open gateway"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Center — version */}
      <div className="flex items-center justify-center px-6">
        <span className="whitespace-nowrap font-mono text-muted-foreground/40">rocCLAW</span>
      </div>

      {/* Right — avatars + theme */}
      <div className="flex items-center justify-end gap-4">
        {runningAgents.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {runningAgents.map((agent) => (
              <div
                key={agent.agentId}
                className="relative overflow-hidden rounded-full ring-1 ring-surface-1"
                title={agent.name}
              >
                <Image
                  src={buildAvatarDataUrl(agent.avatarSeed ?? agent.agentId)}
                  alt={agent.name}
                  width={24}
                  height={24}
                  className="h-6 w-6"
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}
        <div className="h-4 w-px bg-border/60" />
        <ThemeToggle />
      </div>
    </footer>
  );
}
