// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect } from "vitest";

// ─── ClawHub search route logic ───────────────────────────────────────────

function buildSearchUrl(
  query: string,
  limit: number,
  registryBase: string = "https://clawhub.ai"
): string {
  const url = new URL("/api/v1/search", registryBase);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

function validateSearchQuery(query: string | null): string | null {
  if (!query || !query.trim()) return "Missing query";
  return null;
}

function clampLimit(raw: number | null, min = 1, max = 50): number {
  if (raw == null) return 20;
  return Math.min(max, Math.max(min, raw));
}

// ─── Skills route logic ───────────────────────────────────────────────────

function parseSkillListOutput(stdout: string): { skills: unknown[] } | null {
  try {
    const data = JSON.parse(stdout);
    if (Array.isArray(data.skills)) return data;
    if (Array.isArray(data)) return { skills: data };
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the JSON object from openclaw CLI output.
 * The CLI writes everything to stderr, including table + JSON.
 */
function extractJsonFromOutput(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to extraction
  }

  // Find the last top-level JSON object
  let lastBrace = text.lastIndexOf("{");
  while (lastBrace !== -1) {
    try {
      const candidate = text.substring(lastBrace);
      return JSON.parse(candidate);
    } catch {
      lastBrace = text.lastIndexOf("{", lastBrace - 1);
    }
  }

  throw new Error("No valid JSON found in openclaw output");
}

// ─── Install route logic ──────────────────────────────────────────────────

function validateInstallPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Invalid payload";
  const record = body as Record<string, unknown>;
  const slug = (record.slug ?? "").toString().trim();
  if (!slug) return "Missing slug";
  return null;
}

// ─── Agent skills assign route logic ──────────────────────────────────────

function validateAgentSkillsAssignPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Invalid payload";
  const record = body as Record<string, unknown>;
  const agentId = (record.agentId ?? "").toString().trim();
  if (!agentId) return "agentId is required.";
  if (!Array.isArray(record.skillAllowlist)) return "skillAllowlist must be an array of strings.";
  return null;
}

function sanitizeSkillAllowlist(raw: unknown[]): string[] {
  return raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

// ─── Config agent list operations ─────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function readConfigAgentList(config: Record<string, unknown>): Array<Record<string, unknown> & { id: string }> {
  const agents = isRecord(config.agents) ? config.agents : null;
  const list = Array.isArray(agents?.list) ? agents.list : [];
  return list.filter((entry): entry is Record<string, unknown> & { id: string } => {
    if (!isRecord(entry)) return false;
    if (typeof entry.id !== "string") return false;
    return entry.id.trim().length > 0;
  });
}

function upsertAgentSkillAllowlist(
  config: Record<string, unknown>,
  agentId: string,
  skillAllowlist: string[]
): Record<string, unknown> {
  const list = readConfigAgentList(config);
  let found = false;
  const nextList = list.map((entry) => {
    if (entry.id !== agentId) return entry;
    found = true;
    return { ...entry, skillAllowlist };
  });
  if (!found) {
    nextList.push({ id: agentId, skillAllowlist });
  }
  const agents = isRecord(config.agents) ? { ...config.agents } : {};
  return { ...config, agents: { ...agents, list: nextList } };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("ClawHub search route — URL building", () => {
  it("builds correct search URL with query and limit", () => {
    const url = buildSearchUrl("slack", 10);
    expect(url).toContain("q=slack");
    expect(url).toContain("limit=10");
    expect(url).toContain("clawhub.ai");
  });

  it("encodes special characters in query", () => {
    const url = buildSearchUrl("agent skills & tools", 20);
    expect(url).toContain("q=agent+skills");
  });
});

describe("ClawHub search route — validation", () => {
  it("rejects empty query", () => {
    expect(validateSearchQuery("")).toBe("Missing query");
    expect(validateSearchQuery(null)).toBe("Missing query");
    expect(validateSearchQuery("  ")).toBe("Missing query");
  });

  it("accepts valid query", () => {
    expect(validateSearchQuery("slack")).toBeNull();
  });
});

describe("ClawHub search route — limit clamping", () => {
  it("returns default when null", () => {
    expect(clampLimit(null)).toBe(20);
  });

  it("clamps to minimum 1", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });

  it("clamps to maximum 50", () => {
    expect(clampLimit(100)).toBe(50);
    expect(clampLimit(200)).toBe(50);
  });

  it("passes through valid values", () => {
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(25)).toBe(25);
  });
});

describe("Skills route — output parsing", () => {
  it("parses valid JSON with skills array", () => {
    const output = JSON.stringify({
      skills: [
        { name: "test", eligible: true, missing: { bins: [] } },
      ],
    });
    const result = parseSkillListOutput(output);
    expect(result).not.toBeNull();
    expect(result!.skills).toHaveLength(1);
  });

  it("parses array-only JSON", () => {
    const output = JSON.stringify([{ name: "test" }]);
    const result = parseSkillListOutput(output);
    expect(result).not.toBeNull();
    expect(result!.skills).toHaveLength(1);
  });

  it("returns null for invalid JSON", () => {
    const result = parseSkillListOutput("not json");
    expect(result).toBeNull();
  });

  it("returns null for JSON without skills key or array", () => {
    const result = parseSkillListOutput(JSON.stringify({ foo: "bar" }));
    expect(result).toBeNull();
  });
});

