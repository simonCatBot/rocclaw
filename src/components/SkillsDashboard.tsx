// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader,
  Sparkles,
  Package,
  RefreshCw,
  ExternalLink,
  Users,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Zap,
} from "lucide-react";
import { useAgentStore } from "@/features/agents/state/store";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ClawHubSkillDetail {
  skill: {
    slug: string;
    displayName: string;
    summary: string;
    tags: Record<string, string>;
    stats: {
      comments: number;
      downloads: number;
      installsAllTime: number;
      installsCurrent: number;
      stars: number;
      versions: number;
    };
    createdAt: number;
    updatedAt: number;
  };
  owner: {
    handle: string;
    displayName: string;
    image: string;
  };
}

// ─── Featured / Preset Skills ─────────────────────────────────────────────────

const FEATURED_SKILLS: {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
}[] = [
  {
    slug: "proactive-agent",
    name: "Proactive Agent",
    emoji: "🦞",
    description:
      "Transform AI agents from task-followers into proactive partners that anticipate needs and continuously improve. Includes WAL Protocol, Working Buffer, and Autonomous Crons.",
    category: "Agent Behavior",
  },
  {
    slug: "Self-Improving + Proactive Agent",
    name: "Self-Improving Agent",
    emoji: "🔄",
    description:
      "Self-reflection + Self-criticism + Self-learning + Self-organizing memory. Agent evaluates its own work, catches mistakes, and improves permanently.",
    category: "Agent Behavior",
  },
  {
    slug: "plan-first",
    name: "Plan First",
    emoji: "📋",
    description:
      "Solve complex multi-step tasks by generating a detailed plan before execution. Based on Plan-and-Solve research — breaks tasks into clear steps and validates the approach.",
    category: "Problem Solving",
  },
  {
    slug: "react-loop",
    name: "ReAct Loop",
    emoji: "🔁",
    description:
      "Solve complex problems by interleaving reasoning with actions. Based on ReAct research — alternates between thinking and acting, observing results to inform next steps.",
    category: "Problem Solving",
  },
  {
    slug: "agent-debate",
    name: "Agent Debate",
    emoji: "⚖️",
    description:
      "Verify facts, reduce hallucinations, and explore multiple viewpoints through structured multi-agent debate. Multiple agents independently answer, then critique and refine.",
    category: "Quality & Accuracy",
  },
  {
    slug: "self-critique",
    name: "Self-Critique",
    emoji: "🔍",
    description:
      "Improve output quality through structured self-review before finalizing. Based on Constitutional AI — creates a feedback loop where you critique your own work against quality criteria.",
    category: "Quality & Accuracy",
  },
  {
    slug: "team-code",
    name: "Team Code",
    emoji: "👨‍💻",
    description:
      "Coordinate multiple AI agents as a development team to tackle complex coding projects faster. Like having a team of engineers working in parallel on different parts of your codebase.",
    category: "Development",
  },
  {
    slug: "skill-creator",
    name: "Skill Creator",
    emoji: "🛠️",
    description:
      "Create, edit, improve, or audit AgentSkills. Build new skills from scratch or improve existing ones. Validates against the AgentSkills spec.",
    category: "Development",
  },
  {
    slug: "agent-team-orchestration",
    name: "Agent Team Orchestration",
    emoji: "🎯",
    description:
      "Orchestrate multi-agent teams with defined roles, task lifecycles, handoff protocols, and review workflows.",
    category: "Multi-Agent",
  },
  {
    slug: "multi-agent-collaboration",
    name: "Multi-Agent Collaboration",
    emoji: "🤝",
    description:
      "Universal multi-agent collaboration system with intent recognition, intelligent routing, reflection mechanisms, and user adaptation.",
    category: "Multi-Agent",
  },
  {
    slug: "github",
    name: "GitHub",
    emoji: "🐙",
    description:
      "GitHub operations via gh CLI: issues, PRs, CI runs, code review, API queries. Essential for any development workflow.",
    category: "Development",
  },
  {
    slug: "git-workflows",
    name: "Git Workflows",
    emoji: "🔀",
    description:
      "Advanced git operations: rebasing, bisecting, worktrees, reflog recovery, subtrees/submodules, merge conflicts, cherry-picking.",
    category: "Development",
  },
];

