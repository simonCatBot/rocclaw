import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentChatComposer } from "@/features/agents/components/chat/AgentChatComposer";

afterEach(() => {
  cleanup();
});

const buildProps = (overrides?: Partial<Parameters<typeof AgentChatComposer>[0]>) => ({
  value: "",
  onChange: vi.fn(),
  onKeyDown: vi.fn(),
  onSend: vi.fn(),
  onStop: vi.fn(),
  canSend: true,
  stopBusy: false,
  stopDisabledReason: null,
  running: false,
  sendDisabled: false,
  queuedMessages: [] as string[],
  onRemoveQueuedMessage: vi.fn(),
  inputRef: vi.fn(),
  modelOptions: [{ value: "ollama/llama3.1:latest", label: "llama3.1:latest" }],
  modelValue: "ollama/llama3.1:latest",
  allowThinking: false,
  thinkingValue: "",
  onModelChange: vi.fn(),
  onThinkingChange: vi.fn(),
  toolCallingEnabled: false,
  showThinkingTraces: false,
  onToolCallingToggle: vi.fn(),
  onThinkingTracesToggle: vi.fn(),
  ...overrides,
});

describe("AgentChatComposer", () => {
  it("renders the message input textarea", () => {
    render(createElement(AgentChatComposer, buildProps()));
    expect(screen.getByLabelText("Message input")).toBeInTheDocument();
  });

  it("textarea has correct placeholder", () => {
    render(createElement(AgentChatComposer, buildProps()));
    expect(screen.getByPlaceholderText("type a message")).toBeInTheDocument();
  });

  it("renders the Send button", () => {
    render(createElement(AgentChatComposer, buildProps()));
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("disables Send button when sendDisabled is true", () => {
    render(createElement(AgentChatComposer, buildProps({ sendDisabled: true })));
    expect(screen.getByText("Send")).toBeDisabled();
  });

  it("enables Send button when sendDisabled is false", () => {
    render(createElement(AgentChatComposer, buildProps({ sendDisabled: false })));
    expect(screen.getByText("Send")).not.toBeDisabled();
  });

  it("calls onSend when Send button is clicked", () => {
    const onSend = vi.fn();
    render(createElement(AgentChatComposer, buildProps({ onSend })));
    fireEvent.click(screen.getByText("Send"));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("shows Stop button when running", () => {
    render(createElement(AgentChatComposer, buildProps({ running: true })));
    expect(screen.getByLabelText("Stop")).toBeInTheDocument();
  });

  it("does not show Stop button when not running", () => {
    render(createElement(AgentChatComposer, buildProps({ running: false })));
    expect(screen.queryByLabelText("Stop")).not.toBeInTheDocument();
  });

  it("shows Stopping text when stopBusy", () => {
    render(createElement(AgentChatComposer, buildProps({ running: true, stopBusy: true })));
    expect(screen.getByText("Stopping")).toBeInTheDocument();
  });

  it("shows gateway disconnected title on Send when canSend is false", () => {
    render(createElement(AgentChatComposer, buildProps({ canSend: false, sendDisabled: true })));
    const sendButton = screen.getByText("Send");
    expect(sendButton).toHaveAttribute("title", "Gateway disconnected");
  });

  it("does not show gateway disconnected title when canSend is true", () => {
    render(createElement(AgentChatComposer, buildProps({ canSend: true })));
    const sendButton = screen.getByText("Send");
    expect(sendButton).not.toHaveAttribute("title");
  });

  it("renders model selector", () => {
    render(createElement(AgentChatComposer, buildProps()));
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
  });

  it("shows thinking selector when allowThinking is true", () => {
    render(createElement(AgentChatComposer, buildProps({ allowThinking: true })));
    expect(screen.getByLabelText("Thinking")).toBeInTheDocument();
  });

  it("hides thinking selector when allowThinking is false", () => {
    render(createElement(AgentChatComposer, buildProps({ allowThinking: false })));
    expect(screen.queryByLabelText("Thinking")).not.toBeInTheDocument();
  });

  it("renders tool calling toggle as switch", () => {
    render(createElement(AgentChatComposer, buildProps()));
    const toolToggle = screen.getByLabelText("Show tool calls");
    expect(toolToggle).toHaveAttribute("role", "switch");
  });

  it("renders thinking traces toggle as switch", () => {
    render(createElement(AgentChatComposer, buildProps()));
    const thinkingToggle = screen.getByLabelText("Show thinking");
    expect(thinkingToggle).toHaveAttribute("role", "switch");
  });

  it("reflects toolCallingEnabled in aria-checked", () => {
    render(createElement(AgentChatComposer, buildProps({ toolCallingEnabled: true })));
    const toolToggle = screen.getByLabelText("Show tool calls");
    expect(toolToggle).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToolCallingToggle when tool toggle is clicked", () => {
    const onToolCallingToggle = vi.fn();
    render(createElement(AgentChatComposer, buildProps({ onToolCallingToggle, toolCallingEnabled: false })));
    fireEvent.click(screen.getByLabelText("Show tool calls"));
    expect(onToolCallingToggle).toHaveBeenCalledWith(true);
  });

  it("shows queued messages when present", () => {
    render(createElement(AgentChatComposer, buildProps({ queuedMessages: ["hello", "world"] })));
    expect(screen.getByTestId("queued-messages-bar")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  it("renders remove buttons for queued messages", () => {
    render(createElement(AgentChatComposer, buildProps({ queuedMessages: ["msg1"] })));
    expect(screen.getByLabelText("Remove queued message 1")).toBeInTheDocument();
  });
});
