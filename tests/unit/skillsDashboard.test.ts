// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Types ────────────────────────────────────────────────────────────────

interface InstalledSkill {
  name: string;
  description: string;
  emoji: string;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
  homepage?: string;
  missing: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
}

interface ClawHubSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary: string;
  version: string | null;
  updatedAt: number;
}

// ─── Feature data ─────────────────────────────────────────────────────────

const FEATURED_SKILLS = [
  {
    slug: "proactive-agent",
    name: "Proactive Agent",
    emoji: "🦞",
    description: "Transform AI agents from task-followers into proactive partners.",
    category: "Agent Behavior",
  },
  {
    slug: "plan-first",
    name: "Plan First",
    emoji: "📋",
    description: "Solve complex multi-step tasks by generating a detailed plan.",
    category: "Problem Solving",
  },
  {
    slug: "team-code",
    name: "Team Code",
    emoji: "👨‍💻",
    description: "Coordinate multiple AI agents as a development team.",
    category: "Development",
  },
  {
    slug: "agent-debate",
    name: "Agent Debate",
    emoji: "⚖️",
    description: "Verify facts, reduce hallucinations through structured debate.",
    category: "Quality & Accuracy",
  },
];

const CATEGORIES = [...new Set(FEATURED_SKILLS.map((s) => s.category))];

// ─── Filter logic ─────────────────────────────────────────────────────────

function filterInstalledSkills(
  skills: InstalledSkill[],
  statusFilter: "all" | "ready" | "needs-setup",
  searchQuery: string
): InstalledSkill[] {
  let filtered = skills;
  if (statusFilter === "ready") filtered = filtered.filter((s) => s.eligible);
  if (statusFilter === "needs-setup") filtered = filtered.filter((s) => !s.eligible);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }
  return filtered;
}

function filterFeaturedSkills(
  skills: typeof FEATURED_SKILLS,
  selectedCategory: string | null
): typeof FEATURED_SKILLS {
  if (!selectedCategory) return skills;
  return skills.filter((s) => s.category === selectedCategory);
}

function isSkillInstalled(installedNames: Set<string>, slugOrName: string): boolean {
  return installedNames.has(slugOrName.toLowerCase());
}

function computeInstalledNames(skills: InstalledSkill[]): Set<string> {
  return new Set(skills.map((s) => s.name.toLowerCase()));
}

// ─── Sample data ──────────────────────────────────────────────────────────

const SAMPLE_INSTALLED: InstalledSkill[] = [
  {
    name: "proactive-agent",
    description: "Proactive agent skill",
    emoji: "🦞",
    eligible: true,
    disabled: false,
    blockedByAllowlist: false,
    source: "openclaw-bundled",
    bundled: true,
    missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
  },
  {
    name: "1password",
    description: "1Password CLI integration",
    emoji: "🔐",
    eligible: false,
    disabled: false,
    blockedByAllowlist: false,
    source: "openclaw-bundled",
    bundled: true,
    missing: { bins: ["op"], anyBins: [], env: [], config: [], os: [] },
  },
  {
    name: "github",
    description: "GitHub operations via gh CLI",
    emoji: "🐙",
    eligible: true,
    disabled: false,
    blockedByAllowlist: false,
    source: "openclaw-bundled",
    bundled: true,
    missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
  },
];

const SAMPLE_SEARCH_RESULTS: ClawHubSearchResult[] = [
  {
    score: 3.5,
    slug: "slack",
    displayName: "Slack",
    summary: "Control Slack from Clawdbot via the slack tool.",
    version: null,
    updatedAt: Date.now() - 86400000,
  },
  {
    score: 3.2,
    slug: "tmux",
    displayName: "Tmux",
    summary: "Remote-control tmux sessions.",
    version: null,
    updatedAt: Date.now() - 172800000,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────

describe("SkillsDashboard — filter logic", () => {
  it("returns all skills with 'all' filter", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "all", "");
    expect(result).toHaveLength(3);
  });

  it("filters to only ready skills", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "ready", "");
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.eligible)).toBe(true);
  });

  it("filters to only needs-setup skills", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "needs-setup", "");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("1password");
  });

  it("filters by search query matching name", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "all", "github");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("github");
  });

  it("filters by search query matching description", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "all", "password");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("1password");
  });

  it("combines status filter with search query", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "ready", "git");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("github");
  });

  it("returns empty when no match", () => {
    const result = filterInstalledSkills(SAMPLE_INSTALLED, "all", "nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("SkillsDashboard — featured skills filter", () => {
  it("returns all featured with no category filter", () => {
    const result = filterFeaturedSkills(FEATURED_SKILLS, null);
    expect(result).toHaveLength(4);
  });

  it("filters by category", () => {
    const result = filterFeaturedSkills(FEATURED_SKILLS, "Agent Behavior");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("proactive-agent");
  });

  it("returns empty for unknown category", () => {
    const result = filterFeaturedSkills(FEATURED_SKILLS, "Nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("SkillsDashboard — installed name matching", () => {
  it("builds lowercase name set from installed skills", () => {
    const names = computeInstalledNames(SAMPLE_INSTALLED);
    expect(names.has("proactive-agent")).toBe(true);
    expect(names.has("1password")).toBe(true);
    expect(names.has("github")).toBe(true);
    expect(names.has("slack")).toBe(false);
  });

  it("matches slug case-insensitively", () => {
    const names = computeInstalledNames(SAMPLE_INSTALLED);
    expect(isSkillInstalled(names, "Proactive-Agent")).toBe(true);
    expect(isSkillInstalled(names, "GITHUB")).toBe(true);
    expect(isSkillInstalled(names, "slack")).toBe(false);
  });
});

describe("SkillsDashboard — categories extraction", () => {
  it("extracts unique categories from featured skills", () => {
    const categories = [...new Set(FEATURED_SKILLS.map((s) => s.category))];
    expect(categories).toContain("Agent Behavior");
    expect(categories).toContain("Problem Solving");
    expect(categories).toContain("Development");
    expect(categories).toContain("Quality & Accuracy");
    expect(categories).toHaveLength(4);
  });
});

describe("SkillsDashboard — ready/needs-setup counts", () => {
  it("counts ready and needs-setup skills correctly", () => {
    const readyCount = SAMPLE_INSTALLED.filter((s) => s.eligible).length;
    const needsSetupCount = SAMPLE_INSTALLED.filter((s) => !s.eligible).length;
    expect(readyCount).toBe(2);
    expect(needsSetupCount).toBe(1);
  });
});