import { describe, expect, it, beforeEach } from "vitest";
import { VALID_TAB_IDS, getDefaultActiveTabs, type TabId } from "@/components/TabBar";

describe("tab persistence validation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const loadTabs = (): TabId[] => {
    try {
      const stored = localStorage.getItem("rocclaw-active-tabs");
      if (stored) {
        const parsed = JSON.parse(stored) as TabId[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id) => VALID_TAB_IDS.has(id));
          if (valid.length > 0) return valid;
        }
      }
    } catch { /* use defaults */ }
    return getDefaultActiveTabs();
  };

  it("returns defaults when localStorage is empty", () => {
    const tabs = loadTabs();
    expect(tabs).toEqual(getDefaultActiveTabs());
  });

  it("loads valid tabs from localStorage", () => {
    localStorage.setItem("rocclaw-active-tabs", JSON.stringify(["agents", "chat"]));
    const tabs = loadTabs();
    expect(tabs).toEqual(["agents", "chat"]);
  });

  it("filters out invalid tab IDs from localStorage", () => {
    localStorage.setItem("rocclaw-active-tabs", JSON.stringify(["agents", "nonexistent", "chat"]));
    const tabs = loadTabs();
    expect(tabs).toEqual(["agents", "chat"]);
    expect(tabs).not.toContain("nonexistent");
  });

  it("returns defaults when all stored IDs are invalid", () => {
    localStorage.setItem("rocclaw-active-tabs", JSON.stringify(["foo", "bar"]));
    const tabs = loadTabs();
    expect(tabs).toEqual(getDefaultActiveTabs());
  });

  it("returns defaults for malformed JSON", () => {
    localStorage.setItem("rocclaw-active-tabs", "not-json");
    const tabs = loadTabs();
    expect(tabs).toEqual(getDefaultActiveTabs());
  });

  it("returns defaults for empty array", () => {
    localStorage.setItem("rocclaw-active-tabs", "[]");
    const tabs = loadTabs();
    expect(tabs).toEqual(getDefaultActiveTabs());
  });

  it("returns defaults for non-array JSON", () => {
    localStorage.setItem("rocclaw-active-tabs", JSON.stringify({ agents: true }));
    const tabs = loadTabs();
    expect(tabs).toEqual(getDefaultActiveTabs());
  });

  it("preserves order from localStorage", () => {
    localStorage.setItem("rocclaw-active-tabs", JSON.stringify(["settings", "agents", "tokens"]));
    const tabs = loadTabs();
    expect(tabs).toEqual(["settings", "agents", "tokens"]);
  });
});
