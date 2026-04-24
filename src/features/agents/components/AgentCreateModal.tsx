// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
import { AvatarSelector, buildDefaultAvatarSelectorValue, type AvatarSelectorHandle } from "@/features/agents/components/AvatarSelector";

type AgentCreateModalProps = {
  open: boolean;
  suggestedName: string;
  busy?: boolean;
  submitError?: string | null;
  onClose: () => void;
  onSubmit: (payload: AgentCreateModalSubmitPayload) => Promise<void> | void;
};

const fieldClassName =
  "ui-input w-full rounded-md px-3 py-2 text-xs text-foreground outline-none";
const labelClassName =
  "font-mono text-[11px] font-semibold tracking-[0.05em] text-muted-foreground";

const resolveInitialName = (suggestedName: string): string => {
  const trimmed = suggestedName.trim();
  if (!trimmed) return "New Agent";
  return trimmed;
};

const AgentCreateModalContent = ({
  suggestedName,
  busy,
  submitError,
  onClose,
  onSubmit,
}: Omit<AgentCreateModalProps, "open">) => {
  const [name, setName] = useState(() => resolveInitialName(suggestedName));
  const [avatarValue, setAvatarValue] = useState(() => buildDefaultAvatarSelectorValue());
  const avatarRef = useRef<AvatarSelectorHandle | null>(null);
  const dialogRef = useRef<HTMLFormElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit || busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const avatar = avatarRef.current?.getValue() ?? avatarValue;
    void onSubmit({
      name: trimmedName,
      avatarSeed: avatar.avatarSeed,
      avatarSource: avatar.avatarSource,
      defaultAvatarIndex: avatar.defaultAvatarIndex,
      avatarUrl: avatar.avatarUrl || undefined,
    });
  };

  // Auto-focus the name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  // Focus trap — keep Tab within the dialog
  const handleFocusTrap = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create agent"
      onClick={busy ? undefined : onClose}
    >
      <form
        ref={dialogRef}
        className="ui-panel w-full max-w-2xl shadow-xs"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleFocusTrap}
        data-testid="agent-create-modal"
      >
        <div className="flex items-center justify-between border-b border-border/35 px-6 py-6">
          <div>
            <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
              New agent
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">Launch agent</div>
            <div className="mt-1 text-xs text-muted-foreground">Name it and activate immediately.</div>
          </div>
          <button
            type="button"
            className="ui-btn-ghost px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <label className={labelClassName}>
            Name
            <input
              ref={nameInputRef}
              aria-label="Agent name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`mt-1 ${fieldClassName}`}
              placeholder="My agent"
            />
          </label>
          <div className="-mt-2 text-[11px] text-muted-foreground">
            You can rename this agent from the main chat header.
          </div>
          <div className="grid justify-items-center gap-2 border-t border-border/40 pt-3">
            <div className={labelClassName}>Choose avatar</div>
            <AvatarSelector
              ref={avatarRef}
              name={name.trim() || "New Agent"}
              value={avatarValue}
              onChange={setAvatarValue}
              disabled={busy}
            />
          </div>

          {submitError ? (
            <div className="ui-alert-danger rounded-md px-3 py-2 text-xs">
              {submitError}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border/45 px-6 pb-4 pt-5">
          <div className="text-[11px] text-muted-foreground">Authority can be configured after launch.</div>
          <button
            type="submit"
            className="ui-btn-primary px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            disabled={!canSubmit || busy}
          >
            {busy ? "Launching..." : "Launch agent"}
          </button>
        </div>
      </form>
    </div>
  );
};

export const AgentCreateModal = ({
  open,
  suggestedName,
  busy = false,
  submitError = null,
  onClose,
  onSubmit,
}: AgentCreateModalProps) => {
  if (!open) return null;
  return (
    <AgentCreateModalContent
      suggestedName={suggestedName}
      busy={busy}
      submitError={submitError}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};
