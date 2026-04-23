// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Clock, Brain } from "lucide-react";
import type { AssistantTraceEvent } from "../chatItems";
import { formatDurationLabel } from "./chatFormatters";
import { ToolCallDetails } from "./ToolCallDetails";
import { MarkdownImage } from "./MarkdownImage";

export const ThinkingDetailsRow = memo(function ThinkingDetailsRow({
  events,
  thinkingText,
  toolLines = [],
  durationMs,
  showTyping,
}: {
  events?: AssistantTraceEvent[];
  thinkingText?: string | null;
  toolLines?: string[];
  durationMs?: number;
  showTyping?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const traceEvents = (() => {
    if (events && events.length > 0) return events;
    const normalizedThinkingText = thinkingText?.trim() ?? "";
    const next: AssistantTraceEvent[] = [];
    if (normalizedThinkingText) {
      next.push({ kind: "thinking", text: normalizedThinkingText });
    }
    for (const line of toolLines) {
      next.push({ kind: "tool", text: line });
    }
    return next;
  })();
  if (traceEvents.length === 0) return null;
  return (
    <details
      open={open}
      className="ui-chat-thinking group rounded-md px-2 py-1.5 text-[10px] shadow-2xs"
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 opacity-65 [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
        <span className="flex min-w-0 items-center gap-2">
          <Brain className="h-3 w-3 shrink-0 text-foreground/60" />
          <span className="truncate font-mono text-xs font-medium tracking-[0.02em] text-foreground/60 group-open:text-foreground">
            Thinking (internal)
          </span>
          {typeof durationMs === "number" ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-[0.02em] text-muted-foreground/80">
              <Clock className="h-3 w-3" />
              {formatDurationLabel(durationMs)}
            </span>
          ) : null}
          {showTyping ? (
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </span>
      </summary>
      {open ? (
        <div className="mt-2 space-y-2 pl-5">
          {traceEvents.map((event, index) =>
            event.kind === "thinking" ? (
              <div
                key={`thinking-event-${index}-${event.text.slice(0, 48)}`}
                className="agent-markdown min-w-0 text-foreground/85"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: MarkdownImage }}>{event.text}</ReactMarkdown>
              </div>
            ) : (
              <ToolCallDetails
                key={`thinking-tool-${index}-${event.text.slice(0, 48)}`}
                line={event.text}
                className="rounded-md border border-border/45 bg-surface-2/65 px-2 py-1 text-[10px] text-muted-foreground/90 shadow-2xs"
              />
            )
          )}
        </div>
      ) : null}
    </details>
  );
});
