// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import { Check, Cog, Maximize2, Pencil, Shuffle, X } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { normalizeAssistantDisplayText } from "@/lib/text/assistantText";
import { AgentAvatar } from "./AgentAvatar";
import type {
  ExecApprovalDecision,
  PendingExecApproval,
} from "@/features/agents/approvals/types";
import {
  buildAgentChatRenderBlocks,
  buildFinalAgentChatItems,
  DEFAULT_SEMANTIC_RENDER_TURN_LIMIT,
} from "./chatItems";
import {
  boundTranscriptEntriesBySemanticTurns,
  buildOutputLinesFromTranscriptEntries,
  buildTranscriptEntriesFromLines,
  logTranscriptDebugMetric,
} from "@/features/agents/state/transcript";
import {
  buildChatFirstPaintCycleKey,
  resolveChatFirstPaint,
} from "@/features/agents/operations/chatFirstPaintWorkflow";
import { resolveEmptyChatIntroMessage } from "./chat/chatFormatters";
import { AgentChatTranscript } from "./chat/AgentChatTranscript";
import { AgentChatComposer } from "./chat/AgentChatComposer";

type AgentChatPanelProps = {
  agent: AgentRecord;
  isSelected: boolean;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  stopDisabledReason?: string | null;
  onLoadMoreHistory: () => void;
  onOpenSettings: () => void;
  onRename?: (name: string) => Promise<boolean>;
  onNewSession?: () => Promise<void> | void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onToolCallingToggle?: (enabled: boolean) => void;
  onThinkingTracesToggle?: (enabled: boolean) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onRemoveQueuedMessage?: (index: number) => void;
  onStopRun: () => void;
  onAvatarShuffle: () => void;
  pendingExecApprovals?: PendingExecApproval[];
  onResolveExecApproval?: (id: string, decision: ExecApprovalDecision) => void;
};

const noopToggle = () => {};

