// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, expect, it } from "vitest";

import {
  buildAgentChatRenderBlocks,
  buildFinalAgentChatItems,
  summarizeToolLabel,
} from "@/features/agents/components/chatItems";
import { formatMetaMarkdown, formatThinkingMarkdown, formatToolCallMarkdown } from "@/lib/text/message-extract";

describe("buildFinalAgentChatItems", () => {
  it("does not include live thinking or live assistant items", () => {
    const items = buildFinalAgentChatItems({
      outputLines: ["> question", formatThinkingMarkdown("plan"), "answer"],
      showThinkingTraces: true,
      toolCallingEnabled: true,
    });

    expect(items.map((item) => item.kind)).toEqual(["user", "thinking", "assistant"]);
  });

  it("propagates meta timestamps and thinking duration into subsequent items", () => {
    const items = buildFinalAgentChatItems({
      outputLines: [
        formatMetaMarkdown({ role: "user", timestamp: 1700000000000 }),
        "> hello",
        formatMetaMarkdown({ role: "assistant", timestamp: 1700000001234, thinkingDurationMs: 1800 }),
        formatThinkingMarkdown("plan"),
        "answer",
      ],
      showThinkingTraces: true,
      toolCallingEnabled: true,
    });

    expect(items[0]).toMatchObject({ kind: "user", text: "hello", timestampMs: 1700000000000 });
    expect(items[1]).toMatchObject({
      kind: "thinking",
      text: "_plan_",
      timestampMs: 1700000001234,
      thinkingDurationMs: 1800,
    });
    expect(items[2]).toMatchObject({
      kind: "assistant",
      text: "answer",
      timestampMs: 1700000001234,
      thinkingDurationMs: 1800,
    });
  });

  it("collapses adjacent duplicate user items when optimistic and persisted turns match", () => {
    const items = buildFinalAgentChatItems({
      outputLines: [
        "> hello\n\nworld",
        formatMetaMarkdown({ role: "user", timestamp: 1700000000000 }),
        "> hello world",
      ],
      showThinkingTraces: true,
      toolCallingEnabled: true,
    });

    expect(items).toEqual([
      {
        kind: "user",
        text: "hello world",
        timestampMs: 1700000000000,
      },
    ]);
  });

  it("does_not_collapse_repeated_user_message_when_second_turn_is_only_optimistic", () => {
    const items = buildFinalAgentChatItems({
      outputLines: [
        formatMetaMarkdown({ role: "user", timestamp: 1700000000000 }),
        "> repeat",
        "> repeat",
      ],
      showThinkingTraces: true,
      toolCallingEnabled: true,
    });

    expect(items).toEqual([
      {
        kind: "user",
        text: "repeat",
        timestampMs: 1700000000000,
      },
      {
        kind: "user",
        text: "repeat",
      },
    ]);
  });

  it("keeps assistant markdown as assistant content", () => {
    const items = buildFinalAgentChatItems({
      outputLines: ["- first item\n- second item"],
      showThinkingTraces: true,
      toolCallingEnabled: true,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "assistant" });
    expect(items[0]?.text).toContain("- first item");
  });

});

describe("summarizeToolLabel", () => {
  it("hides long tool call ids and prefers showing the command/path/url value", () => {
    const toolCallLine = formatToolCallMarkdown({
      id: "call_ABC123|fc_456",
      name: "functions.exec",
      arguments: { command: "gh auth status" },
    });

    const { summaryText: callSummary } = summarizeToolLabel(toolCallLine);
    expect(callSummary).toContain("gh auth status");
    expect(callSummary).not.toContain("call_");
  });

  it("renders read file calls as inline path labels without JSON body", () => {
    const toolCallLine = formatToolCallMarkdown({
      id: "call_read_1",
      name: "read",
      arguments: { file_path: "/Users/georgepickett/openclaw/shared/openclaw-agent-home/README.md" },
    });

    const summary = summarizeToolLabel(toolCallLine);
    expect(summary.summaryText).toBe(
      "read /Users/georgepickett/openclaw/shared/openclaw-agent-home/README.md"
    );
    expect(summary.inlineOnly).toBe(true);
    expect(summary.body).toBe("");
  });
});

describe("buildAgentChatRenderBlocks", () => {
  it("starts a new assistant block after a user turn", () => {
    const blocks = buildAgentChatRenderBlocks([
      { kind: "thinking", text: "_first plan_", timestampMs: 10 },
      { kind: "assistant", text: "first answer", timestampMs: 11 },
      { kind: "user", text: "next question", timestampMs: 12 },
      { kind: "thinking", text: "_second plan_", timestampMs: 13 },
      { kind: "assistant", text: "second answer", timestampMs: 14 },
    ]);

    expect(blocks.map((block) => block.kind)).toEqual(["assistant", "user", "assistant"]);
  });

  it("merges adjacent incremental thinking updates", () => {
    const blocks = buildAgentChatRenderBlocks([
      { kind: "thinking", text: "_a_", timestampMs: 10 },
      { kind: "thinking", text: "_a_\n\n_b_", timestampMs: 10 },
      { kind: "assistant", text: "answer", timestampMs: 10 },
    ]);

    expect(blocks).toEqual([
      {
        kind: "assistant",
        text: "answer",
        timestampMs: 10,
        traceEvents: [{ kind: "thinking", text: "_a_\n\n_b_" }],
      },
    ]);
  });
});

