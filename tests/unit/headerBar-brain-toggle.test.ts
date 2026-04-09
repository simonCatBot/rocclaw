// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

describe("HeaderBar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders_logo", () => {
    render(createElement(HeaderBar, {}));
    expect(screen.getByAltText("rocCLAW control")).toBeInTheDocument();
  });

  it("does_not_render_brain_toggle", () => {
    render(createElement(HeaderBar, {}));
    expect(screen.queryByTestId("brain-files-toggle")).not.toBeInTheDocument();
  });

  it("does_not_render_connection_settings_button", () => {
    // HeaderBar no longer has connection settings button - that UI is in FooterBar
    render(createElement(HeaderBar, {}));
    expect(screen.queryByRole("button", { name: /disconnected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gateway/i })).not.toBeInTheDocument();
  });

  it("does_not_render_hamburger_menu", () => {
    render(createElement(HeaderBar, {}));
    expect(screen.queryByTestId("rocclaw-menu-toggle")).not.toBeInTheDocument();
  });
});
