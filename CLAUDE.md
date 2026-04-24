# CLAUDE.md — rocCLAW Project Guide

## What is rocCLAW?

rocCLAW is a web-based operator dashboard for managing OpenClaw AI agents. It acts as a secure proxy between the browser and the OpenClaw gateway — the browser never connects directly to the gateway. rocCLAW handles authentication, event replay, rate limiting, and token security.

```
Browser (React) <--HTTP/SSE--> rocCLAW Server (Next.js + SQLite) <--WebSocket--> OpenClaw Gateway
```

This repository is a **frontend + proxy server** only. The OpenClaw gateway is a separate project at `~/openclaw`. Do not modify gateway source code from this repo.

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router, React 19.2.3, TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS v4 with modular CSS design tokens (`src/app/styles/tokens.css`, `components.css`, `chat.css`, `typography.css`, `base.css`, `badges.css`, `accessibility.css`, `color-schemes.css`)
- **UI Library**: shadcn/ui (New York style, zinc base, Lucide icons)
- **Database**: SQLite via `better-sqlite3` (WAL mode, server-side only)
- **WebSocket**: `ws` for gateway communication with Ed25519 challenge-response authentication
- **State Management**: React Context + `useReducer` (no Redux/Zustand)
- **Charts**: Recharts for system metrics time-series graphs
- **Drag & Drop**: @dnd-kit for task/cron management
- **Markdown**: react-markdown + remark-gfm for chat rendering
- **Node.js**: >=20.9.0 (pinned in `.nvmrc`)
- **Server**: Custom Node.js entry point in `server/index.js` (plain JS, not TypeScript)

## Commands

```bash
npm run dev              # Start dev server (auto-repairs native deps)
npm run build            # Production build
npm run start            # Build + start production server
npm run typecheck        # TypeScript strict checking (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Unit tests (Vitest, jsdom — 145 files, 1,091 tests)
npm run e2e              # E2E tests (Playwright — 11 specs, requires: npx playwright install)
```

