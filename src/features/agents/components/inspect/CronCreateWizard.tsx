// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useState } from "react";

import type { CronCreateDraft, CronCreateTemplateId } from "@/lib/cron/createPayloadBuilder";
import {
  CRON_TEMPLATE_OPTIONS,
  TIMED_AUTOMATION_STEP_META,
  createInitialCronDraft,
  applyTemplateDefaults,
  resolveLocalTimeZone,
} from "./cronWizardUtilities";

export type CronCreateWizardProps = {
  cronCreateBusy: boolean;
  onCreateCronJob: (draft: CronCreateDraft) => Promise<void> | void;
  onClose: () => void;
};

export const CronCreateWizard = ({
  cronCreateBusy,
  onCreateCronJob,
  onClose,
}: CronCreateWizardProps) => {
  const [cronCreateStep, setCronCreateStep] = useState(0);
  const [cronCreateError, setCronCreateError] = useState<string | null>(null);
  const [cronDraft, setCronDraft] = useState<CronCreateDraft>(createInitialCronDraft);

  const closeCronCreate = () => {
    onClose();
  };

  const updateCronDraft = (patch: Partial<CronCreateDraft>) => {
    setCronDraft((prev) => ({ ...prev, ...patch }));
  };

  const selectCronTemplate = (templateId: CronCreateTemplateId) => {
    setCronDraft((prev) => applyTemplateDefaults(templateId, prev));
  };

  const canMoveToScheduleStep = cronDraft.name.trim().length > 0 && cronDraft.taskText.trim().length > 0;
  const canMoveToReviewStep =
    cronDraft.scheduleKind === "every"
      ? Number.isFinite(cronDraft.everyAmount) &&
        (cronDraft.everyAmount ?? 0) > 0 &&
        (cronDraft.everyUnit !== "days" ||
          ((cronDraft.everyAtTime ?? "").trim().length > 0 &&
            (cronDraft.everyTimeZone ?? "").trim().length > 0))
      : (cronDraft.scheduleAt ?? "").trim().length > 0;
  const canSubmitCronCreate = canMoveToScheduleStep && canMoveToReviewStep;

  const submitCronCreate = async () => {
    if (cronCreateBusy || !canSubmitCronCreate) {
      return;
    }
    setCronCreateError(null);
    const payload: CronCreateDraft = {
      templateId: cronDraft.templateId,
      name: cronDraft.name.trim(),
      taskText: cronDraft.taskText.trim(),
      scheduleKind: cronDraft.scheduleKind,
      ...(typeof cronDraft.everyAmount === "number" ? { everyAmount: cronDraft.everyAmount } : {}),
      ...(cronDraft.everyUnit ? { everyUnit: cronDraft.everyUnit } : {}),
      ...(cronDraft.everyUnit === "days" && cronDraft.everyAtTime
        ? { everyAtTime: cronDraft.everyAtTime }
        : {}),
      ...(cronDraft.everyUnit === "days" && cronDraft.everyTimeZone
        ? { everyTimeZone: cronDraft.everyTimeZone }
        : {}),
      ...(cronDraft.scheduleAt ? { scheduleAt: cronDraft.scheduleAt } : {}),
      ...(cronDraft.deliveryMode ? { deliveryMode: cronDraft.deliveryMode } : {}),
      ...(cronDraft.deliveryChannel ? { deliveryChannel: cronDraft.deliveryChannel } : {}),
      ...(cronDraft.deliveryTo ? { deliveryTo: cronDraft.deliveryTo } : {}),
      ...(cronDraft.advancedSessionTarget
        ? { advancedSessionTarget: cronDraft.advancedSessionTarget }
        : {}),
      ...(cronDraft.advancedWakeMode ? { advancedWakeMode: cronDraft.advancedWakeMode } : {}),
    };
    try {
      await onCreateCronJob(payload);
      closeCronCreate();
    } catch (err) {
      setCronCreateError(err instanceof Error ? err.message : "Failed to create automation.");
    }
  };

  const moveCronCreateBack = () => {
    setCronCreateStep((prev) => Math.max(0, prev - 1));
  };

  const moveCronCreateNext = () => {
    if (cronCreateStep === 0) {
      setCronCreateStep(1);
      return;
    }
    if (cronCreateStep === 1 && canMoveToScheduleStep) {
      setCronCreateStep(2);
      return;
    }
    if (cronCreateStep === 2 && canMoveToReviewStep) {
      setCronCreateStep(3);
    }
  };

  const timedAutomationStepMeta =
    TIMED_AUTOMATION_STEP_META[cronCreateStep] ??
    TIMED_AUTOMATION_STEP_META[TIMED_AUTOMATION_STEP_META.length - 1];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create automation"
      onClick={closeCronCreate}
    >
      <div
        className="ui-panel w-full max-w-2xl bg-card shadow-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-[0.01em] text-muted-foreground/80">
              Timed automation composer
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">{timedAutomationStepMeta.title}</div>
          </div>
          <button
            type="button"
            className="sidebar-btn-ghost px-3 font-mono text-[10px] font-semibold tracking-[0.06em]"
            onClick={closeCronCreate}
          >
            Close
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          {cronCreateError ? (
            <div className="ui-alert-danger rounded-md px-3 py-2 text-xs">
              {cronCreateError}
            </div>
          ) : null}
          {cronCreateStep === 0 ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Pick a template to start quickly, or choose Custom.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {CRON_TEMPLATE_OPTIONS.map((option) => {
                  const active = option.id === cronDraft.templateId;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={option.title}
                      className={`ui-card px-3 py-3 text-left transition ${
                        active
                          ? "ui-selected"
                          : "bg-surface-2/60 hover:bg-surface-3/90"
                      }`}
                      onClick={() => selectCronTemplate(option.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-foreground" />
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                          {option.title}
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {cronCreateStep === 1 ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Name this automation and describe what it should do.
              </div>
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                  Automation name
                </span>
                <input
                  aria-label="Automation name"
                  className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                  value={cronDraft.name}
                  onChange={(event) => updateCronDraft({ name: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                  Task
                </span>
                <textarea
                  aria-label="Task"
                  className="min-h-28 rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-foreground outline-none"
                  value={cronDraft.taskText}
                  onChange={(event) => updateCronDraft({ taskText: event.target.value })}
                />
              </label>
            </div>
          ) : null}
          {cronCreateStep === 2 ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Choose when this should run.</div>
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                  Schedule type
                </span>
                <select
                  className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                  value={cronDraft.scheduleKind}
                  onChange={(event) =>
                    updateCronDraft({ scheduleKind: event.target.value as CronCreateDraft["scheduleKind"] })
                  }
                >
                  <option value="every">Every</option>
                  <option value="at">One time</option>
                </select>
              </label>
              {cronDraft.scheduleKind === "every" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Every
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                      value={String(cronDraft.everyAmount ?? 30)}
                      onChange={(event) =>
                        updateCronDraft({
                          everyAmount: Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Unit
                    </span>
                    <select
                      className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                      value={cronDraft.everyUnit ?? "minutes"}
                      onChange={(event) =>
                        updateCronDraft({
                          everyUnit: event.target.value as CronCreateDraft["everyUnit"],
                        })
                      }
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </label>
                  {cronDraft.everyUnit === "days" ? (
                    <>
                      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                          Time of day
                        </span>
                        <input
                          type="time"
                          className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                          value={cronDraft.everyAtTime ?? "09:00"}
                          onChange={(event) => updateCronDraft({ everyAtTime: event.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                          Timezone
                        </span>
                        <input
                          className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                          value={cronDraft.everyTimeZone ?? resolveLocalTimeZone()}
                          onChange={(event) => updateCronDraft({ everyTimeZone: event.target.value })}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
              {cronDraft.scheduleKind === "at" ? (
                <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Run at
                  </span>
                  <input
                    type="datetime-local"
                    className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                    value={cronDraft.scheduleAt ?? ""}
                    onChange={(event) => updateCronDraft({ scheduleAt: event.target.value })}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {cronCreateStep === 3 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>Review details before creating this automation.</div>
              <div className="ui-card px-3 py-2">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  {cronDraft.name || "Untitled automation"}
                </div>
                <div className="mt-1 text-[11px]">{cronDraft.taskText || "No task provided."}</div>
                <div className="mt-2 text-[11px]">
                  Schedule:{" "}
                  {cronDraft.scheduleKind === "every"
                    ? `Every ${cronDraft.everyAmount ?? 0} ${cronDraft.everyUnit ?? "minutes"}${
                        cronDraft.everyUnit === "days"
                          ? ` at ${cronDraft.everyAtTime ?? ""} (${cronDraft.everyTimeZone ?? resolveLocalTimeZone()})`
                          : ""
                      }`
                    : `At ${cronDraft.scheduleAt ?? ""}`}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-5 pb-4 pt-5">
          <div className="text-[11px] text-muted-foreground">
            {timedAutomationStepMeta.indicator} · Step {cronCreateStep + 1} of 4
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="sidebar-btn-ghost px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={moveCronCreateBack}
              disabled={cronCreateStep === 0 || cronCreateBusy}
            >
              Back
            </button>
            {cronCreateStep < 3 ? (
              <button
                type="button"
                className="sidebar-btn-ghost px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={moveCronCreateNext}
                disabled={
                  cronCreateBusy ||
                  (cronCreateStep === 1 && !canMoveToScheduleStep) ||
                  (cronCreateStep === 2 && !canMoveToReviewStep)
                }
              >
                Next
              </button>
            ) : null}
            {cronCreateStep === 3 ? (
              <button
                type="button"
                className="sidebar-btn-primary px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                onClick={() => {
                  void submitCronCreate();
                }}
                disabled={cronCreateBusy || !canSubmitCronCreate}
              >
                Create automation
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