describe("Skills route — JSON extraction from CLI output", () => {
  it("extracts JSON from pure JSON output", () => {
    const data = { skills: [{ name: "test" }] };
    const result = extractJsonFromOutput(JSON.stringify(data));
    expect(result).toEqual(data);
  });

  it("extracts JSON from mixed stderr output (table + JSON)", () => {
    const tableOutput = "Skills (26/69 ready)\n┌───────────┐\n│ test      │\n└───────────┘\n";
    const jsonData = { skills: [{ name: "proactive-agent", eligible: true }] };
    const mixed = tableOutput + JSON.stringify(jsonData);
    const result = extractJsonFromOutput(mixed) as { skills: unknown[] };
    expect(result.skills).toHaveLength(1);
  });

  it("extracts JSON when JSON appears after table with progress chars", () => {
    const prefix = "- Loading skills\n✓ Ready\n";
    const jsonData = { skills: [{ name: "github" }] };
    const mixed = prefix + JSON.stringify(jsonData);
    const result = extractJsonFromOutput(mixed) as { skills: unknown[] };
    expect(result.skills).toHaveLength(1);
  });

  it("extracts JSON from complex nested output", () => {
    const output = `Some table output here
with multiple lines
and { braces in text }
then the real JSON: {"workspaceDir":"/home/test","skills":[{"name":"test"}]}`;
    const result = extractJsonFromOutput(output) as { skills: unknown[] };
    expect(result.skills).toHaveLength(1);
  });

  it("throws when no JSON is found", () => {
    expect(() => extractJsonFromOutput("no json here")).toThrow("No valid JSON found");
  });
});

describe("Install route — payload validation", () => {
  it("rejects missing slug", () => {
    expect(validateInstallPayload({})).toBe("Missing slug");
    expect(validateInstallPayload({ slug: "" })).toBe("Missing slug");
    expect(validateInstallPayload({ slug: "   " })).toBe("Missing slug");
  });

  it("accepts valid slug", () => {
    expect(validateInstallPayload({ slug: "slack" })).toBeNull();
  });

  it("rejects non-object payload", () => {
    expect(validateInstallPayload(null)).toBe("Invalid payload");
    expect(validateInstallPayload("string")).toBe("Invalid payload");
  });
});

describe("Agent skills assign route — payload validation", () => {
  it("rejects missing agentId", () => {
    expect(validateAgentSkillsAssignPayload({ skillAllowlist: [] })).toBe("agentId is required.");
    expect(validateAgentSkillsAssignPayload({ agentId: "", skillAllowlist: [] })).toBe("agentId is required.");
  });

  it("rejects missing skillAllowlist", () => {
    expect(validateAgentSkillsAssignPayload({ agentId: "oscar" })).toBe("skillAllowlist must be an array of strings.");
    expect(validateAgentSkillsAssignPayload({ agentId: "oscar", skillAllowlist: "not-array" })).toBe("skillAllowlist must be an array of strings.");
  });

  it("accepts valid payload", () => {
    expect(validateAgentSkillsAssignPayload({ agentId: "oscar", skillAllowlist: ["proactive-agent"] })).toBeNull();
  });

  it("accepts empty skillAllowlist (means no skills)", () => {
    expect(validateAgentSkillsAssignPayload({ agentId: "oscar", skillAllowlist: [] })).toBeNull();
  });
});

describe("Agent skills assign route — skill sanitization", () => {
  it("filters out empty and non-string entries", () => {
    expect(sanitizeSkillAllowlist(["valid", "", 123, null as unknown as string, "also-valid"] as unknown[])).toEqual(["valid", "also-valid"]);
  });

  it("returns empty array for all-invalid input", () => {
    expect(sanitizeSkillAllowlist(["", "  ", 0, false as unknown as string] as unknown[])).toEqual([]);
  });
});

describe("Agent skills assign route — config upsert", () => {
  const baseConfig = {
    agents: {
      list: [
        { id: "oscar", name: "Oscar" },
        { id: "simon", name: "Simon", skillAllowlist: ["old-skill"] },
      ],
    },
  };

  it("adds skillAllowlist to existing agent without one", () => {
    const result = upsertAgentSkillAllowlist(baseConfig, "oscar", ["proactive-agent"]);
    const list = (result.agents as Record<string, unknown>).list as Array<Record<string, unknown>>;
    const oscar = list.find((a) => a.id === "oscar");
    expect(oscar?.skillAllowlist).toEqual(["proactive-agent"]);
  });

  it("replaces skillAllowlist on existing agent with one", () => {
    const result = upsertAgentSkillAllowlist(baseConfig, "simon", ["new-skill"]);
    const list = (result.agents as Record<string, unknown>).list as Array<Record<string, unknown>>;
    const simon = list.find((a) => a.id === "simon");
    expect(simon?.skillAllowlist).toEqual(["new-skill"]);
  });

  it("adds new agent entry if not found", () => {
    const result = upsertAgentSkillAllowlist(baseConfig, "new-agent", ["skill1"]);
    const list = (result.agents as Record<string, unknown>).list as Array<Record<string, unknown>>;
    expect(list).toHaveLength(3);
    const newAgent = list.find((a) => a.id === "new-agent");
    expect(newAgent?.skillAllowlist).toEqual(["skill1"]);
  });

  it("preserves other agents unchanged", () => {
    const result = upsertAgentSkillAllowlist(baseConfig, "oscar", ["test"]);
    const list = (result.agents as Record<string, unknown>).list as Array<Record<string, unknown>>;
    const simon = list.find((a) => a.id === "simon");
    expect(simon?.skillAllowlist).toEqual(["old-skill"]);
  });
});