Run all four checks before submitting changes:
```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## Project Structure

```
src/
  app/
    page.tsx                          # Main orchestrator page (~1,650 lines — primary refactoring target)
    layout.tsx                        # Root layout with fonts and theme
    agents/[agentId]/settings/        # Agent settings (redirects to /?settings=agentId)
    [...invalid]/                     # Catch-all redirect to /
    api/
      intents/                        # 16 POST routes — write operations (chat-send, agent-create, etc.)
      runtime/                        # 11 GET routes — read operations (fleet, stream, config, etc.)
      rocclaw/                        # Settings management + connection test
      cron/                           # Cron job management
      gateway-info/                   # Gateway information
      gateway-metrics/                # System metrics (local + remote)
      usage/                          # Token usage data
    styles/
      tokens.css                      # Design tokens — colors, surfaces, status, elevation (~303 lines)
      components.css                  # Component classes — buttons, cards, panels, switches (~563 lines)
      chat.css                        # Chat-specific styles
      typography.css                  # Type scale and font sizing
      base.css                        # Root styles, scrollbars, body background
      markdown.css                    # Chat markdown rendering (~215 lines)
      badges.css                      # Badge styles
      accessibility.css               # Focus indicators, reduced-motion, animations
      color-schemes.css               # Light/dark theme definitions
  components/                         # Shared UI components
    ConnectionPage.tsx                # Gateway connection settings (4-tab layout: Local/Client/Cloud/Remote)
    SystemMetricsDashboard.tsx        # System monitoring (CPU, GPU, memory, disk, network)
    SystemGraphView.tsx               # Time-series metric graphs (Recharts, 5m/10m/30m ranges)
    TasksDashboard.tsx                # Cron/tasks kanban board with drag-and-drop (~1,400 lines)
    TokenUsageDashboard.tsx           # Token usage tracking wrapper
    TokenUsage.tsx                    # Token usage display (per-agent, per-model breakdowns)
    SettingsPanel.tsx                 # App settings (Appearance editable; Gateway/Model/Agent view-only)
    TabBar.tsx                        # 8 toggleable tab navigation
    HeaderBar.tsx / FooterBar.tsx     # App chrome (header logo, footer status/version/avatars)
    GpuMetricsPanel.tsx               # GPU-specific metrics
    ColorSchemeToggle.tsx             # Light/dark theme toggle
    AvatarModeToggle.tsx              # Avatar mode toggle (auto/default/custom)
  features/agents/
    components/                       # Agent-specific UI
      AgentChatPanel.tsx              # Real-time chat with streaming (~678 lines)
      chat/                           # Chat sub-components
        AgentChatTranscript.tsx        # Scrollable chat view with auto-scroll pinning (~376 lines)
        AgentChatComposer.tsx          # Message input with model/thinking selectors
        AssistantMessageCard.tsx       # Assistant response with markdown + streaming
        UserMessageCard.tsx            # User message card
        ExecApprovalCard.tsx           # Inline exec approval (allow-once/always/deny)
        ThinkingDetailsRow.tsx         # Collapsible thinking traces
        ToolCallDetails.tsx            # Tool call summaries
        chatItems.ts                   # Transcript parsing and render block building (~372 lines)
      AgentInspectPanels.tsx          # Agent capabilities/automations/advanced panels (~562 lines)
      inspect/AgentBrainPanel.tsx     # Personality file editor (SOUL, AGENTS, USER, IDENTITY) (~280 lines)
      FleetSidebar.tsx                # Agent grid with search/filter, status indicators, and avatars
      AgentCreateModal.tsx            # Agent creation dialog
      ConnectionPanel.tsx             # Compact connection panel (modal/sidebar)
    operations/                       # Business logic (35 files, workflow/operation pattern)
    state/
      store.tsx                       # AgentStore — React Context + useReducer (~614 lines, ~40 fields per agent)
      transcript.ts                   # Chat transcript with dedup (FNV-1a fingerprinting, 2s bucketing)
      useRuntimeEventStream.ts        # SSE event stream hook with Last-Event-ID resume
    approvals/                        # Exec approval system (10 files, fully wired end-to-end)
  lib/
    controlplane/
      runtime.ts                      # ControlPlaneRuntime singleton (on globalThis)
      openclaw-adapter.ts             # WebSocket gateway adapter (29-method allowlist, Ed25519 auth)
      projection-store.ts             # SQLite projection store (outbox pattern, 3 tables)
      contracts.ts                    # Domain event types (discriminated union)
      device-identity.ts              # Ed25519 keypair generation and challenge-response signing
      gateway-connect-profile.ts      # Two profiles: backend-local and legacy-control-ui fallback
      intent-route.ts                 # Rate-limited intent handler factory (30/s chat, 60/s default)
      degraded-read.ts                # CLI probe fallback (openclaw status/sessions --json)
      exec-approvals.ts               # Three roles: conservative/collaborative/autonomous
      semantic-history-window.ts       # Chat history windowing (default 50 turns)
    gateway/                          # Gateway client abstractions
      agentConfig.ts                  # Agent configuration management (~630 lines)
      GatewayClient.ts                # Gateway client interface
      models.ts                       # Model catalog and choices
      execApprovals.ts                # Exec approval gateway interactions
      session-settings-sync.ts        # Session settings synchronization
    rocclaw/                          # Settings store and coordinator
      settings.ts                     # Settings schema (gateway, focused prefs, avatars)
      settings-store.ts               # Server-side persistence (~/.openclaw/openclaw-rocclaw/settings.json)
      coordinator.ts                  # Browser-side debounced settings (350ms debounce)
      useROCclawGatewaySettings.ts    # Gateway connection lifecycle hook (~557 lines)
    system/
      rocm.ts                         # ROCm GPU detection (AMD GPUs, marketing name map) (~762 lines)
      gpu-fallback.ts                 # Basic GPU detection fallback (lspci + DRM sysfs) (~471 lines)
    text/                             # Markdown, message extraction, media
      message-extract.ts              # Message parsing (thinking/tool extraction) (~538 lines)
      media-markdown.ts               # Media references to markdown images
    agents/                           # Agent file/personality management
      agentFiles.ts                   # 7 agent files: AGENTS, SOUL, IDENTITY, USER, TOOLS, HEARTBEAT, MEMORY
      personalityBuilder.ts           # Structured parser/serializer for personality files (~311 lines)
    cron/                             # Cron payload builder
      types.ts                        # Schedule types (at/every/cron), payload types, delivery
      createPayloadBuilder.ts         # UI draft to CronJobCreateInput conversion
server/
  index.js                            # Custom Node.js entry point (plain JS, dual-stack binding)
  access-gate.js                      # Cookie-based auth via ROCCLAW_ACCESS_TOKEN (HttpOnly, SameSite=Lax)
  network-policy.js                   # Refuses public IP binding without access token
  rocclaw-settings.js                 # Settings resolution cascade (~/.openclaw/)
  rocclaw-install-context.js          # Startup environment detection (gateway, Tailscale, CLI version)
tests/
  unit/                               # 145 Vitest test files (1,091 tests)
  e2e/                                # 11 Playwright spec files
  setup.ts                            # Test setup (localStorage polyfill, jest-dom matchers)