const CATEGORIES = [...new Set(FEATURED_SKILLS.map((s) => s.category))];

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  accent,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-1 py-1 text-left hover:opacity-80"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span
          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${accent}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {title}
        </span>
        {!open && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded bg-surface-2 px-1 font-mono text-[10px] text-muted-foreground">
            {count}
          </span>
        )}
      </button>
      {open ? children : null}
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function SkillStatusBadge({ eligible, missing }: { eligible: boolean; missing: InstalledSkill["missing"] }) {
  if (eligible) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
        <CheckCircle className="h-3 w-3" />
        Ready
      </span>
    );
  }

  const blockers: string[] = [];
  if (missing.bins.length > 0) blockers.push(missing.bins.join(", "));
  if (missing.anyBins.length > 0) blockers.push(`any of: ${missing.anyBins.join(", ")}`);
  if (missing.env.length > 0) blockers.push(missing.env.join(", "));
  if (missing.os.length > 0) blockers.push(missing.os.join(", "));

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
      title={blockers.length > 0 ? `Missing: ${blockers.join("; ")}` : "Needs setup"}
    >
      <AlertTriangle className="h-3 w-3" />
      Needs Setup
    </span>
  );
}

// ─── Installed Skill Card ─────────────────────────────────────────────────────

function InstalledSkillCard({ skill, compact }: { skill: InstalledSkill; compact: boolean }) {
  return (
    <div className="group rounded-xl border border-border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30">
      <div className="mb-2 flex items-start gap-2">
        <span className="text-lg" role="img" aria-label={skill.name}>
          {skill.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{skill.name}</p>
            <SkillStatusBadge eligible={skill.eligible} missing={skill.missing} />
          </div>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded bg-surface-2 px-1.5 py-0.5">{skill.source}</span>
            {skill.bundled && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">bundled</span>
            )}
            {skill.homepage && (
              <a
                href={skill.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Featured Skill Card ──────────────────────────────────────────────────────

function FeaturedSkillCard({
  skill,
  isInstalled,
  installing,
  onInstall,
  compact,
}: {
  skill: (typeof FEATURED_SKILLS)[number];
  isInstalled: boolean;
  installing: boolean;
  onInstall: (slug: string) => void;
  compact: boolean;
}) {
  return (
    <div className="group rounded-xl border border-border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30">
      <div className="mb-2 flex items-start gap-2">
        <span className="text-lg" role="img" aria-label={skill.name}>
          {skill.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{skill.name}</p>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {skill.category}
            </span>
          </div>
          {!compact && (
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
              {skill.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isInstalled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
            <CheckCircle className="h-3 w-3" />
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(skill.slug)}
            disabled={installing}
            className="inline-flex items-center gap-1 rounded-md bg-primary/90 px-2.5 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary disabled:opacity-50"
          >
            {installing ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Install
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ClawHub Search Result Card ───────────────────────────────────────────────

function ClawHubResultCard({
  result,
  isInstalled,
  installing,
  onInstall,
  compact,
}: {
  result: ClawHubSearchResult;
  isInstalled: boolean;
  installing: boolean;
  onInstall: (slug: string) => void;
  compact: boolean;
}) {
  const timeAgo = useMemo(() => {
    const diff = Date.now() - result.updatedAt;
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }, [result.updatedAt]);

  return (
    <div className="group rounded-xl border border-border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30">
      <div className="mb-2 flex items-start gap-2">
        <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {result.displayName}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{result.slug}</p>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {result.summary}
            </p>
          )}
          <span className="mt-1 inline-block text-[10px] text-muted-foreground">
            Updated {timeAgo}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isInstalled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
            <CheckCircle className="h-3 w-3" />
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(result.slug)}
            disabled={installing}
            className="inline-flex items-center gap-1 rounded-md bg-primary/90 px-2.5 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary disabled:opacity-50"
          >
            {installing ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Install
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Agent Skills Map ─────────────────────────────────────────────────────────

interface AgentEntry {
  agentId: string;
  name: string;
}

function AgentSkillsMap({
  agents,
  installedSkills,
}: {
  agents: AgentEntry[];
  installedSkills: InstalledSkill[];
}) {
  const readySkills = useMemo(
    () => installedSkills.filter((s) => s.eligible),
    [installedSkills]
  );

  if (agents.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground/40">
        No agents available. Create an agent to see skill assignments.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
              Agent
            </th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
              Available Skills
            </th>
            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr
              key={agent.agentId}
              className="border-b border-border/50 transition-colors hover:bg-surface-2/30"
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {agent.name}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {readySkills.slice(0, 8).map((skill) => (
                    <span
                      key={skill.name}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      title={skill.description}
                    >
                      <span>{skill.emoji}</span>
                      {skill.name}
                    </span>
                  ))}
                  {readySkills.length > 8 && (
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      +{readySkills.length - 8} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {readySkills.length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main SkillsDashboard ─────────────────────────────────────────────────────

export function SkillsDashboard() {
  const { state } = useAgentStore();
  const agents = state.agents;
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClawHubSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [installingSlugs, setInstallingSlugs] = useState<Set<string>>(new Set());
  const [compactView, setCompactView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "needs-setup">("all");
  const [refreshing, setRefreshing] = useState(false);

  // ── Agent list from store ──────────────────────────────────────────────
  const agentEntries: AgentEntry[] = useMemo(
    () => agents.map((a) => ({ agentId: a.agentId, name: a.name })),
    [agents]
  );

  // ── Fetch installed skills ─────────────────────────────────────────────
  const fetchSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const res = await fetch("/api/runtime/skills");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const skills: InstalledSkill[] = data.skills ?? [];
      setInstalledSkills(skills);
    } catch (err) {
      setSkillsError(
        err instanceof Error ? err.message : "Failed to load skills"
      );
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  // ── ClawHub search ────────────────────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/clawhub/search?q=${encodeURIComponent(query)}&limit=20`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Search failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Search failed"
      );
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void handleSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // ── Install skill ────────────────────────────────────────────────────
  const handleInstall = useCallback(
    async (slug: string) => {
      setInstallingSlugs((prev) => new Set(prev).add(slug));
      try {
        const res = await fetch("/api/clawhub/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Install failed" }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        // Refresh installed skills after install
        await fetchSkills();
      } catch (err) {
        console.error("Install failed:", err);
      } finally {
        setInstallingSlugs((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      }
    },
    [fetchSkills]
  );

  // ── Refresh ──────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSkills();
    setRefreshing(false);
  }, [fetchSkills]);

  // ── Computed filtered lists ──────────────────────────────────────────
  const installedNames = useMemo(
    () => new Set(installedSkills.map((s) => s.name.toLowerCase())),
    [installedSkills]
  );

  const filteredInstalled = useMemo(() => {
    let skills = installedSkills;
    if (statusFilter === "ready") skills = skills.filter((s) => s.eligible);
    if (statusFilter === "needs-setup") skills = skills.filter((s) => !s.eligible);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return skills;
  }, [installedSkills, statusFilter, searchQuery]);

  const readyCount = useMemo(
    () => installedSkills.filter((s) => s.eligible).length,
    [installedSkills]
  );

  const needsSetupCount = useMemo(
    () => installedSkills.filter((s) => !s.eligible).length,
    [installedSkills]
  );

  const filteredFeatured = useMemo(() => {
    let skills = FEATURED_SKILLS;
    if (selectedCategory) skills = skills.filter((s) => s.category === selectedCategory);
    return skills;
  }, [selectedCategory]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
            placeholder="Search skills, browse ClawHub..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {installedSkills.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {installedSkills.length} skills · {readyCount} ready
              {needsSetupCount > 0 && (
                <span className="text-amber-400"> · {needsSetupCount} need setup</span>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {(
              [
                { key: "all", label: "All", count: installedSkills.length },
                { key: "ready", label: "Ready", count: readyCount },
                { key: "needs-setup", label: "Needs Setup", count: needsSetupCount },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-all ${
                  statusFilter === f.key
                    ? "bg-surface-2 font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                <span className="font-mono text-muted-foreground">{f.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {/* Category filter for featured */}
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`rounded px-1.5 py-0.5 text-[10px] transition-all ${
                  !selectedCategory
                    ? "bg-surface-2 font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                  className={`rounded px-1.5 py-0.5 text-[10px] transition-all ${
                    selectedCategory === cat
                      ? "bg-surface-2 font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCompactView((v) => !v)}
              title={compactView ? "Normal view" : "Compact view"}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
            >
              {compactView ? (
                <LayoutList className="h-3.5 w-3.5" />
              ) : (
                <LayoutGrid className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleRefresh()}
              title="Refresh skills"
              className={`flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground ${
                refreshing ? "text-primary" : ""
              }`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                style={{ animationDuration: "1s" }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Error state */}
        {skillsError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {skillsError}
          </div>
        )}

        {/* ── ClawHub Search Results ── */}
        {searchQuery.trim() && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                ClawHub Results
              </h2>
              {searchLoading && (
                <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            {searchError && (
              <p className="text-xs text-red-400">{searchError}</p>
            )}
            {!searchLoading && searchResults.length === 0 && !searchError && (
              <p className="py-4 text-center text-xs text-muted-foreground/40">
                No skills found on ClawHub for &quot;{searchQuery}&quot;
              </p>
            )}
            <div
              className={`grid gap-2 ${
                compactView
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {searchResults.map((result) => (
                <ClawHubResultCard
                  key={result.slug}
                  result={result}
                  isInstalled={installedNames.has(result.slug.toLowerCase())}
                  installing={installingSlugs.has(result.slug)}
                  onInstall={handleInstall}
                  compact={compactView}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Featured Skills ── */}
        {!searchQuery.trim() && (
          <CollapsibleSection
            title="Featured Skills"
            icon={Sparkles}
            accent="text-primary"
            count={filteredFeatured.length}
          >
            <p className="mb-3 text-xs text-muted-foreground">
              Curated skill presets from the SimonCatBot ecosystem — install with one
              click to supercharge your agents.
            </p>
            <div
              className={`grid gap-2 ${
                compactView
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {filteredFeatured.map((skill) => (
                <FeaturedSkillCard
                  key={skill.slug}
                  skill={skill}
                  isInstalled={installedNames.has(skill.slug.toLowerCase()) || installedNames.has(skill.name.toLowerCase())}
                  installing={installingSlugs.has(skill.slug)}
                  onInstall={handleInstall}
                  compact={compactView}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Installed Skills ── */}
        <CollapsibleSection
          title="Installed Skills"
          icon={Package}
          accent="text-green-400"
          count={filteredInstalled.length}
          defaultOpen={!searchQuery.trim()}
        >
          {skillsLoading && installedSkills.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">
                Loading skills...
              </span>
            </div>
          ) : filteredInstalled.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground/40">
              {installedSkills.length === 0
                ? "No skills detected. Connect to a gateway or install from the Featured section."
                : "No skills match the current filter."}
            </p>
          ) : (
            <div
              className={`grid gap-2 ${
                compactView
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {filteredInstalled.map((skill) => (
                <InstalledSkillCard
                  key={skill.name}
                  skill={skill}
                  compact={compactView}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Agent Skills Map ── */}
        {!searchQuery.trim() && agentEntries.length > 0 && (
          <CollapsibleSection
            title="Agent Skills Map"
            icon={Users}
            accent="text-blue-400"
            count={agentEntries.length}
            defaultOpen={false}
          >
            <p className="mb-3 text-xs text-muted-foreground">
              Shows which skills are available to each agent based on the
              current gateway configuration.
            </p>
            <AgentSkillsMap
              agents={agentEntries}
              installedSkills={installedSkills}
            />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}