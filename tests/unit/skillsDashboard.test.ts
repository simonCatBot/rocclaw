// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";

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

// Categories extracted from featured skills (used in component, not directly in tests)

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

// ─── Agent skill assignment logic ─────────────────────────────────────────

function toggleAgentSkill(
  assignments: Map<string, { explicit: boolean; skills: Set<string> }>,
  agentId: string,
  slug: string,
  assign: boolean
): Map<string, { explicit: boolean; skills: Set<string> }> {
  const next = new Map<string, { explicit: boolean; skills: Set<string> }>(assignments);
  const current = next.get(agentId) ?? { explicit: false, skills: new Set<string>() };
  const newSkills = new Set<string>(current.skills);
  const key = slug.toLowerCase();
  if (assign) {
    newSkills.add(key);
  } else {
    newSkills.delete(key);
  }
  next.set(agentId, { explicit: true, skills: newSkills });
  return next;
}

function getAssignedSkills(
  assignments: Map<string, { explicit: boolean; skills: Set<string> }>,
  agentId: string
): Set<string> {
  return new Set<string>(assignments.get(agentId)?.skills ?? []);
}

function parseAgentSkillConfig(
  agentList: Array<{ id?: string; agentId?: string; skills?: unknown; skillAllowlist?: unknown }>
): Map<string, { explicit: boolean; skills: Set<string> }> {
  const result = new Map<string, { explicit: boolean; skills: Set<string> }>();
  for (const agent of agentList) {
    const id = agent.id ?? agent.agentId ?? "";
    if (!id) continue;
    const agentSkills = agent.skills ?? agent.skillAllowlist;
    if (agentSkills !== undefined && agentSkills !== null) {
      const skillSet = new Set<string>();
      if (Array.isArray(agentSkills)) {
        for (const s of agentSkills) {
          if (typeof s === "string" && s.trim()) skillSet.add(s.trim().toLowerCase());
        }
      }
      result.set(id, { explicit: true, skills: skillSet });
    } else {
      result.set(id, { explicit: false, skills: new Set() });
    }
  }
  return result;
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

// Sample ClawHub search results (used by component, not directly in route tests)

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

describe("SkillsDashboard — fuzzy ClawHub to installed skill matching", () => {
  const installedNames = new Set(["gog", "proactive-agent", "github", "1password", "self-improving + proactive agent"]);

  function isInstalledFromClawhub(slug: string, displayName: string): boolean {
    const slugLc = slug.toLowerCase();
    const nameLc = displayName.toLowerCase();
    if (installedNames.has(slugLc) || installedNames.has(nameLc)) return true;
    const slugStem = slugLc.replace(/-v?[\d.]+$/, "");
    if (installedNames.has(slugStem)) return true;
    for (const installedName of installedNames) {
      const inParens = new RegExp(`[(\\[]${installedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[)\\]]`, "i");
      if (inParens.test(displayName)) return true;
    }
    return false;
  }

  it("matches exact slug", () => {
    expect(isInstalledFromClawhub("github", "GitHub")).toBe(true);
  });

  it("matches exact displayName", () => {
    expect(isInstalledFromClawhub("unknown-slug", "1password")).toBe(true);
  });

  it("matches ClawHub slug 'gog-v2' to installed 'gog' (version suffix stripped)", () => {
    expect(isInstalledFromClawhub("gog-v2", "Gog V2")).toBe(true);
  });

  it("matches ClawHub slug 'gog-v1.0' to installed 'gog' (semver suffix stripped)", () => {
    expect(isInstalledFromClawhub("gog-v1.0", "Gog")).toBe(true);
  });

  it("does NOT match 'gogcli' to installed 'gog' (different name, not a version suffix)", () => {
    expect(isInstalledFromClawhub("gogcli", "Gogcli")).toBe(false);
  });

  it("does NOT match 'gog-jasmine' to installed 'gog' (different skill, not a version suffix)", () => {
    expect(isInstalledFromClawhub("gog-jasmine", "Gog Jasmine")).toBe(false);
  });

  it("matches when displayName has installed name in parentheses", () => {
    expect(isInstalledFromClawhub("jx76-gog", "Google Workspace CLI (gog)")).toBe(true);
  });

  it("does NOT match unrelated skills", () => {
    expect(isInstalledFromClawhub("slack", "Slack Integration")).toBe(false);
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

describe("SkillsDashboard — agent skill assignments", () => {
  it("assigns a skill to an agent", () => {
    const initial = new Map<string, { explicit: boolean; skills: Set<string> }>();
    const result = toggleAgentSkill(initial, "oscar", "proactive-agent", true);
    expect(result.get("oscar")?.skills.has("proactive-agent")).toBe(true);
    expect(result.get("oscar")?.explicit).toBe(true);
  });

  it("removes a skill from an agent", () => {
    const initial = new Map<string, { explicit: boolean; skills: Set<string> }>();
    initial.set("oscar", { explicit: true, skills: new Set(["proactive-agent", "plan-first"]) });
    const result = toggleAgentSkill(initial, "oscar", "proactive-agent", false);
    expect(result.get("oscar")?.skills.has("proactive-agent")).toBe(false);
    expect(result.get("oscar")?.skills.has("plan-first")).toBe(true);
  });

  it("does not affect other agents when toggling", () => {
    const initial = new Map<string, { explicit: boolean; skills: Set<string> }>();
    initial.set("oscar", { explicit: true, skills: new Set(["proactive-agent"]) });
    initial.set("simon", { explicit: true, skills: new Set(["plan-first"]) });
    const result = toggleAgentSkill(initial, "oscar", "react-loop", true);
    expect(result.get("oscar")?.skills.has("react-loop")).toBe(true);
    expect(result.get("simon")?.skills.size).toBe(1);
  });

  it("returns empty set for unknown agent", () => {
    const initial = new Map<string, { explicit: boolean; skills: Set<string> }>();
    const result = getAssignedSkills(initial, "unknown");
    expect(result.size).toBe(0);
  });

  it("handles case-insensitive skill keys", () => {
    const initial = new Map<string, { explicit: boolean; skills: Set<string> }>();
    const result = toggleAgentSkill(initial, "oscar", "Proactive-Agent", true);
    expect(result.get("oscar")?.skills.has("proactive-agent")).toBe(true);
  });

  it("parses agent config with skills allowlist", () => {
    const config = [
      { id: "oscar", skills: ["proactive-agent", "plan-first"] },
      { id: "simon", skills: ["GitHub"] },
      { id: "dev" }, // no skills = all skills mode
    ];
    const result = parseAgentSkillConfig(config);
    expect(result.get("oscar")?.explicit).toBe(true);
    expect(result.get("oscar")?.skills.size).toBe(2);
    expect(result.get("oscar")?.skills.has("proactive-agent")).toBe(true);
    expect(result.get("simon")?.explicit).toBe(true);
    expect(result.get("simon")?.skills.has("github")).toBe(true);
    expect(result.get("dev")?.explicit).toBe(false);
    expect(result.get("dev")?.skills.size).toBe(0);
  });

  it("ignores invalid skills entries", () => {
    const config = [
      { id: "oscar", skills: ["valid", "", 123, null, "also-valid"] },
    ];
    const result = parseAgentSkillConfig(config);
    expect(result.get("oscar")?.skills.size).toBe(2);
    expect(result.get("oscar")?.skills.has("valid")).toBe(true);
    expect(result.get("oscar")?.skills.has("also-valid")).toBe(true);
  });
});