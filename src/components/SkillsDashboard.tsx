// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Search,
  Download,
  CheckCircle,
  AlertTriangle,
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
  Plus,
  Minus,
  GripVertical,
  Star,
  Shield,
} from "lucide-react";
import { useAgentStore } from "@/features/agents/state/store";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
import { buildDefaultAvatarUrl, deriveDefaultIndex } from "@/features/agents/components/AgentAvatar";
import { useAvatarMode, type AvatarDisplayMode } from "@/components/AvatarModeContext";

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

interface AgentSkillAssignment {
  agentId: string;
  agentName: string;
  assignedSkillNames: string[];
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
      <div className="mb-1 flex items-start gap-2">
        <span className="text-base leading-none" role="img" aria-label={skill.name}>
          {skill.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold text-foreground">{skill.name}</p>
            <SkillStatusBadge eligible={skill.eligible} missing={skill.missing} />
          </div>
          {!compact && (
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{skill.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Featured Skill Chip (for left column agent cards) ───────────────────────

function FeaturedSkillChip({
  skill,
  isAssigned,
  isInstalled,
  onToggle,
  disabled,
}: {
  skill: (typeof FEATURED_SKILLS)[number];
  isAssigned: boolean;
  isInstalled: boolean;
  onToggle: (slug: string, assign: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(skill.slug, !isAssigned)}
      disabled={disabled}
      className={`group/chip flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-all disabled:opacity-40 ${
        isAssigned
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface-1 text-muted-foreground hover:border-accent/40 hover:text-foreground"
      }`}
      title={
        isAssigned
          ? `Remove ${skill.name} from this agent`
          : isInstalled
            ? `Assign ${skill.name} to this agent`
            : `Install ${skill.name} first, then assign`
      }
    >
      <span>{skill.emoji}</span>
      <span className="truncate">{skill.name}</span>
      {isAssigned ? (
        <Minus className="ml-auto h-2.5 w-2.5 shrink-0 text-primary/60 group-hover/ship:text-red-400" />
      ) : (
        <Plus className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />
      )}
    </button>
  );
}

// ─── Agent Skill Card (left column) ──────────────────────────────────────────

function agentAvatarSrc(
  agentId: string,
  avatarSeed: string | null | undefined,
  footerMode: AvatarDisplayMode,
  defaultAvatarIndex: number = 0
): string {
  const seed = avatarSeed?.trim() || agentId;
  if (footerMode === "default") {
    return buildDefaultAvatarUrl(deriveDefaultIndex(seed, defaultAvatarIndex));
  }
  return buildAvatarDataUrl(seed || "default");
}

function AgentSkillCard({
  agentId,
  agentName,
  avatarSeed,
  footerMode,
  assignedSkills,
  readyInstalledSkills,
  featuredSkills,
  isInstalledSet,
  onToggleSkill,
  onInstallAndAssign,
  installingSlugs,
  compact,
  selectedCategory,
}: {
  agentId: string;
  agentName: string;
  avatarSeed?: string | null;
  footerMode: AvatarDisplayMode;
  assignedSkills: Set<string>;
  readyInstalledSkills: InstalledSkill[];
  featuredSkills: typeof FEATURED_SKILLS;
  isInstalledSet: Set<string>;
  onToggleSkill: (agentId: string, slug: string, assign: boolean) => void;
  onInstallAndAssign: (slug: string, agentId: string) => void;
  installingSlugs: Set<string>;
  compact: boolean;
  selectedCategory: string | null;
}) {
  const avatarUrl = agentAvatarSrc(agentId, avatarSeed, footerMode);
  const [expanded, setExpanded] = useState(true);

  const assignedList = featuredSkills.filter((f) => assignedSkills.has(f.slug) || assignedSkills.has(f.name));
  const availableFeatured = featuredSkills.filter(
    (f) => !assignedSkills.has(f.slug) && !assignedSkills.has(f.name)
  );

  return (
    <div className="rounded-xl border border-border bg-surface-1 shadow-sm transition-all hover:border-accent/30">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Image
          src={avatarUrl}
          alt={agentName}
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full bg-surface-2 ring-1 ring-accent"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{agentName}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{agentId}</p>
        </div>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary">
          {assignedList.length}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 px-3 py-2">
          {/* Currently assigned skills */}
          {assignedList.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-green-400">
                Assigned
              </p>
              <div className="flex flex-wrap gap-1">
                {assignedList.map((skill) => (
                  <FeaturedSkillChip
                    key={skill.slug}
                    skill={skill}
                    isAssigned
                    isInstalled={isInstalledSet.has(skill.slug.toLowerCase()) || isInstalledSet.has(skill.name.toLowerCase())}
                    onToggle={(slug, assign) => onToggleSkill(agentId, slug, assign)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available skills to add */}
          {availableFeatured.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Add Skills
              </p>
              <div className="flex flex-wrap gap-1">
                {availableFeatured.map((skill) => {
                  const isInst = isInstalledSet.has(skill.slug.toLowerCase()) || isInstalledSet.has(skill.name.toLowerCase());
                  const isInstalling = installingSlugs.has(skill.slug);
                  return (
                    <button
                      key={skill.slug}
                      type="button"
                      onClick={() => {
                        if (!isInst) {
                          onInstallAndAssign(skill.slug, agentId);
                        } else {
                          onToggleSkill(agentId, skill.slug, true);
                        }
                      }}
                      disabled={isInstalling}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-all disabled:opacity-40 ${
                        isInst
                          ? "border-border bg-surface-1 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          : "border-dashed border-border/60 bg-surface-1 text-muted-foreground/60 hover:border-primary/40 hover:text-foreground"
                      }`}
                      title={
                        isInst
                          ? `Assign ${skill.name} to ${agentName}`
                          : `Install & assign ${skill.name} to ${agentName}`
                      }
                    >
                      {isInstalling ? (
                        <Loader className="h-2.5 w-2.5 animate-spin" />
                      ) : !isInst ? (
                        <Download className="h-2.5 w-2.5" />
                      ) : null}
                      <span>{skill.emoji}</span>
                      <span className="truncate">{skill.name}</span>
                      <Plus className="h-2.5 w-2.5 shrink-0 text-primary/60" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ready installed skills (non-featured) count */}
          {readyInstalledSkills.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>{readyInstalledSkills.length} system skills available</span>
            </div>
          )}
        </div>
      )}
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
        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {result.displayName}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{result.slug}</p>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
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
            className="inline-flex items-center gap-1 rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary disabled:opacity-50"
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

// ─── Main SkillsDashboard ─────────────────────────────────────────────────────

export function SkillsDashboard() {
  const { state } = useAgentStore();
  const agents = state.agents;
  const footerMode = useAvatarMode();

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
  const [agentSkillAssignments, setAgentSkillAssignments] = useState<Map<string, Set<string>>>(new Map());
  const pendingInstallAssignRef = useRef<Map<string, string[]>>(new Map());

  // ── Fetch installed skills ─────────────────────────────────────────────
  const fetchSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const res = await fetch("/api/runtime/skills");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Failed to parse skills data from gateway. Try refreshing the page.");
      }
      const skills: InstalledSkill[] = (data.skills as InstalledSkill[]) ?? [];
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

  // ── Initialize agent skill assignments from config ─────────────────────
  // On load, we try to read per-agent skillAllowlist from the gateway config
  useEffect(() => {
    async function loadAgentSkillConfig() {
      try {
        const res = await fetch("/api/runtime/config");
        if (!res.ok) return;
        const data = await res.json();
        const config = data?.payload?.parsed ?? data?.config ?? data?.payload?.config ?? {};
        const agentList = config?.agents?.list ?? [];
        const newAssignments = new Map<string, Set<string>>();
        for (const agent of agentList) {
          const id = agent.id ?? agent.agentId;
          if (!id) continue;
          const existing = new Set<string>();
          // Check for skillAllowlist
          if (Array.isArray(agent.skillAllowlist)) {
            for (const s of agent.skillAllowlist) {
              if (typeof s === "string" && s.trim()) existing.add(s.trim().toLowerCase());
            }
          }
          newAssignments.set(id, existing);
        }
        setAgentSkillAssignments(newAssignments);
      } catch {
        // silently skip — will show all skills as available
      }
    }
    void loadAgentSkillConfig();
  }, []);

  // ── After install, apply any pending assign-to-agent operations ────────
  useEffect(() => {
    if (pendingInstallAssignRef.current.size === 0) return;
    const pending = new Map(pendingInstallAssignRef.current);
    pendingInstallAssignRef.current = new Map();
    for (const [slug, agentIds] of pending) {
      for (const agentId of agentIds) {
        handleToggleSkill(agentId, slug, true);
      }
    }
  }, [installedSkills]);

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

  // ── Install and assign to agent ────────────────────────────────────────
  const handleInstallAndAssign = useCallback(
    (slug: string, agentId: string) => {
      // Track the pending assignment so after install completes, we auto-assign
      const pending = new Map(pendingInstallAssignRef.current);
      const existing = pending.get(slug) ?? [];
      if (!existing.includes(agentId)) existing.push(agentId);
      pending.set(slug, existing);
      pendingInstallAssignRef.current = pending;
      void handleInstall(slug);
    },
    [handleInstall]
  );

  // ── Toggle skill on agent ─────────────────────────────────────────────
  const handleToggleSkill = useCallback(
    (agentId: string, slug: string, assign: boolean) => {
      setAgentSkillAssignments((prev) => {
        const next = new Map(prev);
        const current = new Set<string>(next.get(agentId) ?? new Set<string>());
        const key = slug.toLowerCase();
        if (assign) {
          current.add(key);
        } else {
          current.delete(key);
        }
        next.set(agentId, current);
        return next;
      });
    },
    []
  );

  // ── Persist agent skill assignments to gateway config ─────────────────
  // When assignments change, persist them via the skills-assign API
  const prevAssignmentsRef = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    // Skip the first render
    if (prevAssignmentsRef.current.size > 0 || agentSkillAssignments.size > 0) {
      for (const [agentId, skills] of agentSkillAssignments) {
        const prev = prevAssignmentsRef.current.get(agentId);
        const current = skills;
        // Only persist if this agent's set actually changed
        if (prev === current) continue;
        if (prev && current && prev.size === current.size && [...prev].every((s) => current.has(s))) continue;
        void persistAgentSkills(agentId, [...current]);
      }
    }
    prevAssignmentsRef.current = new Map(agentSkillAssignments);
  }, [agentSkillAssignments]);

  const persistAgentSkills = useCallback(async (agentId: string, skillNames: string[]) => {
    try {
      await fetch("/api/intents/agent-skills-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, skillAllowlist: skillNames }),
      });
    } catch (err) {
      console.error("Failed to persist skill assignment:", err);
    }
  }, []);

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

  const readyInstalledSkills = useMemo(
    () => installedSkills.filter((s) => s.eligible),
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

      {/* ── Two-Column Layout ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* ═══ LEFT COLUMN: Agents & Skill Assignments ═══ */}
        <div className="flex w-1/2 flex-col border-r border-border overflow-y-auto">
          <div className="px-4 py-3 space-y-4">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Agents & Skills</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Assign SimonCatBot preset skills to each agent. Click a skill to add or remove it.
            </p>

            {/* Error state */}
            {skillsError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {skillsError}
              </div>
            )}

            {/* Loading */}
            {skillsLoading && installedSkills.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">Loading skills...</span>
              </div>
            ) : agents.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground/40">
                No agents available. Create an agent first.
              </p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <AgentSkillCard
                    key={agent.agentId}
                    agentId={agent.agentId}
                    agentName={agent.name}
                    avatarSeed={agent.avatarSeed}
                    footerMode={footerMode}
                    assignedSkills={agentSkillAssignments.get(agent.agentId) ?? new Set()}
                    readyInstalledSkills={readyInstalledSkills}
                    featuredSkills={filteredFeatured}
                    isInstalledSet={installedNames}
                    onToggleSkill={handleToggleSkill}
                    onInstallAndAssign={handleInstallAndAssign}
                    installingSlugs={installingSlugs}
                    compact={compactView}
                    selectedCategory={selectedCategory}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT COLUMN: ClawHub Browse & Installed Skills ═══ */}
        <div className="flex w-1/2 flex-col overflow-y-auto">
          <div className="px-4 py-3 space-y-6">
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
                      : "grid-cols-1 sm:grid-cols-2"
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

            {/* ── Featured Skills Browse ── */}
            {!searchQuery.trim() && (
              <CollapsibleSection
                title="Featured Skills"
                icon={Sparkles}
                accent="text-primary"
                count={filteredFeatured.length}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Curated skill presets from the SimonCatBot ecosystem. Install and assign to your agents from the left panel.
                </p>
                <div
                  className={`grid gap-2 ${
                    compactView
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2"
                  }`}
                >
                  {filteredFeatured.map((skill) => {
                    const isInst = installedNames.has(skill.slug.toLowerCase()) || installedNames.has(skill.name.toLowerCase());
                    const isInstalling = installingSlugs.has(skill.slug);
                    return (
                      <div
                        key={skill.slug}
                        className="group rounded-xl border border-border bg-surface-1 p-3 shadow-sm transition-all hover:border-accent/40 hover:bg-surface-2/30"
                      >
                        <div className="mb-2 flex items-start gap-2">
                          <span className="text-base leading-none" role="img" aria-label={skill.name}>
                            {skill.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-xs font-semibold text-foreground">{skill.name}</p>
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                                {skill.category}
                              </span>
                            </div>
                            {!compactView && (
                              <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                                {skill.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isInst ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              Installed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInstall(skill.slug)}
                              disabled={isInstalling}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary disabled:opacity-50"
                            >
                              {isInstalling ? (
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
                  })}
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
                    ? "No skills detected. Connect to a gateway or install from above."
                    : "No skills match the current filter."}
                </p>
              ) : (
                <div
                  className={`grid gap-2 ${
                    compactView
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2"
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
          </div>
        </div>
      </div>
    </div>
  );
}