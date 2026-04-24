// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import {
  memo,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Brain, Trash2, Wrench } from "lucide-react";

const InlineHoverTooltip = ({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) => {
  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 left-1/2 z-20 w-max max-w-none -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-card px-2 py-1 font-mono text-[10px] text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {text}
      </span>
    </div>
  );
};

export const AgentChatComposer = memo(function AgentChatComposer({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  canSend,
  stopBusy,
  stopDisabledReason,
  running,
  sendDisabled,
  queuedMessages,
  onRemoveQueuedMessage,
  inputRef,
  modelOptions,
  modelValue,
  allowThinking,
  thinkingValue,
  onModelChange,
  onThinkingChange,
  toolCallingEnabled,
  showThinkingTraces,
  onToolCallingToggle,
  onThinkingTracesToggle,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  stopBusy: boolean;
  stopDisabledReason?: string | null;
  running: boolean;
  sendDisabled: boolean;
  queuedMessages: string[];
  onRemoveQueuedMessage?: (index: number) => void;
  inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  modelOptions: { value: string; label: string }[];
  modelValue: string;
  allowThinking: boolean;
  thinkingValue: string;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  toolCallingEnabled: boolean;
  showThinkingTraces: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
}) {
  const stopReason = stopDisabledReason?.trim() ?? "";
  const stopDisabled = !canSend || stopBusy || Boolean(stopReason);
  const stopAriaLabel = stopReason ? `Stop unavailable: ${stopReason}` : "Stop";
  const modelSelectedLabel = useMemo(() => {
    if (modelOptions.length === 0) return "No models found";
    return modelOptions.find((option) => option.value === modelValue)?.label ?? modelValue;
  }, [modelOptions, modelValue]);
  const modelSelectWidthCh = Math.max(11, Math.min(30, modelSelectedLabel.length + 6));
  const thinkingSelectedLabel = useMemo(() => {
    switch (thinkingValue) {
      case "off":
        return "Off";
      case "minimal":
        return "Minimal";
      case "low":
        return "Low";
      case "medium":
        return "Medium";
      case "high":
        return "High";
      case "xhigh":
        return "XHigh";
      default:
        return "Default";
    }
  }, [thinkingValue]);
  const thinkingSelectWidthCh = Math.max(9, Math.min(16, thinkingSelectedLabel.length + 6));
  return (
    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-border/65 bg-surface-2/45 px-3 py-2">
      {queuedMessages.length > 0 ? (
        <div
          className={`mb-2 grid items-start gap-2 ${
            running ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"
          }`}
        >
          <div
            className="min-w-0 max-w-full space-y-1 overflow-hidden"
            data-testid="queued-messages-bar"
            aria-label="Queued messages"
          >
            {queuedMessages.map((queuedMessage, index) => (
              <div
                key={`${index}-${queuedMessage}`}
                className="flex w-full min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-md border border-border/70 bg-card/80 px-2 py-1 text-[11px] text-foreground"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  Queued
                </span>
                <span
                  className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  title={queuedMessage}
                >
                  {queuedMessage}
                </span>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove queued message ${index + 1}`}
                  onClick={() => onRemoveQueuedMessage?.(index)}
                  disabled={!onRemoveQueuedMessage}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {running ? (
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              disabled
              className="invisible rounded-md border border-border/70 bg-surface-3 px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground"
            >
              {stopBusy ? "Stopping" : "Stop"}
            </button>
          ) : null}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            disabled
            className="ui-btn-primary ui-btn-send invisible px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em]"
          >
            Send
          </button>
        </div>
      ) : null}
      <div className="flex min-w-0 items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          className="chat-composer-input min-h-[28px] max-h-[34vh] min-w-0 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-[16px] leading-6 text-foreground outline-none shadow-none transition placeholder:text-muted-foreground/65 focus:outline-none focus-visible:outline-none focus-visible:ring-0 sm:text-[15px]"
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label="Message input"
          placeholder="type a message"
        />
        {running ? (
          <span className="inline-flex" title={stopReason || undefined}>
            <button
              className="shrink-0 rounded-md border border-border/70 bg-surface-3 px-3.5 py-2.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:px-3 sm:py-2"
              type="button"
              onClick={onStop}
              disabled={stopDisabled}
              aria-label={stopAriaLabel}
            >
              {stopBusy ? "Stopping" : "Stop"}
            </button>
          </span>
        ) : null}
        <button
          className="ui-btn-primary ui-btn-send shrink-0 px-3.5 py-2.5 font-mono text-[12px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground sm:px-3 sm:py-2"
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
          title={!canSend ? "Gateway disconnected" : undefined}
        >
          Send
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:mt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <InlineHoverTooltip text="Choose model">
            <select
              className="ui-input ui-control-important h-6 min-w-0 max-w-full rounded-md px-1.5 text-[10px] font-semibold text-foreground"
              aria-label="Model"
              value={modelValue}
              style={{ width: `${modelSelectWidthCh}ch`, maxWidth: "clamp(12ch, 58vw, 30ch)" }}
              onChange={(event) => {
                const nextValue = event.target.value.trim();
                onModelChange(nextValue ? nextValue : null);
                event.currentTarget.blur();
              }}
            >
              {modelOptions.length === 0 ? (
                <option value="">No models found</option>
              ) : null}
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </InlineHoverTooltip>
          {allowThinking ? (
            <InlineHoverTooltip text="Select reasoning effort">
              <select
                className="ui-input ui-control-important h-6 min-w-0 max-w-full rounded-md px-1.5 text-[10px] font-semibold text-foreground"
                aria-label="Thinking"
                value={thinkingValue}
                style={{ width: `${thinkingSelectWidthCh}ch`, maxWidth: "min(40vw, 16ch)" }}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();
                  onThinkingChange(nextValue ? nextValue : null);
                }}
              >
                <option value="">Default</option>
                <option value="off">Off</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
            </InlineHoverTooltip>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:ml-auto sm:w-auto sm:flex-nowrap">
          <button
            type="button"
            role="switch"
            aria-label="Show tool calls"
            aria-checked={toolCallingEnabled}
            className={`inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[10px] tracking-[0.01em] transition ${
              toolCallingEnabled
                ? "border-primary/45 bg-primary/14 text-foreground"
                : "border-border/70 bg-surface-2/40 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onToolCallingToggle(!toolCallingEnabled)}
          >
            <Wrench className="h-3 w-3" />
          </button>
          <button
            type="button"
            role="switch"
            aria-label="Show thinking"
            aria-checked={showThinkingTraces}
            className={`inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 transition ${
              showThinkingTraces
                ? "border-primary/45 bg-primary/14 text-foreground"
                : "border-border/70 bg-surface-2/40 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onThinkingTracesToggle(!showThinkingTraces)}
          >
            <Brain className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});