```

## Key Architecture Patterns

**Proxy pattern**: The server mediates all browser-to-gateway communication. The browser has no direct gateway access and never sees raw tokens. A 29-method allowlist prevents arbitrary RPC calls.

**Intent pattern**: Browser write operations are "intents" — POST requests to `/api/intents/*` that the server validates, rate-limits (30/s chat, 60/s default per client IP), and forwards to the gateway via WebSocket.

**Event sourcing / outbox**: Gateway events are persisted to SQLite (3 tables: `runtime_projection`, `outbox`, `processed_events`), then fanned out to browser SSE subscribers. Supports Last-Event-ID replay on reconnect. SSE stream uses a startup buffer to prevent event loss during replay.

**Workflow/operation naming**: Complex operations use `*Workflow.ts` (pure planning functions) and `*Operation.ts` (side-effectful executors) suffixes. Workflows produce plans; operations execute them. React hooks use `use*Controller.ts` pattern to wire workflows to UI.

**Process singleton**: `ControlPlaneRuntime` is stored on `globalThis` to ensure one instance per Node.js process (important for Next.js hot reload).

**Ed25519 device identity**: Cryptographic device authentication for gateway handshake. Keypair stored at `~/.openclaw/openclaw-rocclaw/device.json` with `0o600` permissions. V3 challenge-response signing with automatic fallback from `backend-local` to `legacy-control-ui` profile.

**Transcript deduplication**: FNV-1a fingerprinting (32-bit) with 2-second timestamp bucketing. Entries matched by `entryId` first, then by content similarity (normalized text + session/kind/role).

**Degraded mode**: When the gateway is unavailable, the server falls back to cached SQLite projection store data or CLI probes (`openclaw status/sessions --json`). Fleet hydration scans the last 5,000 outbox entries to reconstruct partial agent lists.

## Path Alias

`@/` maps to `./src/` in both TypeScript and Vitest:
```typescript
import { something } from "@/lib/gateway/agentConfig";
// resolves to: ./src/lib/gateway/agentConfig.ts
```

## Important Caveats

- `next.config.ts` has `ignoreBuildErrors: true` — production builds skip type checking. Type errors are caught by `npm run typecheck` but not by `npm run build`. This is a known issue with a TODO to fix.
- The `server/` directory is plain JavaScript (CommonJS), not TypeScript. This is intentional — it's the entry point that boots Next.js.
- The main `page.tsx` is ~1,650 lines with 30+ useState calls. This is the primary refactoring target. It orchestrates the entire application — gateway connection, agent state, settings, modals, tabs, SSE events, approvals, cron, and all UI layout.
- TypeScript strict mode is enabled. The codebase has zero `@ts-ignore`, `@ts-expect-error`, or `as any` casts.
- `recharts` is listed as a dependency but may need `npm install` to ensure it's present in `node_modules`. The `SystemGraphView.tsx` component depends on it.

## Security Rules

- Never commit tokens, passwords, or SSH keys.
- Never expose gateway credentials in browser-accessible code.
- Always redact tokens in logs and responses (browser only sees `hasToken: true`).
- The gateway adapter enforces a 29-method allowlist — no wildcard RPC calls.
- Rate limiting is applied per-client-IP (30/s for chat, 60/s default). Response headers include `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Device keypair files must use `0o600` permissions (owner-only read/write).
- Three security layers: network policy (startup), access gate (HTTP), gateway adapter (RPC).

## API Route Reference

### Intent Routes (POST — write operations)

| Route | Gateway Method | Rate Limit |
|-------|---------------|------------|
| `chat-send` | `chat.send` | 30/s |
| `chat-abort` | `chat.abort` | 60/s |
| `agent-create` | `agents.create` | 60/s |
| `agent-delete` | `agents.delete` | 60/s |
| `agent-rename` | `agents.update` | 60/s |
| `agent-wait` | `agent.wait` | 60/s |
| `agent-file-set` | `agents.files.set` | 60/s |
| `agent-permissions-update` | `exec.approvals.set` + `config.set` | 60/s |
| `session-settings-sync` | `sessions.patch` | 60/s |
| `sessions-reset` | `sessions.reset` | 60/s |
| `exec-approval-resolve` | `exec.approval.resolve` | 60/s |
| `cron-add` | `cron.add` | 60/s |
| `cron-run` | `cron.run` | 60/s |
| `cron-remove` | `cron.remove` | 60/s |
| `cron-remove-agent` | `cron.remove` (bulk) | 60/s |
| `cron-restore` | `cron.add` (restore) | 60/s |

### Runtime Routes (GET — read operations)

`fleet`, `stream`, `summary`, `config`, `models`, `cron`, `agent-file`, `agent-state`, `agents/[agentId]/history`, `agents/[agentId]/preview`, `media`, `disconnect`

### Other Routes

`/api/rocclaw` (GET/PUT settings), `/api/rocclaw/test-connection`, `/api/gateway-info`, `/api/gateway-metrics`, `/api/usage`, `/api/cron/jobs`, `/api/cron/run`

## Dashboard Tabs

8 toggleable tabs that can be shown side-by-side (Tasks tab is exclusive — replaces all others):

| Tab | Component | Description |
|-----|-----------|-------------|
| Agents | `FleetSidebar` | Agent grid with search/filter, status cards, avatars, "Needs Approval" badges |
| Chat | `AgentChatPanel` | Real-time streaming chat with thinking traces and tool calls |
| Connection | `ConnectionPage` | 4-tab gateway config (Local/Client/Cloud/Remote) |
| System | `SystemMetricsDashboard` | Live CPU/GPU/memory/disk/network gauges |
| Graph | `SystemGraphView` | Time-series charts (5m/10m/30m, Recharts) |
| Tasks | `TasksDashboard` | Cron kanban board with drag-and-drop |
| Tokens | `TokenUsageDashboard` | Per-agent and per-model token usage |
| Settings | `SettingsPanel` | Appearance (editable), Gateway/Model/Agent (view-only) |

## Agent Personality Files

Each agent has 7 personality files managed via `AgentBrainPanel`:

| File | Purpose | Parser |
|------|---------|--------|
| `IDENTITY.md` | Name, creature, vibe, emoji, avatar | Label-map (`- Key: value`) |
| `SOUL.md` | Core truths, boundaries, vibe, continuity | `## Section` headings |
| `USER.md` | Operator name, pronouns, timezone, notes | Label-map + Context section |
| `AGENTS.md` | Operating rules and workflows | Raw markdown |
| `TOOLS.md` | Tool usage guidelines | Raw markdown |
| `HEARTBEAT.md` | Heartbeat configuration | Raw markdown |
| `MEMORY.md` | Persistent memory and context | Raw markdown |

## Exec Approval System

Fully wired end-to-end across 10 files in `src/features/agents/approvals/`:

- **Three roles**: Conservative (deny by default), Collaborative (allowlist + always ask), Autonomous (full access, never ask)
- **Two-tier state**: Scoped approvals (keyed by agent) and unscoped approvals (not yet matched)
- **Inline UI**: `ExecApprovalCard` renders in chat with Allow once / Always allow / Deny buttons
- **Auto-resume**: After resolution, paused runs resume with a follow-up message
- **Pause policy**: Runs paused only when agent is running and ask mode is "always"

## Testing Conventions

- Unit tests go in `tests/unit/` and follow the pattern `tests/unit/<moduleName>.test.ts`.
- Tests use Vitest with jsdom environment. Import from `vitest` (`describe`, `it`, `expect`, `vi`).
- Tests needing Node.js (not jsdom) use `// @vitest-environment node` at the top.
- E2E tests go in `tests/e2e/` as `*.spec.ts` files using Playwright. API routes are stubbed via helper functions (`stubRocclawRoute`, `stubRuntimeRoutes`).
- Test setup in `tests/setup.ts` provides a `localStorage` polyfill and `@testing-library/jest-dom/vitest` matchers.
- Workflow tests focus on pure planning functions and their decision outputs — no mocking needed.
- Operation tests mock side effects (`vi.doMock`, `vi.fn`, `vi.stubGlobal("fetch")`) and verify orchestration.
- Rate limit tests use unique keys per test to avoid cross-test state pollution.
- Agent state tests use factory functions with defaults and overrides.

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(scope): add new feature
fix(scope): fix a bug
refactor(scope): restructure code
test(scope): add or update tests
docs(scope): update documentation
chore(scope): maintenance tasks
```

## CI Pipeline

GitHub Actions runs on push to `master`/`main` and on PRs. Four parallel jobs:
1. **Lint & Type Check** — `npm run lint` + `npm run typecheck`
2. **Unit Tests** — `npm run test -- --run`
3. **Build** — `npm run build`
4. **E2E Tests** — installs Playwright browsers, runs `npm run e2e`

All jobs use Node.js 22 on Ubuntu.

## Related Documentation

- `docs/ARCHITECTURE.md` — Technical deep-dive (data flow, API routes, durability model, security, system monitoring)
- `docs/CONTRIBUTING.md` — Development setup, testing patterns, commit conventions, PR guidelines
- `docs/permissions-sandboxing.md` — Security model, exec approval roles, sandbox modes, tool policies
- `docs/CHANGELOG.md` — Release history
