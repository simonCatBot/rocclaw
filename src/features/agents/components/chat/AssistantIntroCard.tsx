// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { memo } from "react";
import { AgentAvatar } from "../AgentAvatar";
import {
  ASSISTANT_GUTTER_CLASS,
  ASSISTANT_MAX_WIDTH_DEFAULT_CLASS,
} from "./chatConstants";

export const AssistantIntroCard = memo(function AssistantIntroCard({
  avatarSeed,
  avatarUrl,
  name,
  title,
}: {
  avatarSeed: string;
  avatarUrl: string | null;
  name: string;
  title: string;
}) {
  return (
    <div className="w-full self-start">
      <div className={`relative w-full ${ASSISTANT_MAX_WIDTH_DEFAULT_CLASS} ${ASSISTANT_GUTTER_CLASS}`}>
        <div className="absolute left-[4px] top-[2px]">
          <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
            {name}
          </div>
        </div>
        <div className="ui-chat-assistant-card mt-2">
          <div className="text-[14px] leading-[1.65] text-foreground">{title}</div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.03em] text-muted-foreground/80">
            Try describing a task, bug, or question to get started.
          </div>
        </div>
      </div>
    </div>
  );
});
