import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FleetSidebar } from "@/features/agents/components/FleetSidebar";
import type { AgentState } from "@/features/agents/state/store";

// Mock next/image to render plain img
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}));

// Mock AvatarModeContext
vi.mock("@/components/AvatarModeContext", () => ({
  useAvatarMode: () => "auto",
  useSetAvatarMode: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const createAgent = (overrides?: Partial<AgentState>): AgentState => ({
  agentId: "agent-1",
  name: "TestAgent",
  identityName: null,
  status: "idle",
  model: "ollama/llama3.1:latest",
  avatarSeed: "seed-1",
  avatarUrl: null,
  avatarSource: "auto",
  defaultAvatarIndex: 0,
  draft: "",
  outputLines: [],
  streamText: null,
  lastResult: null,
  lastDiff: null,
  lastUserMessage: null,
  lastActivityAt: null,
  lastAssistantMessageAt: null,
  runId: null,
  runStartedAt: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  sessionKey: "session-1",
  sessionCreated: true,
  sessionSettingsSynced: true,
  sessionEpoch: 0,
  hasUnseenActivity: false,
  historyMaybeTruncated: false,
  historyGatewayCapReached: false,
  historyFetchedCount: 0,
  historyFetchLimit: null,
  historyLoadedAt: null,
  historyVisibleTurnLimit: null,
  queuedMessages: [],
  awaitingUserInput: false,
  latestPreview: null,
  previewItems: [],
  toolCallingEnabled: false,
  showThinkingTraces: false,
  ...overrides,
});

const buildProps = (agents: AgentState[] = []) => ({
  agents,
  selectedAgentId: null,
  onSelectAgent: vi.fn(),
  onCreateAgent: vi.fn(),
});

describe("FleetSidebar", () => {
  it("shows empty state when no agents", () => {
    render(createElement(FleetSidebar, buildProps([])));
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
  });

  it("shows create button in empty state", () => {
    const onCreateAgent = vi.fn();
    render(createElement(FleetSidebar, { ...buildProps([]), onCreateAgent }));
    const buttons = screen.getAllByText("Create Agent");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders agent cards when agents exist", () => {
    const agents = [
      createAgent({ agentId: "a1", name: "Alpha" }),
      createAgent({ agentId: "a2", name: "Beta" }),
    ];
    render(createElement(FleetSidebar, buildProps(agents)));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows search input when agents exist", () => {
    const agents = [createAgent()];
    render(createElement(FleetSidebar, buildProps(agents)));
    expect(screen.getByLabelText("Search agents")).toBeInTheDocument();
  });

  it("does not show search input when no agents", () => {
    render(createElement(FleetSidebar, buildProps([])));
    expect(screen.queryByLabelText("Search agents")).not.toBeInTheDocument();
  });

  it("filters agents by name", () => {
    const agents = [
      createAgent({ agentId: "a1", name: "Developer" }),
      createAgent({ agentId: "a2", name: "Writer" }),
    ];
    render(createElement(FleetSidebar, buildProps(agents)));
    const searchInput = screen.getByLabelText("Search agents");
    fireEvent.change(searchInput, { target: { value: "dev" } });
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.queryByText("Writer")).not.toBeInTheDocument();
  });

  it("filters agents by agent ID", () => {
    const agents = [
      createAgent({ agentId: "abc-123", name: "Agent A" }),
      createAgent({ agentId: "xyz-789", name: "Agent B" }),
    ];
    render(createElement(FleetSidebar, buildProps(agents)));
    const searchInput = screen.getByLabelText("Search agents");
    fireEvent.change(searchInput, { target: { value: "xyz" } });
    expect(screen.queryByText("Agent A")).not.toBeInTheDocument();
    expect(screen.getByText("Agent B")).toBeInTheDocument();
  });

  it("filters agents by model name", () => {
    const agents = [
      createAgent({ agentId: "a1", name: "LLaMA Agent", model: "ollama/llama3.1:latest" }),
      createAgent({ agentId: "a2", name: "Qwen Agent", model: "ollama/qwen2.5:7b" }),
    ];
    render(createElement(FleetSidebar, buildProps(agents)));
    const searchInput = screen.getByLabelText("Search agents");
    fireEvent.change(searchInput, { target: { value: "qwen" } });
    expect(screen.queryByText("LLaMA Agent")).not.toBeInTheDocument();
    expect(screen.getByText("Qwen Agent")).toBeInTheDocument();
  });

  it("shows no-match message when search has no results", () => {
    const agents = [createAgent({ agentId: "a1", name: "Alpha" })];
    render(createElement(FleetSidebar, buildProps(agents)));
    const searchInput = screen.getByLabelText("Search agents");
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });
    expect(screen.getByText(/No agents matching/)).toBeInTheDocument();
  });

  it("has aria-label on the aside element", () => {
    render(createElement(FleetSidebar, buildProps([])));
    const sidebar = screen.getByTestId("fleet-sidebar");
    expect(sidebar).toHaveAttribute("aria-label", "Agent fleet");
  });

  it("agent buttons have descriptive aria-labels", () => {
    const agents = [createAgent({ agentId: "a1", name: "TestBot", status: "running" })];
    render(createElement(FleetSidebar, buildProps(agents)));
    const agentButton = screen.getByTestId("fleet-agent-row-a1");
    expect(agentButton).toHaveAttribute("aria-label");
    expect(agentButton.getAttribute("aria-label")).toContain("TestBot");
  });

  it("calls onSelectAgent when agent card is clicked", () => {
    const onSelectAgent = vi.fn();
    const agents = [createAgent({ agentId: "a1", name: "Alpha" })];
    render(createElement(FleetSidebar, { ...buildProps(agents), onSelectAgent }));
    fireEvent.click(screen.getByTestId("fleet-agent-row-a1"));
    expect(onSelectAgent).toHaveBeenCalledWith("a1");
  });

  it("shows agent count in header", () => {
    const agents = [
      createAgent({ agentId: "a1", name: "Agent A" }),
      createAgent({ agentId: "a2", name: "Agent B" }),
      createAgent({ agentId: "a3", name: "Agent C" }),
    ];
    render(createElement(FleetSidebar, buildProps(agents)));
    expect(screen.getByText("Agents (3)")).toBeInTheDocument();
  });
});
