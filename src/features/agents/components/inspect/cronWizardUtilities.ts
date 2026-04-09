// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { Sun, Bell, CalendarDays, ListChecks } from "lucide-react";

import type { CronCreateDraft, CronCreateTemplateId } from "@/lib/cron/createPayloadBuilder";
import type { CronJobSummary } from "@/lib/cron/types";

export const formatCronStateLine = (job: CronJobSummary): string | null => {
  if (typeof job.state.runningAtMs === "number" && Number.isFinite(job.state.runningAtMs)) {
    return "Running now";
  }
  if (typeof job.state.nextRunAtMs === "number" && Number.isFinite(job.state.nextRunAtMs)) {
    return `Next: ${new Date(job.state.nextRunAtMs).toLocaleString()}`;
  }
  if (typeof job.state.lastRunAtMs === "number" && Number.isFinite(job.state.lastRunAtMs)) {
    const status = job.state.lastStatus ? `${job.state.lastStatus} ` : "";
    return `Last: ${status}${new Date(job.state.lastRunAtMs).toLocaleString()}`.trim();
  }
  return null;
};

export const getFirstLinePreview = (value: string, maxChars: number): string => {
  const firstLine =
    value
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (!firstLine) return "";
  if (firstLine.length <= maxChars) return firstLine;
  return `${firstLine.slice(0, maxChars)}...`;
};

export type CronTemplateOption = {
  id: CronCreateTemplateId;
  title: string;
  description: string;
  icon: typeof Sun;
};

export const CRON_TEMPLATE_OPTIONS: CronTemplateOption[] = [
  {
    id: "morning-brief",
    title: "Morning Brief",
    description: "Daily status summary with overnight updates.",
    icon: Sun,
  },
  {
    id: "reminder",
    title: "Reminder",
    description: "A timed nudge for a specific event or task.",
    icon: Bell,
  },
  {
    id: "weekly-review",
    title: "Weekly Review",
    description: "Recurring synthesis across a longer time window.",
    icon: CalendarDays,
  },
  {
    id: "inbox-triage",
    title: "Inbox Triage",
    description: "Regular sorting and summarizing of incoming updates.",
    icon: ListChecks,
  },
  {
    id: "custom",
    title: "Custom",
    description: "Start from a blank flow and choose each setting.",
    icon: ListChecks,
  },
];

export const TIMED_AUTOMATION_STEP_META: Array<{ title: string; indicator: string }> = [
  { title: "Choose type", indicator: "Type" },
  { title: "Define function", indicator: "Function" },
  { title: "Set timing", indicator: "Timing" },
  { title: "Review and create", indicator: "Review" },
];

export const resolveLocalTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const createInitialCronDraft = (): CronCreateDraft => ({
  templateId: "morning-brief",
  name: "",
  taskText: "",
  scheduleKind: "every",
  everyAmount: 30,
  everyUnit: "minutes",
  everyAtTime: "09:00",
  everyTimeZone: resolveLocalTimeZone(),
  deliveryMode: "none",
  deliveryChannel: "last",
});

export const applyTemplateDefaults = (templateId: CronCreateTemplateId, current: CronCreateDraft): CronCreateDraft => {
  const nextTimeZone = (current.everyTimeZone ?? "").trim() || resolveLocalTimeZone();
  const base = {
    ...createInitialCronDraft(),
    deliveryMode: current.deliveryMode ?? "none",
    deliveryChannel: current.deliveryChannel || "last",
    deliveryTo: current.deliveryTo,
    advancedSessionTarget: current.advancedSessionTarget,
    advancedWakeMode: current.advancedWakeMode,
    everyTimeZone: nextTimeZone,
  } satisfies CronCreateDraft;

  if (templateId === "morning-brief") {
    return {
      ...base,
      templateId,
      name: "Morning brief",
      taskText: "Summarize overnight updates and priorities.",
      scheduleKind: "every",
      everyAmount: 1,
      everyUnit: "days",
      everyAtTime: "07:00",
    };
  }
  if (templateId === "reminder") {
    return {
      ...base,
      templateId,
      name: "Reminder",
      taskText: "Reminder: follow up on today's priority task.",
      scheduleKind: "at",
      scheduleAt: "",
    };
  }
  if (templateId === "weekly-review") {
    return {
      ...base,
      templateId,
      name: "Weekly review",
      taskText: "Summarize wins, blockers, and next-week priorities.",
      scheduleKind: "every",
      everyAmount: 7,
      everyUnit: "days",
      everyAtTime: "09:00",
    };
  }
  if (templateId === "inbox-triage") {
    return {
      ...base,
      templateId,
      name: "Inbox triage",
      taskText: "Triage unread updates and surface the top actions.",
      scheduleKind: "every",
      everyAmount: 30,
      everyUnit: "minutes",
    };
  }
  return {
    ...base,
    templateId: "custom",
    name: "",
    taskText: "",
    scheduleKind: "every",
    everyAmount: 30,
    everyUnit: "minutes",
  };
};
