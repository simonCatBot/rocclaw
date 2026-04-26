import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TabBar, getDefaultActiveTabs, VALID_TAB_IDS, type TabId } from "@/components/TabBar";

afterEach(() => {
  cleanup();
});

const buildProps = (overrides?: Partial<Parameters<typeof TabBar>[0]>) => ({
  activeTabs: ["agents", "system"] as TabId[],
  onTabToggle: vi.fn(),
  ...overrides,
});

describe("TabBar", () => {
  it("renders all 9 tab buttons", () => {
    render(createElement(TabBar, buildProps()));
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(9);
  });

  it("marks active tabs with aria-pressed=true", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents", "chat"] })));
    const agentsBtn = screen.getByTitle("Hide Agents");
    const chatBtn = screen.getByTitle("Hide Chat");
    const systemBtn = screen.getByTitle("Show System");
    expect(agentsBtn).toHaveAttribute("aria-pressed", "true");
    expect(chatBtn).toHaveAttribute("aria-pressed", "true");
    expect(systemBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onTabToggle when a tab is clicked", () => {
    const onTabToggle = vi.fn();
    render(createElement(TabBar, buildProps({ onTabToggle })));
    const settingsBtn = screen.getByTitle("Show Settings");
    fireEvent.click(settingsBtn);
    expect(onTabToggle).toHaveBeenCalledWith("settings");
  });

  it("has role=toolbar on the container", () => {
    render(createElement(TabBar, buildProps()));
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("sets tabIndex=0 on all buttons", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents"] })));
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toHaveAttribute("tabindex", "0");
    }
  });

  it("moves focus on ArrowRight key", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents"] })));
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("wraps focus from last to first on ArrowRight", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["settings"] })));
    const buttons = screen.getAllByRole("button");
    const lastBtn = buttons[buttons.length - 1];
    lastBtn.focus();
    fireEvent.keyDown(lastBtn, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("moves focus on ArrowLeft key", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["chat"] })));
    const buttons = screen.getAllByRole("button");
    buttons[1].focus();
    fireEvent.keyDown(buttons[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("jumps to first tab on Home key", () => {
    render(createElement(TabBar, buildProps()));
    const buttons = screen.getAllByRole("button");
    buttons[4].focus();
    fireEvent.keyDown(buttons[4], { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("jumps to last tab on End key", () => {
    render(createElement(TabBar, buildProps()));
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "End" });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("wraps in a nav element", () => {
    render(createElement(TabBar, buildProps()));
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("has aria-label on the nav element", () => {
    render(createElement(TabBar, buildProps()));
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-label", "Dashboard navigation");
  });

  it("shows Hide label for active tabs and Show for inactive", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents"] })));
    expect(screen.getByTitle("Hide Agents")).toBeInTheDocument();
    expect(screen.getByTitle("Show Chat")).toBeInTheDocument();
  });
});

describe("getDefaultActiveTabs", () => {
  it("returns an array of default tab IDs", () => {
    const defaults = getDefaultActiveTabs();
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults).toContain("agents");
    expect(defaults).toContain("system");
  });

  it("does not include non-default tabs", () => {
    const defaults = getDefaultActiveTabs();
    expect(defaults).not.toContain("settings");
    expect(defaults).not.toContain("tokens");
    expect(defaults).not.toContain("tasks");
  });
});

describe("VALID_TAB_IDS", () => {
  it("contains all expected tab IDs", () => {
    const expected: TabId[] = ["agents", "chat", "system", "graph", "tasks", "tokens", "settings", "connection", "skills"];
    for (const id of expected) {
      expect(VALID_TAB_IDS.has(id)).toBe(true);
    }
  });

  it("does not contain invalid IDs", () => {
    expect(VALID_TAB_IDS.has("unknown")).toBe(false);
    expect(VALID_TAB_IDS.has("")).toBe(false);
  });

  it("has 9 entries", () => {
    expect(VALID_TAB_IDS.size).toBe(9);
  });
});
