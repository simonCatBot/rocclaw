// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import {
  AgentBrainPanel,
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import type { AgentState } from "@/features/agents/state/store";
import type { SettingsRouteTab } from "@/features/agents/operations/settingsRouteWorkflow";
import type { CronJobSummary } from "@/lib/cron/types";
import type { GatewayStatus } from "@/lib/gateway/gateway-status";
import type { AgentPermissionsDraft } from "@/features/agents/operations/agentPermissionsOperation";
import type { CronCreateDraft } from "@/lib/cron/createPayloadBuilder";

type SettingsRoutePanelProps = {
  agents: AgentState[];
  inspectAgent: AgentState | null;
  activeTab: SettingsRouteTab;
  settingsRouteAgentId: string | null;
  personalityHasUnsavedChanges: boolean;
  settingsHeaderModel: string;
  settingsHeaderThinking: string;
  gatewayStatus: GatewayStatus;
  permissionsDraft: AgentPermissionsDraft | undefined;
  canDelete: boolean;
  controlUiUrl: string | null;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  cronCreateBusy: boolean;
  cronRunBusyJobId: string | null;
  cronDeleteBusyJobId: string | null;
  onBackToChat: () => void;
  onTabChange: (tab: SettingsRouteTab) => void;
  onUnsavedChangesChange: (unsaved: boolean) => void;
  onAvatarChange: (
    agentId: string,
    value: { avatarSource: string; avatarSeed: string; defaultAvatarIndex: number; avatarUrl: string }
  ) => void;
  onUpdatePermissions: (draft: AgentPermissionsDraft) => void;
  onDelete: () => void;
  onCreateCronJob: (draft: CronCreateDraft) => void;
  onRunCronJob: (jobId: string) => void;
  onDeleteCronJob: (jobId: string) => void;
};

const TABS = [
  { id: "personality", label: "Behavior" },
  { id: "capabilities", label: "Capabilities" },
  { id: "automations", label: "Automations" },
  { id: "advanced", label: "Advanced" },
] as const;

export const SettingsRoutePanel = ({
  agents,
  inspectAgent,
  activeTab,
  settingsRouteAgentId,
  personalityHasUnsavedChanges,
  settingsHeaderModel,
  settingsHeaderThinking,
  gatewayStatus,
  permissionsDraft,
  canDelete,
  controlUiUrl,
  cronJobs,
  cronLoading,
  cronError,
  cronCreateBusy,
  cronRunBusyJobId,
  cronDeleteBusyJobId,
  onBackToChat,
  onTabChange,
  onUnsavedChangesChange,
  onAvatarChange,
  onUpdatePermissions,
  onDelete,
  onCreateCronJob,
  onRunCronJob,
  onDeleteCronJob,
}: SettingsRoutePanelProps) => (
  <div
    className="ui-panel ui-depth-workspace flex min-h-0 flex-1 overflow-hidden"
    data-testid="agent-settings-route-panel"
  >
    <aside className="w-[240px] shrink-0 border-r border-border/60">
      <div className="border-b border-border/60 px-4 py-3">
        <button
          type="button"
          className="ui-btn-secondary w-full px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em]"
          onClick={onBackToChat}
        >
          Back to chat
        </button>
      </div>
      <nav className="py-3">
        {TABS.map((entry) => {
          const active = activeTab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              className={`relative w-full px-5 py-3 text-left text-sm transition ${
                active
                  ? "bg-surface-2/55 font-medium text-foreground"
                  : "font-normal text-muted-foreground hover:bg-surface-2/35 hover:text-foreground"
              }`}
              onClick={() => onTabChange(entry.id)}
            >
              {active ? (
                <span
                  className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary"
                  aria-hidden="true"
                />
              ) : null}
              {entry.label}
            </button>
          );
        })}
      </nav>
    </aside>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
        <div>
          <div className="text-lg font-semibold text-foreground">
            {inspectAgent?.name ?? settingsRouteAgentId ?? "Agent settings"}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            Model: {settingsHeaderModel}{" "}
            <span className="mx-2 text-border">|</span>
            Thinking: {settingsHeaderThinking}
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">
          [{personalityHasUnsavedChanges ? "Unsaved" : "Saved \u2713"}]
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {inspectAgent ? (
          activeTab === "personality" ? (
            <AgentBrainPanel
              gatewayStatus={gatewayStatus}
              agents={agents}
              selectedAgentId={inspectAgent.agentId}
              onUnsavedChangesChange={onUnsavedChangesChange}
              onAvatarChange={(agentId, value) => onAvatarChange(agentId, value)}
            />
          ) : (
            <div className="h-full overflow-y-auto px-6 py-6">
              <div className="mx-auto w-full max-w-[920px]">
                <AgentSettingsPanel
                  key={`${inspectAgent.agentId}:${activeTab}`}
                  mode={
                    activeTab === "automations"
                      ? "automations"
                      : activeTab === "advanced"
                        ? "advanced"
                        : "capabilities"
                  }
                  showHeader={false}
                  agent={inspectAgent}
                  onClose={onBackToChat}
                  permissionsDraft={permissionsDraft}
                  onUpdateAgentPermissions={onUpdatePermissions}
                  onDelete={onDelete}
                  canDelete={canDelete}
                  cronJobs={cronJobs}
                  cronLoading={cronLoading}
                  cronError={cronError}
                  cronCreateBusy={cronCreateBusy}
                  cronRunBusyJobId={cronRunBusyJobId}
                  cronDeleteBusyJobId={cronDeleteBusyJobId}
                  onCreateCronJob={onCreateCronJob}
                  onRunCronJob={onRunCronJob}
                  onDeleteCronJob={onDeleteCronJob}
                  controlUiUrl={controlUiUrl}
                />
              </div>
            </div>
          )
        ) : (
          <EmptyStatePanel
            title="Agent not found."
            description="Back to chat and select an available agent."
            fillHeight
            className="items-center p-6 text-center text-sm"
          />
        )}
      </div>
    </div>
  </div>
);
