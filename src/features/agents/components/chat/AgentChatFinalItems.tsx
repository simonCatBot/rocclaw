// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { memo } from "react";
import type { AgentChatRenderBlock } from "../chatItems";
import { UserMessageCard } from "./UserMessageCard";
import { AssistantMessageCard } from "./AssistantMessageCard";

export const AgentChatFinalItems = memo(function AgentChatFinalItems({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  renderBlocks,
  running,
  runStartedAt,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  renderBlocks: AgentChatRenderBlock[];
  running: boolean;
  runStartedAt: number | null;
}) {
  return (
    <>
      {renderBlocks.map((block, index) => {
        if (block.kind === "user") {
          return (
            <UserMessageCard
              key={`chat-${agentId}-user-${index}`}
              text={block.text}
              timestampMs={block.timestampMs}
            />
          );
        }
        const streaming = running && index === renderBlocks.length - 1 && !block.text;
        return (
          <AssistantMessageCard
            key={`chat-${agentId}-assistant-${index}`}
            avatarSeed={avatarSeed}
            avatarUrl={avatarUrl}
            name={name}
            timestampMs={block.timestampMs ?? (streaming ? runStartedAt ?? undefined : undefined)}
            thinkingEvents={block.traceEvents}
            thinkingDurationMs={block.thinkingDurationMs}
            contentText={block.text}
            streaming={streaming}
          />
        );
      })}
    </>
  );
});
