// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { CreateAgentBlockState } from "@/features/agents/operations/mutationLifecycleWorkflow";

type CreateAgentBlockModalProps = {
  block: CreateAgentBlockState;
  statusLine: string | null;
};

export const CreateAgentBlockModal = ({ block, statusLine }: CreateAgentBlockModalProps) => {
  if (block.phase === "queued") return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
      data-testid="agent-create-restart-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Creating agent"
    >
      <div className="ui-panel w-full max-w-md p-6">
        <div className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
          Agent create in progress
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">{block.agentName}</div>
        <div className="mt-3 text-sm text-muted-foreground">
          ROCclaw is temporarily locked until creation finishes.
        </div>
        {statusLine ? (
          <div className="ui-card mt-4 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-foreground">
            {statusLine}
          </div>
        ) : null}
      </div>
    </div>
  );
};

type RestartingMutationBlockModalProps = {
  kind: "delete-agent" | "rename-agent" | string;
  agentName: string;
  statusLine: string | null;
};

export const RestartingMutationBlockModal = ({
  kind,
  agentName,
  statusLine,
}: RestartingMutationBlockModalProps) => {
  const isDelete = kind === "delete-agent";
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
      data-testid={isDelete ? "agent-delete-restart-modal" : "agent-rename-restart-modal"}
      role="dialog"
      aria-modal="true"
      aria-label={
        isDelete ? "Deleting agent and restarting gateway" : "Renaming agent and restarting gateway"
      }
    >
      <div className="ui-panel w-full max-w-md p-6">
        <div className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
          {isDelete ? "Agent delete in progress" : "Agent rename in progress"}
        </div>
        <div className="mt-2 text-base font-semibold text-foreground">{agentName}</div>
        <div className="mt-3 text-sm text-muted-foreground">
          ROCclaw is temporarily locked until the gateway restarts.
        </div>
        {statusLine ? (
          <div className="ui-card mt-4 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-foreground">
            {statusLine}
          </div>
        ) : null}
      </div>
    </div>
  );
};
