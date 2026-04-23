// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MESSAGE_CONTENT_VISIBILITY_STYLE } from "./chatConstants";
import { formatChatTimestamp } from "./chatFormatters";
import { MarkdownImage } from "./MarkdownImage";

export const UserMessageCard = memo(function UserMessageCard({
  text,
  timestampMs,
  testId,
}: {
  text: string;
  timestampMs?: number;
  testId?: string;
}) {
  return (
    <div
      className="ui-chat-user-card w-full max-w-[70ch] self-end overflow-hidden rounded-[var(--radius-small)] bg-[color:var(--chat-user-bg)]"
      style={MESSAGE_CONTENT_VISIBILITY_STYLE}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--chat-user-border)] px-3 py-2 dark:px-3.5 dark:py-2.5">
        <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
          You
        </div>
        {typeof timestampMs === "number" ? (
          <time className="type-meta shrink-0 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-muted-foreground/70">
            {formatChatTimestamp(timestampMs)}
          </time>
        ) : null}
      </div>
      <div className="agent-markdown type-body px-3 py-3 text-foreground dark:px-3.5 dark:py-3.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: MarkdownImage }}>{text}</ReactMarkdown>
      </div>
    </div>
  );
});
