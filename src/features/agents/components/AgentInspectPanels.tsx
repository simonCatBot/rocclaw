// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Play,
  Trash2,
} from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import type { CronCreateDraft } from "@/lib/cron/createPayloadBuilder";
import { formatCronPayload, formatCronSchedule, type CronJobSummary } from "@/lib/cron/types";
import {
  resolveExecutionRoleFromAgent,
  resolvePresetDefaultsForRole,
  type AgentPermissionsDraft,
} from "@/features/agents/operations/agentPermissionsOperation";

import { AgentInspectHeader } from "./inspect/AgentInspectHeader";
import { CronCreateWizard } from "./inspect/CronCreateWizard";
import { formatCronStateLine, getFirstLinePreview } from "./inspect/cronWizardUtilities";

// Re-export AgentBrainPanel so existing imports continue to work.
export { AgentBrainPanel } from "./inspect/AgentBrainPanel";

type AgentSettingsPanelProps = {
  agent: AgentState;
  mode?: "capabilities" | "automations" | "advanced";
  showHeader?: boolean;
  onClose: () => void;
  permissionsDraft?: AgentPermissionsDraft;
  onUpdateAgentPermissions?: (draft: AgentPermissionsDraft) => Promise<void> | void;
  onDelete: () => void;
  canDelete?: boolean;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  cronRunBusyJobId: string | null;
  cronDeleteBusyJobId: string | null;
  onRunCronJob: (jobId: string) => Promise<void> | void;
  onDeleteCronJob: (jobId: string) => Promise<void> | void;
  cronCreateBusy?: boolean;
  onCreateCronJob?: (draft: CronCreateDraft) => Promise<void> | void;
  controlUiUrl?: string | null;
};

const arePermissionsDraftEqual = (a: AgentPermissionsDraft, b: AgentPermissionsDraft): boolean =>
  a.commandMode === b.commandMode &&
  a.webAccess === b.webAccess &&
  a.fileTools === b.fileTools;

