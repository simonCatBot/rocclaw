// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  AvatarSelector,
  type AvatarSelectorValue,
} from "@/features/agents/components/AvatarSelector";

// Mock the avatar building utilities
vi.mock("@/lib/avatars/multiavatar", () => ({
  buildAvatarDataUrl: vi.fn((seed: string) => `data:auto+svg;seed=${seed}`),
}));

vi.mock("@/features/agents/components/AgentAvatar", () => ({
  buildDefaultAvatarUrl: vi.fn((index: number) => `/avatars/profile-${index + 1}.png`),
  deriveDefaultIndex: vi.fn((seed: string, i: number) => (seed.length + i) % 12),
  AgentAvatar: vi.fn(({ seed, name }: { seed: string; name: string }) =>
    createElement("img", { src: `data:auto+svg;seed=${seed}`, alt: name })
  ),
}));

const defaultValue: AvatarSelectorValue = {
  avatarSource: "auto",
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
    value: AvatarSelectorValue = defaultValue,
    onChange = vi.fn(),
    name = "avatar"
  ) =>
    render(
      createElement(AvatarSelector, { name, value, onChange })
    );

  it("renders the auto tab as active by default", () => {
    renderSelector();
    const activeTab = screen.getByRole("button", { name: "Auto" });
    expect(activeTab).toHaveClass("bg-primary");
  });

  it("renders a grid of default avatar options", () => {
    const { container } = renderSelector({
      ...defaultValue,
      avatarSource: "default",
    });
    const avatars = container.querySelectorAll("img");
    expect(avatars.length).toBeGreaterThanOrEqual(6);
  });

  it("calls onChange with updated seed when shuffle is clicked", () => {
    const onChange = vi.fn();
    renderSelector(
      { ...defaultValue, avatarSource: "auto", avatarSeed: "original-seed" },
      onChange
    );

    fireEvent.click(screen.getByRole("button", { name: /shuffle/i }));
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as AvatarSelectorValue;
    expect(call.avatarSeed).toBeTruthy();
  });

  it("calls onChange when a default avatar is selected", async () => {
    const onChange = vi.fn();
    const { container } = renderSelector(
      { ...defaultValue, avatarSource: "default" },
      onChange
    );

    // Switch to the Default tab first (component defaults to Auto) — this fires onChange once
    const defaultTab = screen.getByRole("button", { name: /^default$/i });
    fireEvent.click(defaultTab);

    // Wait for the grid to appear
    await new Promise((r) => setTimeout(r, 0));

    // Click "Avatar 3" button in the grid
    const avatarButton = container.querySelector('button[title="Avatar 3"]');
    expect(avatarButton).not.toBeNull();
    fireEvent.click(avatarButton!);

    // onChange fired for tab switch + avatar selection
    expect(onChange).toHaveBeenCalled();
    // Find the call with the correct avatar index
    const avatarCalls = onChange.mock.calls.filter(
      (call) => (call[0] as AvatarSelectorValue).defaultAvatarIndex === 2
    );
    expect(avatarCalls.length).toBeGreaterThan(0);
  });

  it("calls onChange with custom source when custom tab is clicked", () => {
    const onChange = vi.fn();
    renderSelector({ ...defaultValue, avatarSource: "auto" }, onChange);

    const customButton = screen.getByRole("button", { name: /custom/i });
    fireEvent.click(customButton);
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0] as AvatarSelectorValue;
    expect(call.avatarSource).toBe("custom");
  });
});
