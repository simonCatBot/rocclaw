// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import { isNearBottom } from "@/lib/dom";
import type {
  ExecApprovalDecision,
  PendingExecApproval,
} from "@/features/agents/approvals/types";
import type { AgentChatRenderBlock } from "../chatItems";
import {
  SPINE_LEFT,
  CHAT_TOP_THRESHOLD_PX,
} from "./chatConstants";
import { ExecApprovalCard } from "./ExecApprovalCard";
import { UserMessageCard } from "./UserMessageCard";
import { AssistantMessageCard } from "./AssistantMessageCard";
import { AssistantIntroCard } from "./AssistantIntroCard";
import { AgentChatFinalItems } from "./AgentChatFinalItems";

export const AgentChatTranscript = memo(function AgentChatTranscript({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  status,
  historyMaybeTruncated,
  historyGatewayCapReached,
  historyFetchedCount,
  historyVisibleTurnLimit,
  onLoadMoreHistory,
  renderBlocks,
  liveThinkingText,
  liveAssistantText,
  showTypingIndicator,
  outputLineCount,
  liveAssistantCharCount,
  liveThinkingCharCount,
  runStartedAt,
  scrollToBottomOnOpenKey,
  scrollToBottomNextOutputRef,
  pendingExecApprovals,
  onResolveExecApproval,
  emptyStateTitle,
  lastUserMessage,
  latestPreview,
  previewItems,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  status: AgentRecord["status"];
  historyMaybeTruncated: boolean;
  historyGatewayCapReached: boolean;
  historyFetchedCount: number | null;
  historyVisibleTurnLimit: number | null;
  onLoadMoreHistory: () => void;
  renderBlocks: AgentChatRenderBlock[];
  liveThinkingText: string;
  liveAssistantText: string;
  showTypingIndicator: boolean;
  outputLineCount: number;
  liveAssistantCharCount: number;
  liveThinkingCharCount: number;
  runStartedAt: number | null;
  scrollToBottomOnOpenKey: string;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
  pendingExecApprovals: PendingExecApproval[];
  onResolveExecApproval?: (id: string, decision: ExecApprovalDecision) => void;
  emptyStateTitle: string;
  lastUserMessage: string | null;
  latestPreview: string | null;
  previewItems?: Array<{
    role: "user" | "assistant";
    text: string;
    timestamp?: number | string;
  }>;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const scrollChatToBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const setPinned = useCallback((nextPinned: boolean) => {
    if (pinnedRef.current === nextPinned) return;
    pinnedRef.current = nextPinned;
    setIsPinned(nextPinned);
  }, []);

  const updatePinnedFromScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const nextAtTop = el.scrollTop <= CHAT_TOP_THRESHOLD_PX;
    setIsAtTop((current) => (current === nextAtTop ? current : nextAtTop));
    setPinned(
      isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        48
      )
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollChatToBottom();
    });
  }, [scrollChatToBottom]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned(true);
    scheduleScrollToBottom();
  }, [scheduleScrollToBottom, scrollToBottomOnOpenKey, setPinned]);

  useEffect(() => {
    updatePinnedFromScroll();
  }, [updatePinnedFromScroll]);

  const showJumpToLatest =
    !isPinned && (outputLineCount > 0 || liveAssistantCharCount > 0 || liveThinkingCharCount > 0);

  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      scheduleScrollToBottom();
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
      return;
    }
  }, [
    liveAssistantCharCount,
    liveThinkingCharCount,
    outputLineCount,
    pendingExecApprovals.length,
    scheduleScrollToBottom,
    scrollToBottomNextOutputRef,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  const showLiveAssistantCard =
    status === "running" && Boolean(liveThinkingText || liveAssistantText || showTypingIndicator);
  const hasApprovals = pendingExecApprovals.length > 0;
  const hasTranscriptItems = renderBlocks.length > 0;
  const visibleTurnCount =
    typeof historyVisibleTurnLimit === "number" && Number.isFinite(historyVisibleTurnLimit)
      ? historyVisibleTurnLimit
      : historyFetchedCount;
  const hasHiddenFetchedHistory =
    typeof historyFetchedCount === "number" &&
    Number.isFinite(historyFetchedCount) &&
    typeof visibleTurnCount === "number" &&
    Number.isFinite(visibleTurnCount) &&
    historyFetchedCount > visibleTurnCount;
  const showLoadMoreBanner = (historyMaybeTruncated || hasHiddenFetchedHistory) && isAtTop;
  const provisionalConversationItems = (() => {
    const normalizedPreviewItems = (previewItems ?? [])
      .map((item) => ({
        role: item.role,
        text: item.text.trim(),
        timestampMs:
          typeof item.timestamp === "number"
            ? item.timestamp
            : typeof item.timestamp === "string"
              ? Date.parse(item.timestamp)
              : Number.NaN,
      }))
      .filter((item) => item.text.length > 0)
      .map((item) => ({
        role: item.role,
        text: item.text,
        ...(Number.isFinite(item.timestampMs) ? { timestampMs: item.timestampMs } : {}),
      }));
    if (normalizedPreviewItems.length > 0) {
      return normalizedPreviewItems;
    }
    const fallbackItems: Array<{ role: "user" | "assistant"; text: string; timestampMs?: number }> = [];
    const provisionalUserMessage = lastUserMessage?.trim() ?? "";
    const provisionalAssistantPreview = latestPreview?.trim() ?? "";
    if (provisionalUserMessage.length > 0) {
      fallbackItems.push({ role: "user", text: provisionalUserMessage });
    }
    if (provisionalAssistantPreview.length > 0) {
      fallbackItems.push({ role: "assistant", text: provisionalAssistantPreview });
    }
    return fallbackItems;
  })();
  const hasProvisionalContent = provisionalConversationItems.length > 0;
  const hasRenderableContent = hasTranscriptItems || hasProvisionalContent || hasApprovals;
  const firstProvisionalUserIndex = provisionalConversationItems.findIndex(
    (item) => item.role === "user"
  );
  const firstProvisionalAssistantIndex = provisionalConversationItems.findIndex(
    (item) => item.role === "assistant"
  );

  useEffect(() => {
    if (status !== "running" || typeof runStartedAt !== "number" || !showLiveAssistantCard) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [runStartedAt, showLiveAssistantCard, status]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div
        ref={chatRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        data-testid="agent-chat-scroll"
        className={`ui-chat-scroll ui-chat-scroll-borderless h-full overflow-x-hidden overflow-y-auto p-3 sm:p-5 dark:sm:p-7 ${showJumpToLatest ? "pb-20" : ""}`}
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="relative flex min-w-0 flex-col gap-6 text-[14px] leading-[1.65] text-foreground dark:gap-8">
          <div aria-hidden className={`pointer-events-none absolute ${SPINE_LEFT} top-0 bottom-0 w-px bg-border/20`} />
          {showLoadMoreBanner ? (
            <div className="flex flex-col items-start gap-2 rounded-md bg-surface-2 px-3 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="type-meta w-full min-w-0 break-words font-mono text-muted-foreground sm:truncate">
                {hasHiddenFetchedHistory && typeof historyFetchedCount === "number" && typeof visibleTurnCount === "number"
                  ? `Showing latest ${visibleTurnCount} of ${historyFetchedCount} loaded turns`
                  : `Showing latest ${typeof visibleTurnCount === "number" ? visibleTurnCount : "?"} turns`}
              </div>
              {historyGatewayCapReached && !hasHiddenFetchedHistory ? (
                <div className="type-meta w-full min-w-0 break-words font-mono text-muted-foreground sm:w-auto sm:shrink-0">
                  Showing latest retrievable history
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex w-fit self-start rounded-md border border-border/70 bg-surface-3 px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 sm:self-auto"
                  onClick={onLoadMoreHistory}
                >
                  {hasHiddenFetchedHistory ? "Show older" : "Load more"}
                </button>
              )}
            </div>
          ) : null}
          {!hasRenderableContent ? (
            <AssistantIntroCard
              avatarSeed={avatarSeed}
              avatarUrl={avatarUrl}
              name={name}
              title={emptyStateTitle}
            />
          ) : (
            <>
              {hasTranscriptItems ? (
                <AgentChatFinalItems
                  agentId={agentId}
                  name={name}
                  avatarSeed={avatarSeed}
                  avatarUrl={avatarUrl}
                  renderBlocks={renderBlocks}
                  running={status === "running"}
                  runStartedAt={runStartedAt}
                />
              ) : (
                <>
                  {provisionalConversationItems.map((item, index) =>
                    item.role === "user" ? (
                      <UserMessageCard
                        key={`provisional-user-${index}`}
                        text={item.text}
                        timestampMs={item.timestampMs}
                        testId={index === firstProvisionalUserIndex ? "agent-provisional-user" : undefined}
                      />
                    ) : (
                      <AssistantMessageCard
                        key={`provisional-assistant-${index}`}
                        avatarSeed={avatarSeed}
                        avatarUrl={avatarUrl}
                        name={name}
                        contentText={item.text}
                        timestampMs={item.timestampMs}
                        testId={
                          index === firstProvisionalAssistantIndex
                            ? "agent-provisional-assistant"
                            : undefined
                        }
                      />
                    )
                  )}
                </>
              )}
              {showLiveAssistantCard ? (
                <AssistantMessageCard
                  avatarSeed={avatarSeed}
                  avatarUrl={avatarUrl}
                  name={name}
                  timestampMs={runStartedAt ?? undefined}
                  thinkingText={liveThinkingText || null}
                  thinkingDurationMs={
                    typeof runStartedAt === "number" && typeof nowMs === "number"
                      ? Math.max(0, nowMs - runStartedAt)
                      : undefined
                  }
                  contentText={liveAssistantText || null}
                  streaming={status === "running"}
                />
              ) : null}
              {pendingExecApprovals.map((approval) => (
                <ExecApprovalCard
                  key={approval.id}
                  approval={approval}
                  onResolve={onResolveExecApproval}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border/70 bg-card px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground shadow-xs transition hover:bg-surface-2"
          onClick={() => {
            setPinned(true);
            scrollChatToBottom();
          }}
          aria-label="Jump to latest"
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
});
