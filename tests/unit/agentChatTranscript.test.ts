import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement, createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { AgentChatTranscript } from "@/features/agents/components/chat/AgentChatTranscript";

// Mock child components to avoid complex dependencies
vi.mock("@/features/agents/components/chat/ExecApprovalCard", () => ({
  ExecApprovalCard: () => createElement("div", { "data-testid": "exec-approval" }),
}));

vi.mock("@/features/agents/components/chat/UserMessageCard", () => ({
  UserMessageCard: () => createElement("div", { "data-testid": "user-message" }),
}));

vi.mock("@/features/agents/components/chat/AssistantMessageCard", () => ({
  AssistantMessageCard: () => createElement("div", { "data-testid": "assistant-message" }),
}));

vi.mock("@/features/agents/components/chat/AssistantIntroCard", () => ({
  AssistantIntroCard: (props: { title?: string }) => createElement("div", { "data-testid": "assistant-intro" }, props.title ?? ""),
}));

vi.mock("@/features/agents/components/chat/AgentChatFinalItems", () => ({
  AgentChatFinalItems: () => createElement("div", { "data-testid": "final-items" }),
}));

vi.mock("@/lib/dom", () => ({
  isNearBottom: () => true,
}));

afterEach(() => {
  cleanup();
});

const buildProps = (overrides?: Partial<Parameters<typeof AgentChatTranscript>[0]>) => ({
  agentId: "agent-1",
  name: "Test Agent",
  avatarSeed: "seed-1",
  avatarUrl: null,
  status: "idle" as const,
  historyMaybeTruncated: false,
  historyGatewayCapReached: false,
  historyFetchedCount: 0,
  historyVisibleTurnLimit: null,
  onLoadMoreHistory: vi.fn(),
  renderBlocks: [],
  liveThinkingText: "",
  liveAssistantText: "",
  showTypingIndicator: false,
  outputLineCount: 0,
  liveAssistantCharCount: 0,
  liveThinkingCharCount: 0,
  runStartedAt: null,
  scrollToBottomOnOpenKey: "key-1",
  scrollToBottomNextOutputRef: createRef<boolean>() as { current: boolean },
  pendingExecApprovals: [],
  onResolveExecApproval: vi.fn(),
  emptyStateTitle: "No messages yet",
  lastUserMessage: null,
  latestPreview: null,
  previewItems: [],
  ...overrides,
});

describe("AgentChatTranscript", () => {
  it("renders the chat transcript container", () => {
    const ref = { current: false };
    render(createElement(AgentChatTranscript, buildProps({ scrollToBottomNextOutputRef: ref })));
    const log = screen.getByRole("log");
    expect(log).toBeInTheDocument();
  });

  it("has role=log on the chat container", () => {
    const ref = { current: false };
    render(createElement(AgentChatTranscript, buildProps({ scrollToBottomNextOutputRef: ref })));
    expect(screen.getByRole("log")).toBeInTheDocument();
  });

  it("has aria-label on the chat container", () => {
    const ref = { current: false };
    render(createElement(AgentChatTranscript, buildProps({ scrollToBottomNextOutputRef: ref })));
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-label", "Chat messages");
  });

  it("has aria-live=polite on the chat container", () => {
    const ref = { current: false };
    render(createElement(AgentChatTranscript, buildProps({ scrollToBottomNextOutputRef: ref })));
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("shows empty state title when no messages", () => {
    const ref = { current: false };
    render(createElement(AgentChatTranscript, buildProps({
      scrollToBottomNextOutputRef: ref,
      emptyStateTitle: "Start a conversation",
    })));
    expect(screen.getByText("Start a conversation")).toBeInTheDocument();
  });
});
