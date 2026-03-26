import type { AgentState, FocusFilter } from "@/features/agents/state/store";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AgentAvatar } from "./AgentAvatar";
import {
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
} from "./colorSemantics";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { Plus, Cpu } from "lucide-react";

type FleetSidebarProps = {
  agents: AgentState[];
  selectedAgentId: string | null;
  filter: FocusFilter;
  onFilterChange: (next: FocusFilter) => void;
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

  const agentOrderKey = useMemo(() => agents.map((agent) => agent.agentId).join("|"), [agents]);

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

  // Get short model name
  const getModelName = (agent: AgentState) => {
    if (!agent.model) return "default";
    const parts = agent.model.split('/');
    const name = parts[parts.length - 1];
    // Shorten common model names
    if (name.includes('kimi')) return 'kimi';
    if (name.includes('qwen')) return 'qwen';
    if (name.includes('deepseek')) return 'deepseek';
    if (name.includes('glm')) return 'glm';
    return name.length > 8 ? name.substring(0, 8) : name;
  };

  return (
    <aside
      className={`glass-panel fade-up-delay ui-panel ui-depth-sidepanel relative flex h-full flex-1 flex-col gap-3 bg-sidebar p-3 border-r border-sidebar-border ${className || ""}`}
      data-testid="fleet-sidebar"
    >
      { /* Header */ }
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="console-title type-page-title text-foreground">Agents ({agents.length})</p>
      </div>

      { /* Agent Grid - Responsive */ }
      <div ref={scrollContainerRef} className="ui-scroll min-h-0 flex-1 overflow-auto">
        {agents.length === 0 ? (
          <EmptyStatePanel title="No agents available." compact className="p-3 text-xs" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
            {agents.map((agent) => {
              const selected = selectedAgentId === agent.agentId;
              const avatarSeed = agent.avatarSeed ?? agent.agentId;
              const modelName = getModelName(agent);
              
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
                  data-testid={`fleet-agent-row-${agent.agentId}`}
                  className={`group relative ui-card flex flex-col items-center p-3 text-center border transition-colors ${
                    selected
                      ? "ui-card-selected ring-2 ring-primary"
                      : "hover:bg-surface-2/45"
                  }`}
                  onClick={() => onSelectAgent(agent.agentId)}
                >
                  { /* Status Dot */ }
                  <span
                    aria-hidden="true"
                    className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-background ${
                      agent.status === "running" ? "bg-green-500" :
                      agent.status === "error" ? "bg-red-500" :
                      agent.status === "idle" ? "bg-slate-400" :
                      "bg-amber-500"
                    }`}
                  />
                  
                  { /* Avatar - Square size */ }
                  <div className="relative mb-2">
                    <AgentAvatar
                      seed={avatarSeed}
                      name={agent.name}
                      avatarUrl={agent.avatarUrl ?? null}
                      size={64}
                      isSelected={selected}
                    />
                  </div>
                  
                  { /* Agent Name */ }
                  <p className="font-semibold text-foreground text-sm truncate w-full mb-1">
                    {agent.name}
                  </p>
                  
                  { /* Model Tag */ }
                  <div className="flex items-center justify-center gap-1.5 mt-auto w-full">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded">
                      <Cpu className="w-3 h-3" />
                      {modelName}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${resolveAgentStatusBadgeClass(agent.status)}`}>
                      {resolveAgentStatusLabel(agent.status)}
                    </span>
                  </div>
                  
                  { /* Approval Badge */ }
                  {agent.awaitingUserInput ? (
                    <span className={`absolute bottom-2 left-2 right-2 text-[9px] ${NEEDS_APPROVAL_BADGE_CLASS} py-0.5 rounded`} data-status="approval">
                      Needs Approval
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      { /* New Agent Button - Bottom */ }
      <button
        type="button"
        data-testid="fleet-new-agent-button"
        className="ui-btn-primary flex items-center justify-center gap-2 px-3 py-3 font-mono text-[12px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground mt-auto"
        onClick={onCreateAgent}
        disabled={createDisabled || createBusy}
      >
        <Plus className="w-4 h-4" />
        {createBusy ? "Creating..." : "New Agent"}
      </button>
    </aside>
  );
};
