// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain } from "lucide-react";
import { rewriteMediaLinesToMarkdown } from "@/lib/text/media-markdown";
import { MarkdownImage } from "./MarkdownImage";
import type { AssistantTraceEvent } from "../chatItems";
import { AgentAvatar } from "../AgentAvatar";
import {
  ASSISTANT_GUTTER_CLASS,
  ASSISTANT_MAX_WIDTH_EXPANDED_CLASS,
  MESSAGE_CONTENT_VISIBILITY_STYLE,
} from "./chatConstants";
import { formatChatTimestamp, resolveAssistantMaxWidthClass } from "./chatFormatters";
import { ThinkingDetailsRow } from "./ThinkingDetailsRow";

export const AssistantMessageCard = memo(function AssistantMessageCard({
  avatarSeed,
  avatarUrl,
  name,
  timestampMs,
  thinkingEvents,
  thinkingText,
  thinkingToolLines,
  thinkingDurationMs,
  contentText,
  streaming,
  testId,
}: {
  avatarSeed: string;
  avatarUrl: string | null;
  name: string;
  timestampMs?: number;
  thinkingEvents?: AssistantTraceEvent[];
  thinkingText?: string | null;
  thinkingToolLines?: string[];
  thinkingDurationMs?: number;
  contentText?: string | null;
  streaming?: boolean;
  testId?: string;
}) {
  const resolvedTimestamp = typeof timestampMs === "number" ? timestampMs : null;
  const hasThinking = Boolean(
    (thinkingEvents?.length ?? 0) > 0 ||
      thinkingText?.trim() ||
      (thinkingToolLines?.length ?? 0) > 0
  );
  const widthClass = hasThinking
    ? ASSISTANT_MAX_WIDTH_EXPANDED_CLASS
    : resolveAssistantMaxWidthClass(contentText);
  const hasContent = Boolean(contentText?.trim());
  const compactStreamingIndicator = Boolean(streaming && !hasThinking && !hasContent);

  return (
    <div
      className="w-full self-start"
      style={MESSAGE_CONTENT_VISIBILITY_STYLE}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <div className={`relative w-full ${widthClass} ${ASSISTANT_GUTTER_CLASS}`}>
        <div className="absolute left-[4px] top-[2px]">
          <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
            {name}
          </div>
          {resolvedTimestamp !== null ? (
            <time className="type-meta shrink-0 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-muted-foreground/90">
              {formatChatTimestamp(resolvedTimestamp)}
            </time>
          ) : null}
        </div>

        {compactStreamingIndicator ? (
          <div
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-surface-3 px-3 py-2 text-[10px] text-muted-foreground/80 shadow-2xs"
            role="status"
            aria-live="polite"
            data-testid="agent-typing-indicator"
          >
            <Brain className="h-3 w-3 shrink-0 text-muted-foreground/80" />
            <span className="font-mono text-[10px] font-medium">Thinking</span>
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : (
          <div className="mt-2 space-y-3 dark:space-y-5">
            {streaming && !hasThinking ? (
              <div
                className="flex items-center gap-2 text-[10px] text-muted-foreground/80"
                role="status"
                aria-live="polite"
                data-testid="agent-typing-indicator"
              >
                <Brain className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                <span className="font-mono text-[10px] font-medium">Thinking</span>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            ) : null}

            {hasThinking ? (
              <ThinkingDetailsRow
                events={thinkingEvents}
                thinkingText={thinkingText}
                toolLines={thinkingToolLines ?? []}
                durationMs={thinkingDurationMs}
                showTyping={streaming}
              />
            ) : null}

            {contentText ? (
              <div className="ui-chat-assistant-card">
                {streaming ? (
                  (() => {
                    if (!contentText.includes("MEDIA:")) {
                      return (
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {contentText}
                        </div>
                      );
                    }
                    const rewritten = rewriteMediaLinesToMarkdown(contentText);
                    if (!rewritten.includes("![](")) {
                      return (
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {contentText}
                        </div>
                      );
                    }
                    return (
                      <div className="agent-markdown text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: MarkdownImage }}>{rewritten}</ReactMarkdown>
                      </div>
                    );
                  })()
                ) : (
                  <div className="agent-markdown text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: MarkdownImage }}>
                      {rewriteMediaLinesToMarkdown(contentText)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});
