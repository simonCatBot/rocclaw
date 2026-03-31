"use client";

import Image from "next/image";
import { useAgentStore } from "@/features/agents/state/store";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
import { resolveGatewayStatusLabel } from "@/features/agents/components/colorSemantics";
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
    <footer
      className="flex items-center gap-3 border-t border-border/60 bg-surface-1/60 px-4 py-2 text-[11px] text-muted-foreground"
    >
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <StatusDot status={status} />
        <span>{resolveGatewayStatusLabel(status)}</span>
      </div>

      {/* Separator */}
      <div className="h-3 w-px bg-border/60" />

      {/* Agent count */}
      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3 shrink-0" />
        <span>
          {agentCount} {agentCount === 1 ? "agent" : "agents"}
          {runningCount > 0 ? ` · ${runningCount} running` : ""}
        </span>
      </div>

      {/* Separator */}
      <div className="h-3 w-px bg-border/60" />

      {/* Gateway URL */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Cpu className="h-3 w-3 shrink-0" />
        <span className="min-w-0 truncate font-mono">{gatewayUrl}</span>
        <a
          href={gatewayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
          title="Open gateway"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Spacer pushes avatars + version to the right */}
      <div className="flex flex-1" />

      {/* Running agent avatars */}
      {runningAgents.length > 0 && (
        <div className="flex items-center -space-x-1">
          {runningAgents.map((agent) => (
            <div
              key={agent.agentId}
              className="relative overflow-hidden rounded-full ring-1 ring-surface-1"
              title={agent.name}
            >
              <Image
                src={buildAvatarDataUrl(agent.avatarSeed ?? agent.agentId)}
                alt={agent.name}
                width={20}
                height={20}
                className="h-5 w-5"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="h-3 w-px bg-border/60" />

      {/* Version label */}
      <span className="shrink-0 font-mono text-muted-foreground/40">rocCLAW</span>
    </footer>
  );
}
