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
  it("renders all 9 tabs", () => {
    render(createElement(TabBar, buildProps()));
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(9);
  });

  it("marks active tabs with aria-selected=true", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents", "chat"] })));
    const tabs = screen.getAllByRole("tab");
    const agentsTab = tabs.find((t) => t.getAttribute("aria-label") === "Agents");
    const chatTab = tabs.find((t) => t.getAttribute("aria-label") === "Chat");
    const systemTab = tabs.find((t) => t.getAttribute("aria-label") === "System");
    expect(agentsTab).toHaveAttribute("aria-selected", "true");
    expect(chatTab).toHaveAttribute("aria-selected", "true");
    expect(systemTab).toHaveAttribute("aria-selected", "false");
  });

  it("calls onTabToggle when a tab is clicked", () => {
    const onTabToggle = vi.fn();
    render(createElement(TabBar, buildProps({ onTabToggle })));
    const tabs = screen.getAllByRole("tab");
    const settingsTab = tabs.find((t) => t.getAttribute("aria-label") === "Settings");
    fireEvent.click(settingsTab!);
    expect(onTabToggle).toHaveBeenCalledWith("settings");
  });

  it("has role=tablist on the container", () => {
    render(createElement(TabBar, buildProps()));
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("sets tabIndex=0 on active tabs and -1 on inactive", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents"] })));
    const tabs = screen.getAllByRole("tab");
    const agentsTab = tabs.find((t) => t.getAttribute("aria-label") === "Agents");
    const chatTab = tabs.find((t) => t.getAttribute("aria-label") === "Chat");
    expect(agentsTab).toHaveAttribute("tabindex", "0");
    expect(chatTab).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus on ArrowRight key", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["agents"] })));
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
  });

  it("wraps focus from last to first on ArrowRight", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["settings"] })));
    const tabs = screen.getAllByRole("tab");
    const lastTab = tabs[tabs.length - 1];
    lastTab.focus();
    fireEvent.keyDown(lastTab, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("moves focus on ArrowLeft key", () => {
    render(createElement(TabBar, buildProps({ activeTabs: ["chat"] })));
    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();
    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("jumps to first tab on Home key", () => {
    render(createElement(TabBar, buildProps()));
    const tabs = screen.getAllByRole("tab");
    tabs[4].focus();
    fireEvent.keyDown(tabs[4], { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("jumps to last tab on End key", () => {
    render(createElement(TabBar, buildProps()));
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);
  });

  it("wraps in a nav element", () => {
    render(createElement(TabBar, buildProps()));
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("has aria-label on the nav element", () => {
    render(createElement(TabBar, buildProps()));
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-label", "Dashboard navigation");
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
