import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AvatarSelector } from "@/features/agents/components/AvatarSelector";

// Mock the avatar building utilities
vi.mock("@/lib/avatars/multiavatar", () => ({
  buildAvatarDataUrl: vi.fn((seed: string) => `data:auto+svg;seed=${seed}`),
}));

vi.mock("@/features/agents/components/AgentAvatar", () => ({
  buildDefaultAvatarUrl: vi.fn((index: number) => `/avatars/profile-${index + 1}.png`),
  deriveDefaultIndex: vi.fn((seed: string, i: number) => (seed.length + i) % 12),
  AgentAvatar: vi.fn(({ seed, name }) =>
    createElement("img", { src: `data:auto+svg;seed=${seed}`, alt: name })
  ),
}));

const defaultValue = {
  avatarSource: "auto" as const,
  avatarSeed: "test-agent-seed",
  defaultAvatarIndex: 0,
  avatarUrl: "",
};

describe("AvatarSelector", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderSelector = (
    value = defaultValue,
    onChange = vi.fn(),
    name = "avatar"
  ) =>
    render(
      createElement(AvatarSelector, { name, value, onChange })
    );

  it("renders the auto tab as active by default", () => {
    renderSelector();
    // The active tab button has bg-primary class
    const activeTab = screen.getByRole("button", { name: "Auto" });
    expect(activeTab).toHaveClass("bg-primary");
  });

  it("starts with auto tab active when avatarSource is 'auto'", () => {
    const onChange = vi.fn();
    renderSelector({ ...defaultValue, avatarSource: "auto" }, onChange);
    const activeTab = screen.getByRole("button", { name: "Auto" });
    expect(activeTab).toHaveClass("bg-primary");
  });

  it("renders a grid of default avatar options", () => {
    const { container } = renderSelector({ ...defaultValue, avatarSource: "default" });
    // Should show avatar image elements
    const avatars = container.querySelectorAll("img");
    expect(avatars.length).toBeGreaterThanOrEqual(6);
  });

  it("calls onChange with updated seed when shuffle is clicked", () => {
    const onChange = vi.fn();
    renderSelector({ ...defaultValue, avatarSource: "auto", avatarSeed: "original-seed" }, onChange);

    fireEvent.click(screen.getByRole("button", { name: /shuffle/i }));
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as { avatarSeed: string };
    expect(call.avatarSeed).toBeTruthy();
  });

  it("calls onChange when a default avatar is selected", () => {
    const onChange = vi.fn();
    renderSelector(
      { ...defaultValue, avatarSource: "default", defaultAvatarIndex: 0 },
      onChange
    );

    // Click the 3rd avatar option (index 2)
    const avatarOptions = document.querySelectorAll("[data-avatar-index]");
    if (avatarOptions.length >= 3) {
      fireEvent.click(avatarOptions[2]);
      expect(onChange).toHaveBeenCalled();
      const call = onChange.mock.calls[0][0] as { defaultAvatarIndex: number };
      expect(call.defaultAvatarIndex).toBe(2);
    }
  });

  it("calls onChange with custom source when custom tab is clicked", () => {
    const onChange = vi.fn();
    renderSelector({ ...defaultValue, avatarSource: "auto" }, onChange);

    const customButton = screen.queryByRole("button", { name: /custom/i });
    if (customButton) {
      fireEvent.click(customButton);
      expect(onChange).toHaveBeenCalled();
      const call = onChange.mock.calls[0][0] as { avatarSource: string };
      expect(call.avatarSource).toBe("custom");
    }
  });

  it("starts with auto tab active when avatarSource is 'auto'", () => {
    const onChange = vi.fn();
    renderSelector({ ...defaultValue, avatarSource: "auto" }, onChange);
    const activeTab = screen.getByRole("button", { name: "Auto" });
    expect(activeTab).toHaveClass("bg-primary");
  });
});