export const AgentSettingsPanel = ({
  agent,
  mode = "capabilities",
  showHeader = true,
  onClose,
  permissionsDraft,
  onUpdateAgentPermissions = () => {},
  onDelete,
  canDelete = true,
  cronJobs,
  cronLoading,
  cronError,
  cronRunBusyJobId,
  cronDeleteBusyJobId,
  onRunCronJob,
  onDeleteCronJob,
  cronCreateBusy = false,
  onCreateCronJob = () => {},
  controlUiUrl = null,
}: AgentSettingsPanelProps) => {
  const initialPermissionsDraft =
    permissionsDraft ?? resolvePresetDefaultsForRole(resolveExecutionRoleFromAgent(agent));
  const [permissionsBaselineValue, setPermissionsBaselineValue] =
    useState<AgentPermissionsDraft>(initialPermissionsDraft);
  const [permissionsDraftValue, setPermissionsDraftValue] =
    useState<AgentPermissionsDraft>(initialPermissionsDraft);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsSaveState, setPermissionsSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [permissionsSaveError, setPermissionsSaveError] = useState<string | null>(null);
  const permissionsSaveTimerRef = useRef<number | null>(null);
  const permissionsDraftAgentIdRef = useRef(agent.agentId);
  const [expandedCronJobIds, setExpandedCronJobIds] = useState<Set<string>>(() => new Set());
  const [cronCreateOpen, setCronCreateOpen] = useState(false);

  const resolvedExecutionRole = useMemo(() => resolveExecutionRoleFromAgent(agent), [agent]);
  const resolvedPermissionsDraft = useMemo(
    () => permissionsDraft ?? resolvePresetDefaultsForRole(resolvedExecutionRole),
    [permissionsDraft, resolvedExecutionRole]
  );
  const permissionsDirty = useMemo(
    () => !arePermissionsDraftEqual(permissionsDraftValue, permissionsBaselineValue),
    [permissionsBaselineValue, permissionsDraftValue]
  );

  useEffect(() => {
    const agentChanged = permissionsDraftAgentIdRef.current !== agent.agentId;
    permissionsDraftAgentIdRef.current = agent.agentId;
    setPermissionsBaselineValue(resolvedPermissionsDraft);
    if (!agentChanged && (permissionsSaving || permissionsDirty)) {
      return;
    }
    setPermissionsDraftValue(resolvedPermissionsDraft);
    setPermissionsSaveState("idle");
    setPermissionsSaveError(null);
    setPermissionsSaving(false);
  }, [agent.agentId, permissionsDirty, permissionsSaving, resolvedPermissionsDraft]);

  const runPermissionsSave = useCallback(async (draft: AgentPermissionsDraft) => {
    if (permissionsSaving) return;
    setPermissionsSaving(true);
    setPermissionsSaveState("saving");
    setPermissionsSaveError(null);
    try {
      await onUpdateAgentPermissions(draft);
      setPermissionsSaveState("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save permissions.";
      setPermissionsSaveState("error");
      setPermissionsSaveError(message);
    } finally {
      setPermissionsSaving(false);
    }
  }, [onUpdateAgentPermissions, permissionsSaving]);

  useEffect(() => {
    return () => {
      if (permissionsSaveTimerRef.current !== null) {
        window.clearTimeout(permissionsSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!permissionsDirty) return;
    if (permissionsSaving) return;
    if (permissionsSaveTimerRef.current !== null) {
      window.clearTimeout(permissionsSaveTimerRef.current);
    }
    setPermissionsSaveState("idle");
    permissionsSaveTimerRef.current = window.setTimeout(() => {
      permissionsSaveTimerRef.current = null;
      void runPermissionsSave(permissionsDraftValue);
    }, 450);
    return () => {
      if (permissionsSaveTimerRef.current !== null) {
        window.clearTimeout(permissionsSaveTimerRef.current);
        permissionsSaveTimerRef.current = null;
      }
    };
  }, [permissionsDirty, permissionsDraftValue, permissionsSaving, runPermissionsSave]);

  const openCronCreate = () => {
    setCronCreateOpen(true);
  };

  const closeCronCreate = () => {
    setCronCreateOpen(false);
  };

  const panelLabel =
    mode === "advanced"
      ? "Advanced"
      : "";
  const canOpenControlUi = typeof controlUiUrl === "string" && controlUiUrl.trim().length > 0;

  return (
    <div
      className="agent-inspect-panel"
      data-testid="agent-settings-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      {showHeader ? (
        <AgentInspectHeader
          label={panelLabel}
          title={agent.name}
          onClose={onClose}
          closeTestId="agent-settings-close"
        />
      ) : null}

      <div className="flex flex-col gap-0 px-5 pb-5">
        {mode === "capabilities" ? (
          <>
            <section
              className="sidebar-section"
              data-testid="agent-settings-permissions"
            >
              <div className="mt-2 flex flex-col gap-8">
                <div className="px-1 py-1">
                  <div className="sidebar-copy flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/88">Run commands</span>
                    <div
                      className="ui-segment ui-segment-command-mode mt-2 grid-cols-3"
                      role="group"
                      aria-label="Run commands"
                    >
                      {(
                        [
                          { id: "off", label: "Off" },
                          { id: "ask", label: "Ask" },
                          { id: "auto", label: "Auto" },
                        ] as const
                      ).map((option) => {
                        const selected = permissionsDraftValue.commandMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-label={`Run commands ${option.label.toLowerCase()}`}
                            aria-pressed={selected}
                            className="ui-segment-item px-3 py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.04em]"
                            data-active={selected ? "true" : "false"}
                            onClick={() =>
                              setPermissionsDraftValue((current) => ({
                                ...current,
                                commandMode: option.id,
                              }))
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="ui-settings-row flex min-h-[68px] items-center justify-between gap-6 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-label="Web access"
                      aria-checked={permissionsDraftValue.webAccess}
                      className={`ui-switch self-center ${permissionsDraftValue.webAccess ? "ui-switch--on" : ""}`}
                      onClick={() =>
                        setPermissionsDraftValue((current) => ({
                          ...current,
                          webAccess: !current.webAccess,
                        }))
                      }
                    >
                      <span className="ui-switch-thumb" />
                    </button>
                    <div className="sidebar-copy flex flex-col">
                      <span className="text-[11px] font-medium text-foreground/88">Web access</span>
                      <span className="text-[10px] text-muted-foreground/70">
                        Allows this agent to fetch live web results.
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
                </div>
                <div className="ui-settings-row flex min-h-[68px] items-center justify-between gap-6 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-label="File tools"
                      aria-checked={permissionsDraftValue.fileTools}
                      className={`ui-switch self-center ${permissionsDraftValue.fileTools ? "ui-switch--on" : ""}`}
                      onClick={() =>
                        setPermissionsDraftValue((current) => ({
                          ...current,
                          fileTools: !current.fileTools,
                        }))
                      }
                    >
                      <span className="ui-switch-thumb" />
                    </button>
                    <div className="sidebar-copy flex flex-col">
                      <span className="text-[11px] font-medium text-foreground/88">File tools</span>
                      <span className="text-[10px] text-muted-foreground/70">
                        Lets this agent read and edit files in its workspace.
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
                </div>
                <div className="ui-settings-row flex min-h-[68px] items-center justify-between gap-6 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-label="Browser automation"
                      aria-checked="false"
                      className="ui-switch self-center"
                      disabled
                    >
                      <span className="ui-switch-thumb" />
                    </button>
                    <div className="sidebar-copy flex flex-col">
                      <span className="text-[11px] font-medium text-foreground/88">Browser automation</span>
                      <span className="text-[10px] text-muted-foreground/70">Coming soon</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
                </div>
              </div>
              <div className="sidebar-copy mt-3 text-[11px] text-muted-foreground">
                {permissionsSaveState === "saving" ? "Saving..." : null}
                {permissionsSaveState === "saved" ? "Saved." : null}
                {permissionsSaveState === "error" && permissionsSaveError ? (
                  <span>
                    Couldn&apos;t save. {permissionsSaveError}{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => {
                        void runPermissionsSave(permissionsDraftValue);
                      }}
                    >
                      Retry
                    </button>
                  </span>
                ) : null}
              </div>
              {permissionsSaveState === "error" && !permissionsSaveError ? (
                <div className="ui-alert-danger mt-3 rounded-md px-3 py-2 text-xs">
                  Couldn&apos;t save permissions.
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {mode === "automations" ? (
          <section
            className="sidebar-section"
            data-testid="agent-settings-cron"
          >
          <div className="flex items-center justify-between gap-2">
            <h3 className="sidebar-section-title">Timed automations</h3>
            {!cronLoading && !cronError && cronJobs.length > 0 ? (
              <button
                className="sidebar-btn-ghost px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={openCronCreate}
              >
                Create
              </button>
            ) : null}
          </div>
          {cronLoading ? (
            <div className="mt-3 text-[11px] text-muted-foreground">Loading timed automations...</div>
          ) : null}
          {!cronLoading && cronError ? (
            <div className="ui-alert-danger mt-3 rounded-md px-3 py-2 text-xs">
              {cronError}
            </div>
          ) : null}
          {!cronLoading && !cronError && cronJobs.length === 0 ? (
            <div className="sidebar-card mt-3 flex flex-col items-center justify-center gap-4 px-5 py-6 text-center">
              <CalendarDays
                className="h-4 w-4 text-muted-foreground/70"
                aria-hidden="true"
                data-testid="cron-empty-icon"
              />
              <div className="sidebar-copy text-[11px] text-muted-foreground/82">
                No timed automations for this agent.
              </div>
              <button
                className="sidebar-btn-primary mt-2 w-auto min-w-[116px] self-center px-4 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={openCronCreate}
              >
                Create
              </button>
            </div>
          ) : null}
          {!cronLoading && !cronError && cronJobs.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
              {cronJobs.map((job) => {
                const runBusy = cronRunBusyJobId === job.id;
                const deleteBusy = cronDeleteBusyJobId === job.id;
                const busy = runBusy || deleteBusy;
                const scheduleText = formatCronSchedule(job.schedule);
                const payloadText = formatCronPayload(job.payload).trim();
                const payloadPreview = getFirstLinePreview(payloadText, 160);
                const payloadExpandable =
                  payloadText.length > payloadPreview.length || payloadText.split("\n").length > 1;
                const expanded = expandedCronJobIds.has(job.id);
                const stateLine = formatCronStateLine(job);
                return (
                  <div key={job.id} className="group/cron ui-card flex items-start justify-between gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                          {job.name}
                        </div>
                        {!job.enabled ? (
                          <div className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-2xs">
                            Disabled
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Frequency
                        </span>
                        <div className="break-words">{scheduleText}</div>
                      </div>
                      {stateLine ? (
                        <div className="mt-1 break-words text-[11px] text-muted-foreground">
                          {stateLine}
                        </div>
                      ) : null}
                      {payloadText ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Task
                            </span>
                            {payloadExpandable ? (
                              <button
                                className="ui-btn-secondary shrink-0 min-h-0 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.06em] text-muted-foreground"
                                type="button"
                                onClick={() => {
                                  setExpandedCronJobIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(job.id)) {
                                      next.delete(job.id);
                                    } else {
                                      next.add(job.id);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {expanded ? "Less" : "More"}
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-0.5 whitespace-pre-wrap break-words" title={payloadText}>
                            {expanded ? payloadText : payloadPreview || payloadText}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition group-focus-within/cron:opacity-100 group-hover/cron:opacity-100">
                      <button
                        className="ui-btn-icon h-7 w-7 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        aria-label={`Run timed automation ${job.name} now`}
                        onClick={() => {
                          void onRunCronJob(job.id);
                        }}
                        disabled={busy}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="ui-btn-icon ui-btn-icon-danger h-7 w-7 bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        aria-label={`Delete timed automation ${job.name}`}
                        onClick={() => {
                          void onDeleteCronJob(job.id);
                        }}
                        disabled={busy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <section
            className="sidebar-section"
            data-testid="agent-settings-heartbeat-coming-soon"
          >
            <h3 className="sidebar-section-title">Heartbeats</h3>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Heartbeat automation controls are coming soon.
            </div>
          </section>
          </section>
        ) : null}

        {mode === "advanced" ? (
          <>
            <section className="sidebar-section mt-8" data-testid="agent-settings-control-ui">
              <h3 className="sidebar-section-title ui-text-danger">Danger Zone</h3>
              <div className="ui-alert-danger mt-3 rounded-md px-3 py-3 text-[11px]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    <div className="font-medium">Advanced users only.</div>
                    <div>Open the full OpenClaw Control UI outside rocCLAW.</div>
                    <div>Changes there can break agent behavior or put rocCLAW out of sync.</div>
                  </div>
                </div>
              </div>
              {canOpenControlUi ? (
                <a
                  className="sidebar-btn-primary ui-btn-danger mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-center font-mono text-[10px] font-semibold tracking-[0.06em]"
                  href={controlUiUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Full Control UI
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : (
                <>
                  <button
                    className="sidebar-btn-primary ui-btn-danger mt-3 inline-flex px-3 py-2.5 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-65"
                    type="button"
                    disabled
                  >
                    Open Full Control UI
                  </button>
                  <div className="mt-2 text-[10px] text-muted-foreground/70">
                    Control UI link unavailable for this gateway.
                  </div>
                </>
              )}
            </section>

            {canDelete ? (
              <section className="sidebar-section mt-8">
                <div className="text-[11px] text-muted-foreground/68">
                  Removes the agent from the gateway config and deletes its scheduled automations.
                </div>
                <button
                  className="sidebar-btn-ghost ui-btn-danger mt-3 inline-flex px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em]"
                  type="button"
                  onClick={onDelete}
                >
                  Delete agent
                </button>
              </section>
            ) : (
              <section className="sidebar-section mt-8">
                <h3 className="sidebar-section-title">System agent</h3>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  The main agent is reserved and cannot be deleted.
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
      {cronCreateOpen ? (
        <CronCreateWizard
          cronCreateBusy={cronCreateBusy}
          onCreateCronJob={onCreateCronJob}
          onClose={closeCronCreate}
        />
      ) : null}
    </div>
  );
};
