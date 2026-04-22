// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import { describe, it, expect, vi, beforeEach } from "vitest";

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

// ─── Install route logic ──────────────────────────────────────────────────

function validateInstallPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Invalid payload";
  const record = body as Record<string, unknown>;
  const slug = (record.slug ?? "").toString().trim();
  if (!slug) return "Missing slug";
  return null;
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