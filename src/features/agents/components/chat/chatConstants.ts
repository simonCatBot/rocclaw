// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import type { CSSProperties } from "react";

export const SPINE_LEFT = "left-[15px]";
export const ASSISTANT_GUTTER_CLASS = "pl-[44px]";
export const ASSISTANT_MAX_WIDTH_DEFAULT_CLASS = "max-w-[68ch]";
export const ASSISTANT_MAX_WIDTH_EXPANDED_CLASS = "max-w-[1120px]";
export const CHAT_TOP_THRESHOLD_PX = 8;
export const MESSAGE_CONTENT_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "220px",
};
export const EMPTY_CHAT_INTRO_MESSAGES = [
  "How can I help you today?",
  "What should we accomplish today?",
  "Ready when you are. What do you want to tackle?",
  "What are we working on today?",
  "I'm here and ready. What's the plan?",
];
