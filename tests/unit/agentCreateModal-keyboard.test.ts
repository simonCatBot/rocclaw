import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentCreateModal } from "@/features/agents/components/AgentCreateModal";

// Mock AvatarSelector to avoid complex dependencies
vi.mock("@/features/agents/components/AvatarSelector", () => ({
  AvatarSelector: () => createElement("div", { "data-testid": "avatar-selector" }),
  buildDefaultAvatarSelectorValue: () => ({
    avatarSeed: "test-seed",
    avatarSource: "auto",
    defaultAvatarIndex: 0,
    avatarUrl: "",
  }),
}));

afterEach(() => {
  cleanup();
});

const buildProps = (overrides?: Partial<Parameters<typeof AgentCreateModal>[0]>) => ({
  open: true,
  suggestedName: "Test Agent",
  busy: false,
  submitError: null,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides,
});

describe("AgentCreateModal", () => {
  it("renders when open is true", () => {
    render(createElement(AgentCreateModal, buildProps()));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(createElement(AgentCreateModal, buildProps({ open: false })));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has aria-modal=true", () => {
    render(createElement(AgentCreateModal, buildProps()));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("has aria-label on the dialog", () => {
    render(createElement(AgentCreateModal, buildProps()));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Create agent");
  });

  it("auto-focuses the name input on mount", () => {
    render(createElement(AgentCreateModal, buildProps()));
    const nameInput = screen.getByLabelText("Agent name");
    expect(document.activeElement).toBe(nameInput);
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(createElement(AgentCreateModal, buildProps({ onClose })));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape when busy", () => {
    const onClose = vi.fn();
    render(createElement(AgentCreateModal, buildProps({ onClose, busy: true })));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(createElement(AgentCreateModal, buildProps({ onClose })));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on form click (stopPropagation)", () => {
    const onClose = vi.fn();
    render(createElement(AgentCreateModal, buildProps({ onClose })));
    fireEvent.click(screen.getByTestId("agent-create-modal"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows submit error when provided", () => {
    render(createElement(AgentCreateModal, buildProps({ submitError: "Gateway error" })));
    expect(screen.getByText("Gateway error")).toBeInTheDocument();
  });

  it("disables submit when name is empty", () => {
    render(createElement(AgentCreateModal, buildProps({ suggestedName: "" })));
    const nameInput = screen.getByLabelText("Agent name");
    fireEvent.change(nameInput, { target: { value: "" } });
    const submitButton = screen.getByTestId("agent-create-modal").querySelector("button[type='submit']") as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
  });

  it("enables submit when name has content", () => {
    render(createElement(AgentCreateModal, buildProps()));
    const submitButton = screen.getByTestId("agent-create-modal").querySelector("button[type='submit']") as HTMLButtonElement;
    expect(submitButton).not.toBeDisabled();
  });

  it("shows Launching... text when busy", () => {
    render(createElement(AgentCreateModal, buildProps({ busy: true })));
    expect(screen.getByText("Launching...")).toBeInTheDocument();
  });

  it("calls onSubmit with form data on submit", () => {
    const onSubmit = vi.fn();
    render(createElement(AgentCreateModal, buildProps({ onSubmit })));
    const nameInput = screen.getByLabelText("Agent name");
    fireEvent.change(nameInput, { target: { value: "My Agent" } });
    const submitButton = screen.getByTestId("agent-create-modal").querySelector("button[type='submit']") as HTMLButtonElement;
    fireEvent.click(submitButton);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Agent" })
    );
  });

  it("populates the name field with suggestedName", () => {
    render(createElement(AgentCreateModal, buildProps({ suggestedName: "Suggested" })));
    const nameInput = screen.getByLabelText("Agent name") as HTMLInputElement;
    expect(nameInput.value).toBe("Suggested");
  });
});