export const AgentChatPanel = ({
  agent,
  isSelected,
  canSend,
  models,
  stopBusy,
  stopDisabledReason = null,
  onLoadMoreHistory,
  onOpenSettings,
  onRename,
  onNewSession,
  onModelChange,
  onThinkingChange,
  onToolCallingToggle = noopToggle,
  onThinkingTracesToggle = noopToggle,
  onDraftChange,
  onSend,
  onRemoveQueuedMessage,
  onStopRun,
  onAvatarShuffle,
  pendingExecApprovals = [],
  onResolveExecApproval,
}: AgentChatPanelProps) => {
  const [draftValue, setDraftValue] = useState(agent.draft);
  const [newSessionBusy, setNewSessionBusy] = useState(false);
  const [renameEditing, setRenameEditing] = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameDraft, setRenameDraft] = useState(agent.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameEditorRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottomNextOutputRef = useRef(false);
  const plainDraftRef = useRef(agent.draft);
  const draftIdentityRef = useRef<{ agentId: string; sessionKey: string }>({
    agentId: agent.agentId,
    sessionKey: agent.sessionKey,
  });
  const firstPaintCycleRef = useRef<{
    cycleKey: string;
    startedAtMs: number;
  }>({
    cycleKey: buildChatFirstPaintCycleKey({
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      sessionEpoch: agent.sessionEpoch,
    }),
    startedAtMs: Date.now(),
  });
  const firstPaintLoggedCycleKeyRef = useRef<string | null>(null);
  const pendingResizeFrameRef = useRef<number | null>(null);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  const handleDraftRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    draftRef.current = el instanceof HTMLTextAreaElement ? el : null;
  }, []);

  useEffect(() => {
    const previousIdentity = draftIdentityRef.current;
    const identityChanged =
      previousIdentity.agentId !== agent.agentId ||
      previousIdentity.sessionKey !== agent.sessionKey;
    if (identityChanged) {
      draftIdentityRef.current = {
        agentId: agent.agentId,
        sessionKey: agent.sessionKey,
      };
      plainDraftRef.current = agent.draft;
      setDraftValue(agent.draft);
      return;
    }
    if (agent.draft === plainDraftRef.current) return;
    if (agent.draft.length !== 0) return;
    plainDraftRef.current = "";
    setDraftValue("");
  }, [agent.agentId, agent.draft, agent.sessionKey]);

  useEffect(() => {
    firstPaintCycleRef.current = {
      cycleKey: buildChatFirstPaintCycleKey({
        agentId: agent.agentId,
        sessionKey: agent.sessionKey,
        sessionEpoch: agent.sessionEpoch,
      }),
      startedAtMs: Date.now(),
    };
    firstPaintLoggedCycleKeyRef.current = null;
  }, [agent.agentId, agent.sessionEpoch, agent.sessionKey]);

  useEffect(() => {
    setRenameEditing(false);
    setRenameSaving(false);
    setRenameError(null);
    setRenameDraft(agent.name);
  }, [agent.agentId, agent.name]);

  useEffect(() => {
    setTranscriptModalOpen(false);
  }, [agent.agentId, agent.sessionKey]);

  useEffect(() => {
    if (!renameEditing) return;
    const frameId = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [renameEditing]);

  useEffect(() => {
    if (pendingResizeFrameRef.current !== null) {
      cancelAnimationFrame(pendingResizeFrameRef.current);
    }
    pendingResizeFrameRef.current = requestAnimationFrame(() => {
      pendingResizeFrameRef.current = null;
      resizeDraft();
    });
    return () => {
      if (pendingResizeFrameRef.current !== null) {
        cancelAnimationFrame(pendingResizeFrameRef.current);
        pendingResizeFrameRef.current = null;
      }
    };
  }, [resizeDraft, draftValue]);

  const handleSend = useCallback(
    (message: string) => {
      if (!canSend) return;
      const trimmed = message.trim();
      if (!trimmed) return;
      plainDraftRef.current = "";
      setDraftValue("");
      onDraftChange("");
      scrollToBottomNextOutputRef.current = true;
      onSend(trimmed);
    },
    [canSend, onDraftChange, onSend]
  );

  const visibleTranscriptEntries = useMemo(
    () => {
      const transcriptEntries =
        agent.transcriptEntries ??
        buildTranscriptEntriesFromLines({
          lines: agent.outputLines,
          sessionKey: agent.sessionKey,
          source: "legacy",
          startSequence: 0,
          confirmed: true,
        });
      return boundTranscriptEntriesBySemanticTurns({
        entries: transcriptEntries,
        turnLimit: agent.historyVisibleTurnLimit ?? DEFAULT_SEMANTIC_RENDER_TURN_LIMIT,
      });
    },
    [agent.historyVisibleTurnLimit, agent.outputLines, agent.sessionKey, agent.transcriptEntries]
  );
  const visibleOutputLines = useMemo(
    () => buildOutputLinesFromTranscriptEntries(visibleTranscriptEntries),
    [visibleTranscriptEntries]
  );
  const chatItems = useMemo(
    () =>
      buildFinalAgentChatItems({
        outputLines: visibleOutputLines,
        showThinkingTraces: agent.showThinkingTraces,
        toolCallingEnabled: agent.toolCallingEnabled,
      }),
    [agent.showThinkingTraces, agent.toolCallingEnabled, visibleOutputLines]
  );
  useEffect(() => {
    const cycle = firstPaintCycleRef.current;
    const resolution = resolveChatFirstPaint({
      transcriptItemCount: chatItems.length,
      lastUserMessage: agent.lastUserMessage,
      latestPreview: agent.latestPreview,
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      sessionEpoch: agent.sessionEpoch,
      focusStartedAtMs: cycle.startedAtMs,
    });
    if (resolution.source === "none") return;
    if (resolution.cycleKey !== cycle.cycleKey) return;
    if (firstPaintLoggedCycleKeyRef.current === resolution.cycleKey) return;

    firstPaintLoggedCycleKeyRef.current = resolution.cycleKey;
    logTranscriptDebugMetric("chat_first_content", {
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      sessionEpoch: agent.sessionEpoch ?? 0,
      source: resolution.source,
      elapsedMs: resolution.elapsedMs,
      transcriptItemCount: chatItems.length,
      hasLastUserMessage: resolution.hasLastUserMessage,
      hasLatestPreview: resolution.hasLatestPreview,
    });
  }, [
    agent.agentId,
    agent.lastUserMessage,
    agent.latestPreview,
    agent.sessionEpoch,
    agent.sessionKey,
    chatItems.length,
  ]);
  const running = agent.status === "running";
  const renderBlocks = useMemo(
    () => buildAgentChatRenderBlocks(chatItems),
    [chatItems]
  );
  const hasActiveStreamingTailInTranscript =
    running && renderBlocks.length > 0 && !renderBlocks[renderBlocks.length - 1].text;
  const liveAssistantText =
    running && agent.streamText ? normalizeAssistantDisplayText(agent.streamText) : "";
  const liveThinkingText =
    running && agent.showThinkingTraces && agent.thinkingTrace ? agent.thinkingTrace.trim() : "";
  const hasVisibleLiveThinking = Boolean(liveThinkingText.trim());
  const showTypingIndicator =
    running &&
    !hasVisibleLiveThinking &&
    !liveAssistantText &&
    !hasActiveStreamingTailInTranscript;

  const modelOptions = useMemo(
    () =>
      models.map((entry) => {
        const key = `${entry.provider}/${entry.id}`;
        const alias = typeof entry.name === "string" ? entry.name.trim() : "";
        return {
          value: key,
          label: !alias || alias === key ? key : alias,
          reasoning: entry.reasoning,
        };
      }),
    [models]
  );
  const modelValue = agent.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find((option) => option.value === modelValue);
  const allowThinking = selectedModel?.reasoning !== false;

  const avatarSeed = agent.avatarSeed ?? agent.agentId;
  const scrollToBottomOnOpenKey = `${agent.agentId}:${agent.sessionKey}:${agent.sessionEpoch ?? 0}`;
  const emptyStateTitle = useMemo(
    () => resolveEmptyChatIntroMessage(agent.agentId, agent.sessionEpoch),
    [agent.agentId, agent.sessionEpoch]
  );
  const sendDisabled = !canSend || !draftValue.trim();

  const handleComposerChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      plainDraftRef.current = value;
      setDraftValue(value);
      onDraftChange(value);
    },
    [onDraftChange]
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      handleSend(draftValue);
    },
    [draftValue, handleSend]
  );

  const handleComposerSend = useCallback(() => {
    handleSend(draftValue);
  }, [draftValue, handleSend]);

  const beginRename = useCallback(() => {
    if (!onRename) return;
    setRenameEditing(true);
    setRenameDraft(agent.name);
    setRenameError(null);
  }, [agent.name, onRename]);

  const cancelRename = useCallback(() => {
    if (renameSaving) return;
    setRenameEditing(false);
    setRenameDraft(agent.name);
    setRenameError(null);
  }, [agent.name, renameSaving]);

  useEffect(() => {
    if (!renameEditing) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (renameEditorRef.current?.contains(target)) return;
      cancelRename();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [cancelRename, renameEditing]);

  const submitRename = useCallback(async () => {
    if (!onRename || renameSaving) return;
    const nextName = renameDraft.trim();
    const currentName = agent.name.trim();
    if (!nextName) {
      setRenameError("Agent name is required.");
      return;
    }
    if (nextName === currentName) {
      setRenameEditing(false);
      setRenameError(null);
      setRenameDraft(agent.name);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const ok = await onRename(nextName);
      if (!ok) {
        setRenameError("Failed to rename agent.");
        return;
      }
      setRenameEditing(false);
      setRenameDraft(nextName);
    } finally {
      setRenameSaving(false);
    }
  }, [agent.name, onRename, renameDraft, renameSaving]);

  const handleRenameInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submitRename();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, submitRename]
  );

  const handleNewSession = useCallback(async () => {
    if (!onNewSession || newSessionBusy || !canSend) return;
    setNewSessionBusy(true);
    try {
      await onNewSession();
    } finally {
      setNewSessionBusy(false);
    }
  }, [canSend, newSessionBusy, onNewSession]);

  const newSessionDisabled = newSessionBusy || !canSend || !onNewSession;

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="px-3 pt-2 sm:px-4 sm:pt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="group/avatar relative">
              <AgentAvatar
                seed={avatarSeed}
                name={agent.name}
                avatarUrl={agent.avatarUrl ?? null}
                size={84}
                isSelected={isSelected}
              />
              <button
                className="nodrag ui-btn-icon ui-btn-icon-xs agent-avatar-shuffle-btn absolute bottom-0.5 right-0.5"
                type="button"
                aria-label="Shuffle avatar"
                data-testid="agent-avatar-shuffle"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAvatarShuffle();
                }}
              >
                <Shuffle className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 w-[clamp(8.5rem,42vw,16rem)] sm:w-[clamp(11rem,34vw,16rem)]">
                  {renameEditing ? (
                    <div ref={renameEditorRef} className="flex h-8 items-center gap-1.5">
                      <input
                        ref={renameInputRef}
                        className="ui-input agent-rename-input h-8 min-w-0 flex-1 rounded-md px-2 text-[12px] font-semibold text-foreground"
                        aria-label="Edit agent name"
                        data-testid="agent-rename-input"
                        value={renameDraft}
                        disabled={renameSaving}
                        onChange={(event) => {
                          setRenameDraft(event.target.value);
                          if (renameError) setRenameError(null);
                        }}
                        onKeyDown={handleRenameInputKeyDown}
                      />
                      <button
                        className="ui-btn-icon ui-btn-icon-sm agent-rename-control"
                        type="button"
                        aria-label="Save agent name"
                        data-testid="agent-rename-save"
                        onClick={() => {
                          void submitRename();
                        }}
                        disabled={renameSaving}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="ui-btn-icon ui-btn-icon-sm agent-rename-control"
                        type="button"
                        aria-label="Cancel agent rename"
                        data-testid="agent-rename-cancel"
                        onClick={cancelRename}
                        disabled={renameSaving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-8 min-w-0 items-center gap-1.5">
                      <div className="type-agent-name min-w-0 truncate text-foreground">
                        {agent.name}
                      </div>
                      {onRename ? (
                        <button
                          className="ui-btn-icon ui-btn-icon-xs agent-rename-control shrink-0"
                          type="button"
                          aria-label="Rename agent"
                          data-testid="agent-rename-toggle"
                          onClick={beginRename}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              {renameError ? (
                <div className="ui-text-danger mt-1 text-[11px]">{renameError}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-0.5 flex w-full items-center justify-end gap-2 sm:w-auto">
            <button
              className="nodrag ui-btn-icon !inline-flex md:!hidden"
              type="button"
              aria-label="Expand transcript"
              title="Expand transcript"
              onClick={() => setTranscriptModalOpen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              className="nodrag ui-btn-primary px-2.5 py-1.5 font-mono text-[11px] font-medium tracking-[0.02em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
              type="button"
              data-testid="agent-new-session-toggle"
              aria-label="Start new session"
              title="Start new session"
              onClick={() => {
                void handleNewSession();
              }}
              disabled={newSessionDisabled}
            >
              {newSessionBusy ? "Starting..." : "New session"}
            </button>
            <button
              className="nodrag ui-btn-icon"
              type="button"
              data-testid="agent-settings-toggle"
              aria-label="Open behavior"
              title="Behavior"
              onClick={onOpenSettings}
            >
              <Cog className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
        <div className="relative h-0 min-h-0 flex-1 overflow-hidden">
          <AgentChatTranscript
            agentId={agent.agentId}
            name={agent.name}
            avatarSeed={avatarSeed}
            avatarUrl={agent.avatarUrl ?? null}
            status={agent.status}
            historyMaybeTruncated={agent.historyMaybeTruncated}
            historyGatewayCapReached={agent.historyGatewayCapReached ?? false}
            historyFetchedCount={agent.historyFetchedCount}
            historyVisibleTurnLimit={agent.historyVisibleTurnLimit ?? null}
            onLoadMoreHistory={onLoadMoreHistory}
            renderBlocks={renderBlocks}
            liveThinkingText={liveThinkingText}
            liveAssistantText={liveAssistantText}
            showTypingIndicator={showTypingIndicator}
            outputLineCount={visibleOutputLines.length}
            liveAssistantCharCount={liveAssistantText.length}
            liveThinkingCharCount={liveThinkingText.length}
            runStartedAt={agent.runStartedAt}
            scrollToBottomOnOpenKey={scrollToBottomOnOpenKey}
            scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
            pendingExecApprovals={pendingExecApprovals}
            onResolveExecApproval={onResolveExecApproval}
            emptyStateTitle={emptyStateTitle}
            lastUserMessage={agent.lastUserMessage}
            latestPreview={agent.latestPreview}
            previewItems={agent.previewItems}
          />
        </div>

        {/* Connection / error status banners */}
        {!canSend && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Gateway disconnected — reconnecting...
            </span>
          </div>
        )}
        {canSend && agent.status === "error" && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span className="text-xs text-red-700 dark:text-red-400">
              Agent encountered an error. You can send a new message to continue.
            </span>
          </div>
        )}

        <div className="relative z-20 mt-3">
          <AgentChatComposer
            value={draftValue}
            inputRef={handleDraftRef}
            onChange={handleComposerChange}
            onKeyDown={handleComposerKeyDown}
            onSend={handleComposerSend}
            onStop={onStopRun}
            canSend={canSend}
            stopBusy={stopBusy}
            stopDisabledReason={stopDisabledReason}
            running={running}
            sendDisabled={sendDisabled}
            queuedMessages={agent.queuedMessages ?? []}
            onRemoveQueuedMessage={onRemoveQueuedMessage}
            modelOptions={modelOptionsWithFallback.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            modelValue={modelValue}
            allowThinking={allowThinking}
            thinkingValue={agent.thinkingLevel ?? ""}
            onModelChange={onModelChange}
            onThinkingChange={onThinkingChange}
            toolCallingEnabled={agent.toolCallingEnabled}
            showThinkingTraces={agent.showThinkingTraces}
            onToolCallingToggle={onToolCallingToggle}
            onThinkingTracesToggle={onThinkingTracesToggle}
          />
        </div>
      </div>

      {transcriptModalOpen ? (
        <div className="fixed inset-0 z-[130] flex min-h-0 flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="truncate text-sm font-medium text-foreground">{agent.name} · Transcript</div>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-xs"
              onClick={() => setTranscriptModalOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="h-0 min-h-0 flex-1 overflow-hidden px-2 pb-2">
            <AgentChatTranscript
              agentId={agent.agentId}
              name={agent.name}
              avatarSeed={avatarSeed}
              avatarUrl={agent.avatarUrl ?? null}
              status={agent.status}
              historyMaybeTruncated={false}
              historyGatewayCapReached={false}
              historyFetchedCount={null}
              historyVisibleTurnLimit={null}
              onLoadMoreHistory={() => {}}
              renderBlocks={renderBlocks}
              liveThinkingText={liveThinkingText}
              liveAssistantText={liveAssistantText}
              showTypingIndicator={showTypingIndicator}
              outputLineCount={visibleOutputLines.length}
              liveAssistantCharCount={liveAssistantText.length}
              liveThinkingCharCount={liveThinkingText.length}
              runStartedAt={agent.runStartedAt}
              scrollToBottomOnOpenKey={`${scrollToBottomOnOpenKey}:modal`}
              scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
              pendingExecApprovals={[]}
              emptyStateTitle={emptyStateTitle}
              lastUserMessage={agent.lastUserMessage}
              latestPreview={agent.latestPreview}
              previewItems={agent.previewItems}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
