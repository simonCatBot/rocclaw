// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "./AgentAvatar";
import {
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
} from "./colorSemantics";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { Plus, Cpu, Search } from "lucide-react";

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter?: FocusFilter;
  onFilterChange?: (next: FocusFilter) => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  createDisabled?: boolean;
  createBusy?: boolean;
};

export const FleetSidebar = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
  createDisabled = false,
  createBusy = false,
  className,
}: FleetSidebarProps & { className?: string }) => {
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const previousTopByAgentIdRef = useRef<Map<string, number>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let result = agents;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.identityName?.toLowerCase().includes(q)) ||
          a.agentId.toLowerCase().includes(q) ||
          (a.model?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [agents, searchQuery]);

  const agentOrderKey = useMemo(() => filteredAgents.map((agent) => agent.agentId).join("|"), [filteredAgents]);

  useLayoutEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();

    const getTopInScrollContent = (node: HTMLElement) =>
      node.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop;

    const nextTopByAgentId = new Map<string, number>();
    const agentIds = agentOrderKey.length === 0 ? [] : agentOrderKey.split("|");
    for (const agentId of agentIds) {
      const node = rowRefs.current.get(agentId);
      if (!node) continue;
      const nextTop = getTopInScrollContent(node);
      nextTopByAgentId.set(agentId, nextTop);
      const previousTop = previousTopByAgentIdRef.current.get(agentId);
      if (typeof previousTop !== "number") continue;
      const deltaY = previousTop - nextTop;
      if (Math.abs(deltaY) < 0.5) continue;
      if (typeof node.animate !== "function") continue;
      node.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0px)" }],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
    previousTopByAgentIdRef.current = nextTopByAgentId;
  }, [agentOrderKey]);

  // Get full model name
  const getModelName = (agent: AgentState) => {
    return agent.model || "default";
  };

  return (
    <aside
      aria-label="Agent fleet"
      className={`glass-panel fade-up-delay ui-panel ui-depth-sidepanel relative flex h-full flex-1 flex-col gap-3 bg-sidebar p-3 border-r border-sidebar-border ${className || ""}`}
      data-testid="fleet-sidebar"
    >
      {/* Header - Centered */}
      <div className="flex items-center justify-center gap-2 px-1">
        <p className="console-title type-page-title text-foreground text-center">Agents ({agents.length})</p>
      </div>

      {/* Search bar — shown when there are agents */}
      {agents.length > 0 && (
        <div className="relative px-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            aria-label="Search agents"
            className="ui-input h-8 w-full rounded-md pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Agent Grid - Responsive with larger cards */}
      <div ref={scrollContainerRef} className="ui-scroll min-h-0 flex-1 overflow-auto">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
            <EmptyStatePanel
              title="No agents yet"
              description="Create your first agent to start chatting with an AI assistant."
              compact
              className="p-3 text-xs"
            />
            <button
              type="button"
              className="ui-btn-primary flex items-center gap-2 px-4 py-2 font-mono text-[11px] font-medium tracking-[0.02em]"
              onClick={onCreateAgent}
              disabled={createDisabled || createBusy}
            >
              <Plus className="w-4 h-4" />
              {createBusy ? "Creating..." : "Create Agent"}
            </button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No agents matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {filteredAgents.map((agent) => {
              const selected = selectedAgentId === agent.agentId;
              const avatarSeed = agent.avatarSeed ?? agent.agentId;
              const modelName = getModelName(agent);
              const displayName = agent.identityName ?? agent.name;

              return (
                <button
                  key={agent.agentId}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(agent.agentId, node);
                      return;
                    }
                    rowRefs.current.delete(agent.agentId);
                  }}
                  type="button"
                  aria-label={`${displayName} — ${resolveAgentStatusLabel(agent.status)}`}
                  data-testid={`fleet-agent-row-${agent.agentId}`}
                  className={`group relative ui-card flex flex-col items-center p-4 text-center border transition-colors min-h-[240px] ${
                    selected
                      ? agent.status === "running"
                        ? "ui-card-selected ring-2 ring-green-500 bg-green-500/5"
                        : "ui-card-selected ring-2 ring-accent bg-primary/5"
                      : "hover:bg-surface-2/45"
                  }`}
                  onClick={() => onSelectAgent(agent.agentId)}
                >
                  {/* Status Dot */}
                  <span
                    aria-hidden="true"
                    className={`absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-background ${
                      agent.status === "running" ? "bg-green-500" :
                      agent.status === "error" ? "bg-red-500" :
                      agent.status === "idle" ? "bg-slate-400" :
                      "bg-amber-500"
                    }`}
                  />

                  {/* Avatar - centered, fills available space */}
                  <div className="relative mb-2 min-h-0 w-full flex-1 flex items-center justify-center">
                    <AgentAvatar
                      seed={avatarSeed}
                      name={agent.name}
                      avatarUrl={agent.avatarUrl ?? null}
                      avatarSource={agent.avatarSource}
                      defaultAvatarIndex={agent.defaultAvatarIndex ?? 0}
                      isSelected={selected}
                    />
                  </div>

                  {/* Soul Name */}
                  <p className="font-bold text-foreground text-base truncate w-full mb-0.5">
                    {displayName}
                  </p>

                  {/* Agent ID */}
                  <p className="text-muted-foreground text-xs truncate w-full mb-1.5">
                    {agent.agentId}
                  </p>

                  {/* Model badge */}
                  <div className="flex items-center justify-center gap-1.5 mt-auto w-full">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-md">
                      <Cpu className="w-3 h-3" />
                      {modelName}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${resolveAgentStatusBadgeClass(agent.status)}`}>
                      {resolveAgentStatusLabel(agent.status)}
                    </span>
                  </div>

                  {/* Approval Badge */}
                  {agent.awaitingUserInput ? (
                    <span className={`absolute bottom-3 left-3 right-3 text-[10px] ${NEEDS_APPROVAL_BADGE_CLASS} py-1 rounded-md`} data-status="approval">
                      Needs Approval
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New Agent Button - Centered, 1/3 width */}
      <div className="flex justify-center w-full mt-auto px-4">
        <button
          type="button"
          data-testid="fleet-new-agent-button"
          className="ui-btn-primary flex items-center justify-center gap-2 px-4 py-3 font-mono text-[12px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground w-1/3 min-w-[120px]"
          onClick={onCreateAgent}
          disabled={createDisabled || createBusy}
        >
          <Plus className="w-4 h-4" />
          {createBusy ? "Creating..." : "New Agent"}
        </button>
      </div>
    </aside>
  );
};
