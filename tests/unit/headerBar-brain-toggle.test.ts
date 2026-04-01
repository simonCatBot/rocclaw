import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HeaderBar } from "@/features/agents/components/HeaderBar";

describe("HeaderBar controls", () => {
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

  it("does_not_render_brain_toggle_in_header", () => {
    render(createElement(HeaderBar, {}));
    expect(screen.queryByTestId("brain-files-toggle")).not.toBeInTheDocument();
  });

  it("calls_onConnectionSettings_when_settings_button_clicked", () => {
    const onConnectionSettings = vi.fn();

    render(
      createElement(HeaderBar, {
        status: "disconnected",
        onConnectionSettings,
        showConnectionSettings: true,
      })
    );

    // Find the connection button (Plug icon)
    const plugButton = screen.getByRole("button", { name: /disconnected/i });
    fireEvent.click(plugButton);

    expect(onConnectionSettings).toHaveBeenCalledTimes(1);
  });

  it("does_not_render_settings_button_when_showConnectionSettings_is_false", () => {
    const onConnectionSettings = vi.fn();

    render(
      createElement(HeaderBar, {
        status: "disconnected",
        onConnectionSettings,
        showConnectionSettings: false,
      })
    );

    expect(screen.queryByRole("button", { name: /disconnected/i })).not.toBeInTheDocument();
  });
});
