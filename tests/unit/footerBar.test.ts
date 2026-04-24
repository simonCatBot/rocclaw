import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FooterBar } from "@/components/FooterBar";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}));

// Mock AvatarModeContext
vi.mock("@/components/AvatarModeContext", () => ({
  useAvatarMode: () => "auto",
  useSetAvatarMode: () => vi.fn(),
}));

// Mock agent store
vi.mock("@/features/agents/state/store", () => ({
  useAgentStore: () => ({
    state: { agents: [] },
  }),
}));

// Mock avatar helpers
vi.mock("@/lib/avatars/multiavatar", () => ({
  buildAvatarDataUrl: (seed: string) => `data:image/svg+xml,<svg>${seed}</svg>`,
}));

vi.mock("@/features/agents/components/AgentAvatar", () => ({
  buildDefaultAvatarUrl: (index: number) => `/avatars/${index}.png`,
  deriveDefaultIndex: () => 0,
}));

// Mock color semantics
vi.mock("@/features/agents/components/colorSemantics", () => ({
  resolveGatewayStatusLabel: (status: string) => {
    const labels: Record<string, string> = {
      connected: "Connected",
      disconnected: "Disconnected",
      connecting: "Connecting",
      reconnecting: "Reconnecting",
      error: "Error",
    };
    return labels[status] ?? status;
  },
}));

// Mock sub-components
vi.mock("@/components/ColorSchemeToggle", () => ({
  ColorSchemeToggle: () => createElement("div", { "data-testid": "color-scheme-toggle" }),
}));

vi.mock("@/components/AvatarModeToggle", () => ({
  AvatarModeToggle: () => createElement("div", { "data-testid": "avatar-mode-toggle" }),
}));

afterEach(() => {
  cleanup();
});

const buildProps = (overrides?: Partial<Parameters<typeof FooterBar>[0]>) => ({
  status: "connected" as const,
  gatewayVersion: null,
  onConnectionSettings: vi.fn(),
  ...overrides,
});

describe("FooterBar", () => {
  it("renders a footer element", () => {
    render(createElement(FooterBar, buildProps()));
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
  });

  it("has aria-label on the footer", () => {
    render(createElement(FooterBar, buildProps()));
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveAttribute("aria-label", "Application status");
  });

  it("shows gateway status label", () => {
    render(createElement(FooterBar, buildProps({ status: "connected" })));
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows disconnected status", () => {
    render(createElement(FooterBar, buildProps({ status: "disconnected" })));
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows rocCLAW branding in center", () => {
    render(createElement(FooterBar, buildProps()));
    expect(screen.getByText("rocCLAW")).toBeInTheDocument();
  });

  it("shows agent count", () => {
    render(createElement(FooterBar, buildProps()));
    expect(screen.getByText(/0 agents/)).toBeInTheDocument();
  });

  it("has connection settings button with aria-label", () => {
    render(createElement(FooterBar, buildProps()));
    const button = screen.getByLabelText("Gateway connection settings");
    expect(button).toBeInTheDocument();
  });

  it("calls onConnectionSettings when connection button is clicked", () => {
    const onConnectionSettings = vi.fn();
    render(createElement(FooterBar, buildProps({ onConnectionSettings })));
    fireEvent.click(screen.getByLabelText("Gateway connection settings"));
    expect(onConnectionSettings).toHaveBeenCalledTimes(1);
  });

  it("renders color scheme toggle", () => {
    render(createElement(FooterBar, buildProps()));
    expect(screen.getByTestId("color-scheme-toggle")).toBeInTheDocument();
  });

  it("renders avatar mode toggle", () => {
    render(createElement(FooterBar, buildProps()));
    expect(screen.getByTestId("avatar-mode-toggle")).toBeInTheDocument();
  });

  it("shows gateway version when provided", () => {
    render(createElement(FooterBar, buildProps({ gatewayVersion: "1.2.3" })));
    expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument();
  });
});
