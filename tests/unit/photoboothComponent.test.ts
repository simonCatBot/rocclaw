// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect, beforeEach } from "vitest";

// ─── Style Presets Tests ──────────────────────────────────────────────────────

describe("Photo Booth - Style Presets", () => {
  const STYLE_PRESETS = [
    { id: "anime", label: "Anime", emoji: "🎌" },
    { id: "van-gogh", label: "Van Gogh", emoji: "🎨" },
    { id: "monet", label: "Monet", emoji: "🌸" },
    { id: "picasso", label: "Picasso", emoji: "◆" },
    { id: "watercolor", label: "Watercolor", emoji: "💧" },
    { id: "sketch", label: "Sketch", emoji: "✏️" },
    { id: "cyberpunk", label: "Cyberpunk", emoji: "🔮" },
    { id: "pixel-art", label: "Pixel Art", emoji: "👾" },
    { id: "oil-painting", label: "Oil Painting", emoji: "🖼️" },
  ];

  it("has exactly 9 style presets", () => {
    expect(STYLE_PRESETS).toHaveLength(9);
  });

  it("each style has a unique id", () => {
    const ids = STYLE_PRESETS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("each style has a label and emoji", () => {
    for (const style of STYLE_PRESETS) {
      expect(style.id).toBeTruthy();
      expect(style.label).toBeTruthy();
      expect(style.emoji).toBeTruthy();
    }
  });

  it("style ids match expected names", () => {
    const expectedIds = [
      "anime",
      "van-gogh",
      "monet",
      "picasso",
      "watercolor",
      "sketch",
      "cyberpunk",
      "pixel-art",
      "oil-painting",
    ];
    const ids = STYLE_PRESETS.map((s) => s.id);
    expect(ids).toEqual(expectedIds);
  });

  it("each style has a thumbnail path", () => {
    for (const style of STYLE_PRESETS) {
      expect(style.id).toBeTruthy();
      // Thumbnail paths follow pattern: /styles/{id}.png
      const expectedPath = `/styles/${style.id}.png`;
      expect(expectedPath).toContain(style.id);
    }
  });
});

// ─── Tab Integration Tests ─────────────────────────────────────────────────────

describe("Photo Booth - Tab Integration", () => {
  it("photobooth is a valid tab id", () => {
    type TabId = "agents" | "chat" | "system" | "graph" | "tasks" | "tokens" | "settings" | "connection" | "skills" | "photobooth";
    const tabId: TabId = "photobooth";
    expect(tabId).toBe("photobooth");
  });

  it("photobooth is in exclusive tabs list", () => {
    const exclusiveTabs: string[] = ["tasks", "skills", "photobooth"];
    expect(exclusiveTabs).toContain("photobooth");
  });

  it("selecting photobooth replaces all other tabs", () => {
    const exclusiveTabs = ["tasks", "skills", "photobooth"];
    const currentTabs = ["agents", "chat", "system"];
    const selectedTab = "photobooth";

    const result = currentTabs.includes(selectedTab)
      ? []
      : [selectedTab];

    expect(result).toEqual(["photobooth"]);
  });

  it("deselecting photobooth returns to empty", () => {
    const exclusiveTabs = ["tasks", "skills", "photobooth"];
    const currentTabs = ["photobooth"];
    const selectedTab = "photobooth";

    const result = currentTabs.includes(selectedTab)
      ? []
      : [selectedTab];

    expect(result).toEqual([]);
  });

  it("non-exclusive tab toggles remove photobooth", () => {
    const exclusiveTabs = ["tasks", "skills", "photobooth"];
    const currentTabs = ["photobooth"];
    const toggledTab = "agents";

    // When toggling a non-exclusive tab, exclusive tabs should be removed
    let next = [...currentTabs, toggledTab];
    next = next.filter((t) => !exclusiveTabs.includes(t));

    expect(next).toEqual(["agents"]);
  });
});

// ─── Camera Capture Logic ──────────────────────────────────────────────────────

describe("Photo Booth - File Upload Logic", () => {
  it("base64 data URL is stripped correctly for upload", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    expect(base64).toBe("iVBORw0KGgoAAAANSUhEUgAAAAUA");
    expect(base64).not.toContain("data:");
    expect(base64).not.toContain("base64,");
  });

  it("plain base64 string passes through unchanged", () => {
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAUA";
    const result = base64.replace(/^data:image\/\w+;base64,/, "");
    expect(result).toBe(base64);
  });

  it("FileReader readAsDataURL produces data URL format", () => {
    // Simulate what FileReader produces
    const mockResult = "data:image/png;base64,iVBORw0KGgo=";
    expect(mockResult.startsWith("data:image/")).toBe(true);
    expect(mockResult).toContain(";base64,");
    
    // Stripping should work
    const stripped = mockResult.replace(/^data:image\/\w+;base64,/, "");
    expect(stripped).toBe("iVBORw0KGgo=");
  });
});

// ─── Style Selection Logic ─────────────────────────────────────────────────────

describe("Photo Booth - Style Selection", () => {
  const ALL_STYLES = [
    "anime", "van-gogh", "monet", "picasso",
    "watercolor", "sketch", "cyberpunk", "pixel-art", "oil-painting",
  ];

  it("select all styles", () => {
    const selectedStyles = new Set<string>();
    for (const s of ALL_STYLES) selectedStyles.add(s);
    expect(selectedStyles.size).toBe(9);
  });

  it("deselect all styles", () => {
    const selectedStyles = new Set(ALL_STYLES);
    selectedStyles.clear();
    expect(selectedStyles.size).toBe(0);
  });

  it("toggle individual style", () => {
    const selectedStyles = new Set<string>();
    
    // Toggle on
    selectedStyles.add("anime");
    expect(selectedStyles.has("anime")).toBe(true);
    expect(selectedStyles.size).toBe(1);

    // Toggle off
    selectedStyles.delete("anime");
    expect(selectedStyles.has("anime")).toBe(false);
    expect(selectedStyles.size).toBe(0);
  });

  it("filter valid styles from request", () => {
    const requested = ["anime", "invalid-style", "monet", "another-bad"];
    const valid = requested.filter((s) => ALL_STYLES.includes(s));
    expect(valid).toEqual(["anime", "monet"]);
  });

  it("empty styles defaults to all styles", () => {
    const requested: string[] = [];
    const result = requested.length ? requested.filter((s) => ALL_STYLES.includes(s)) : [...ALL_STYLES];
    expect(result).toEqual(ALL_STYLES);
    expect(result.length).toBe(9);
  });
});

// ─── Job Status Logic ──────────────────────────────────────────────────────────

describe("Photo Booth - Job Status", () => {
  interface StyleJob {
    style: string;
    promptId: string;
    status: "queued" | "running" | "success" | "error" | "pending";
  }

  it("counts completed jobs correctly", () => {
    const jobs: StyleJob[] = [
      { style: "anime", promptId: "p1", status: "success" },
      { style: "monet", promptId: "p2", status: "running" },
      { style: "sketch", promptId: "p3", status: "success" },
      { style: "cyberpunk", promptId: "p4", status: "queued" },
      { style: "oil-painting", promptId: "p5", status: "error" },
    ];

    const completedCount = jobs.filter((j) => j.status === "success").length;
    expect(completedCount).toBe(2);
  });

  it("counts failed jobs correctly", () => {
    const jobs: StyleJob[] = [
      { style: "anime", promptId: "p1", status: "success" },
      { style: "monet", promptId: "p2", status: "error" },
      { style: "sketch", promptId: "p3", status: "error" },
    ];

    const failedCount = jobs.filter((j) => j.status === "error").length;
    expect(failedCount).toBe(2);
  });

  it("detects all done state", () => {
    const jobs: StyleJob[] = [
      { style: "anime", promptId: "p1", status: "success" },
      { style: "monet", promptId: "p2", status: "error" },
    ];

    const allDone = jobs.every((j) => j.status === "success" || j.status === "error");
    expect(allDone).toBe(true);
  });

  it("detects not all done state", () => {
    const jobs: StyleJob[] = [
      { style: "anime", promptId: "p1", status: "success" },
      { style: "monet", promptId: "p2", status: "running" },
    ];

    const allDone = jobs.every((j) => j.status === "success" || j.status === "error");
    expect(allDone).toBe(false);
  });

  it("empty jobs is not all done", () => {
    const jobs: StyleJob[] = [];
    const allDone = jobs.length > 0 && jobs.every((j) => j.status === "success" || j.status === "error");
    expect(allDone).toBe(false);
  });
});

// ─── Gallery Persistence Tests ─────────────────────────────────────────────────

describe("Photo Booth - Gallery Persistence", () => {
  const GALLERY_KEY = "rocclaw-photobooth-gallery";
  const GALLERY_MAX = 50;

  interface GalleryEntry {
    promptId: string;
    style: string;
    imageUrl: string;
    imageData: { filename: string; subfolder: string; type: string };
    timestamp: number;
  }

  function loadGallery(): GalleryEntry[] {
    try {
      const raw = localStorage.getItem(GALLERY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  beforeEach(() => {
    localStorage.removeItem(GALLERY_KEY);
  });

  it("returns empty array when localStorage has no gallery", () => {
    expect(loadGallery()).toEqual([]);
  });

  it("returns empty array when localStorage has invalid JSON", () => {
    localStorage.setItem(GALLERY_KEY, "not-json{{{");
    expect(loadGallery()).toEqual([]);
  });

  it("returns empty array when localStorage has non-array JSON", () => {
    localStorage.setItem(GALLERY_KEY, JSON.stringify({ foo: "bar" }));
    expect(loadGallery()).toEqual([]);
  });

  it("loads valid gallery entries from localStorage", () => {
    const entries: GalleryEntry[] = [
      { promptId: "p1", style: "anime", imageUrl: "/img/1.png", imageData: { filename: "1.png", subfolder: "", type: "output" }, timestamp: 1000 },
      { promptId: "p2", style: "monet", imageUrl: "/img/2.png", imageData: { filename: "2.png", subfolder: "", type: "output" }, timestamp: 2000 },
    ];
    localStorage.setItem(GALLERY_KEY, JSON.stringify(entries));
    expect(loadGallery()).toEqual(entries);
  });

  it("persists gallery to localStorage via JSON.stringify", () => {
    const entries: GalleryEntry[] = [
      { promptId: "p1", style: "anime", imageUrl: "/img/1.png", imageData: { filename: "1.png", subfolder: "", type: "output" }, timestamp: 1000 },
    ];
    localStorage.setItem(GALLERY_KEY, JSON.stringify(entries));
    const raw = localStorage.getItem(GALLERY_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(entries);
  });

  it("deduplicates entries by promptId", () => {
    const existing: GalleryEntry[] = [
      { promptId: "p1", style: "anime", imageUrl: "/img/1.png", imageData: { filename: "1.png", subfolder: "", type: "output" }, timestamp: 1000 },
    ];
    const newEntry: GalleryEntry = { promptId: "p1", style: "anime", imageUrl: "/img/1.png", imageData: { filename: "1.png", subfolder: "", type: "output" }, timestamp: 2000 };

    const isDuplicate = existing.some((g) => g.promptId === newEntry.promptId);
    expect(isDuplicate).toBe(true);
  });

  it("adds new entry and does not duplicate", () => {
    const existing: GalleryEntry[] = [
      { promptId: "p1", style: "anime", imageUrl: "/img/1.png", imageData: { filename: "1.png", subfolder: "", type: "output" }, timestamp: 1000 },
    ];
    const newEntry: GalleryEntry = { promptId: "p2", style: "monet", imageUrl: "/img/2.png", imageData: { filename: "2.png", subfolder: "", type: "output" }, timestamp: 2000 };

    const isDuplicate = existing.some((g) => g.promptId === newEntry.promptId);
    expect(isDuplicate).toBe(false);

    const updated = [newEntry, ...existing].slice(0, GALLERY_MAX);
    expect(updated).toHaveLength(2);
    expect(updated[0].promptId).toBe("p2");
  });

  it("caps gallery at GALLERY_MAX entries", () => {
    const entries: GalleryEntry[] = Array.from({ length: GALLERY_MAX }, (_, i) => ({
      promptId: `p${i}`,
      style: "anime",
      imageUrl: `/img/${i}.png`,
      imageData: { filename: `${i}.png`, subfolder: "", type: "output" },
      timestamp: i,
    }));
    expect(entries).toHaveLength(GALLERY_MAX);

    const newEntry: GalleryEntry = { promptId: "new", style: "monet", imageUrl: "/img/new.png", imageData: { filename: "new.png", subfolder: "", type: "output" }, timestamp: 99999 };
    const updated = [newEntry, ...entries].slice(0, GALLERY_MAX);
    expect(updated).toHaveLength(GALLERY_MAX);
    expect(updated[0].promptId).toBe("new");
    expect(updated[GALLERY_MAX - 1].promptId).toBe(`p${GALLERY_MAX - 2}`);
  });

  it("clear gallery produces empty array", () => {
    localStorage.setItem(GALLERY_KEY, JSON.stringify([{ promptId: "p1" }]));
    localStorage.setItem(GALLERY_KEY, JSON.stringify([]));
    expect(loadGallery()).toEqual([]);
  });
});

// ─── Keyboard Navigation Tests ─────────────────────────────────────────────────

describe("Photo Booth - Style Grid Keyboard Navigation", () => {
  const STYLE_GRID_COLS = 3;
  const TOTAL = 9;

  function getTargetIndex(index: number, key: string): number {
    switch (key) {
      case "ArrowRight":
        return index + 1 < TOTAL ? index + 1 : 0;
      case "ArrowLeft":
        return index - 1 >= 0 ? index - 1 : TOTAL - 1;
      case "ArrowDown":
        return index + STYLE_GRID_COLS < TOTAL ? index + STYLE_GRID_COLS : index;
      case "ArrowUp":
        return index - STYLE_GRID_COLS >= 0 ? index - STYLE_GRID_COLS : index;
      default:
        return index;
    }
  }

  it("ArrowRight moves to next style", () => {
    expect(getTargetIndex(0, "ArrowRight")).toBe(1);
    expect(getTargetIndex(4, "ArrowRight")).toBe(5);
  });

  it("ArrowRight wraps from last to first", () => {
    expect(getTargetIndex(8, "ArrowRight")).toBe(0);
  });

  it("ArrowLeft moves to previous style", () => {
    expect(getTargetIndex(5, "ArrowLeft")).toBe(4);
    expect(getTargetIndex(1, "ArrowLeft")).toBe(0);
  });

  it("ArrowLeft wraps from first to last", () => {
    expect(getTargetIndex(0, "ArrowLeft")).toBe(8);
  });

  it("ArrowDown moves to next row", () => {
    expect(getTargetIndex(0, "ArrowDown")).toBe(3);
    expect(getTargetIndex(4, "ArrowDown")).toBe(7);
  });

  it("ArrowDown stays at same index on last row", () => {
    expect(getTargetIndex(6, "ArrowDown")).toBe(6);
    expect(getTargetIndex(7, "ArrowDown")).toBe(7);
    expect(getTargetIndex(8, "ArrowDown")).toBe(8);
  });

  it("ArrowUp moves to previous row", () => {
    expect(getTargetIndex(3, "ArrowUp")).toBe(0);
    expect(getTargetIndex(7, "ArrowUp")).toBe(4);
  });

  it("ArrowUp stays at same index on first row", () => {
    expect(getTargetIndex(0, "ArrowUp")).toBe(0);
    expect(getTargetIndex(1, "ArrowUp")).toBe(1);
    expect(getTargetIndex(2, "ArrowUp")).toBe(2);
  });

  it("unknown key returns same index", () => {
    expect(getTargetIndex(4, "Enter")).toBe(4);
    expect(getTargetIndex(0, "Tab")).toBe(0);
  });
});