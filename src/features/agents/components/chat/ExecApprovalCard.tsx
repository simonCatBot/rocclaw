// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { memo } from "react";
import type {
  ExecApprovalDecision,
  PendingExecApproval,
} from "@/features/agents/approvals/types";
import {
  ASSISTANT_GUTTER_CLASS,
  ASSISTANT_MAX_WIDTH_EXPANDED_CLASS,
} from "./chatConstants";
import { formatApprovalExpiry } from "./chatFormatters";

export const ExecApprovalCard = memo(function ExecApprovalCard({
  approval,
  onResolve,
}: {
  approval: PendingExecApproval;
  onResolve?: (id: string, decision: ExecApprovalDecision) => void;
}) {
  const disabled = approval.resolving || !onResolve;
  return (
    <div
      className={`w-full ${ASSISTANT_MAX_WIDTH_EXPANDED_CLASS} ${ASSISTANT_GUTTER_CLASS} ui-badge-approval self-start rounded-md px-3 py-2 shadow-2xs`}
      data-testid={`exec-approval-card-${approval.id}`}
    >
      <div className="type-meta">
        Exec approval required
      </div>
      <div className="mt-2 rounded-md bg-surface-3 px-2 py-1.5 shadow-2xs">
        <div className="font-mono text-[10px] font-semibold text-foreground">{approval.command}</div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div>Host: {approval.host ?? "unknown"}</div>
        <div>Expires: {formatApprovalExpiry(approval.expiresAtMs)}</div>
        {approval.cwd ? <div className="sm:col-span-2">CWD: {approval.cwd}</div> : null}
      </div>
      {approval.error ? (
        <div className="ui-alert-danger mt-2 rounded-md px-2 py-1 text-[11px] shadow-2xs">
          {approval.error}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border/70 bg-surface-3 px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "allow-once")}
          disabled={disabled}
          aria-label={`Allow once for exec approval ${approval.id}`}
        >
          Allow once
        </button>
        <button
          type="button"
          className="rounded-md border border-border/70 bg-surface-3 px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "allow-always")}
          disabled={disabled}
          aria-label={`Always allow for exec approval ${approval.id}`}
        >
          Always allow
        </button>
        <button
          type="button"
          className="ui-btn-danger rounded-md px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] transition disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "deny")}
          disabled={disabled}
          aria-label={`Deny exec approval ${approval.id}`}
        >
          Deny
        </button>
      </div>
    </div>
  );
});
