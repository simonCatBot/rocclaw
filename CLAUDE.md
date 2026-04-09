# CLAUDE.md — rocCLAW Project Guide

## What is rocCLAW?

rocCLAW is a web-based operator dashboard for managing OpenClaw AI agents. It acts as a secure proxy between the browser and the OpenClaw gateway — the browser never connects directly to the gateway. rocCLAW handles authentication, event replay, rate limiting, and token security.

```
Browser (React) <--HTTP/SSE--> rocCLAW Server (Next.js + SQLite) <--WebSocket--> OpenClaw Gateway
```

This repository is a **frontend + proxy server** only. The OpenClaw gateway is a separate project at `~/openclaw`. Do not modify gateway source code from this repo.

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router, React 19.2.3, TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS v4 with CSS custom properties design tokens in `src/app/styles/globals.css`
- **UI Library**: shadcn/ui (New York style, zinc base, Lucide icons)
- **Database**: SQLite via `better-sqlite3` (WAL mode, server-side only)
- **WebSocket**: `ws` for gateway communication
- **State Management**: React Context + `useReducer` (no Redux/Zustand)
- **Node.js**: >=20.9.0 (pinned in `.nvmrc`)
- **Server**: Custom Node.js entry point in `server/index.js` (plain JS, not TypeScript)

## Commands

```bash
npm run dev              # Start dev server (auto-repairs native deps)
npm run build            # Production build
npm run start            # Build + start production server
npm run typecheck        # TypeScript strict checking (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Unit tests (Vitest, jsdom)
npm run e2e              # E2E tests (Playwright — requires: npx playwright install)
```

Run all four checks before submitting changes:
```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## Project Structure

```
src/
  app/
    page.tsx                          # Main page (~1,935 lines — primary refactoring target)
    layout.tsx                        # Root layout with fonts and theme
    agents/[agentId]/settings/        # Agent settings (redirects to /?settings=agentId)
    [...invalid]/                     # Catch-all redirect to /
    api/
      intents/                        # POST routes — write operations (chat-send, agent-create, etc.)
      runtime/                        # GET routes — read operations (fleet, stream, config, etc.)
      rocclaw/                        # Settings management
      cron/                           # Cron job management
      gateway-info/                   # Gateway information
      gateway-metrics/                # System metrics (local + remote)
      usage/                          # Token usage data
    styles/
      globals.css                     # Design tokens, theme variables (~1,492 lines)
      markdown.css                    # Chat markdown styling
  components/                         # Shared UI components
    ConnectionPage.tsx                # Gateway connection settings (4-tab layout)
    SystemMetricsDashboard.tsx        # System monitoring (CPU, GPU, memory, disk, network)
    TasksDashboard.tsx                # Cron/tasks management
    TokenUsageDashboard.tsx           # Token usage tracking
    SettingsPanel.tsx                 # App settings
    TabBar.tsx                        # Tab navigation
    HeaderBar.tsx / FooterBar.tsx     # App chrome
    GpuMetricsPanel.tsx               # GPU-specific metrics
  features/agents/
    components/                       # Agent-specific UI
      AgentChatPanel.tsx              # Real-time chat with streaming (~1,838 lines)
      AgentInspectPanels.tsx          # Agent brain/settings panels (~1,529 lines)
      FleetSidebar.tsx                # Agent list with status indicators
      AgentCreateModal.tsx            # Agent creation dialog
      ConnectionPanel.tsx             # Compact connection panel (modal/sidebar)
    operations/                       # Business logic (workflow/operation pattern)
    state/
      store.tsx                       # AgentStore — React Context + useReducer
      transcript.ts                   # Chat transcript with dedup (FNV-1a fingerprinting)
      useRuntimeEventStream.ts        # SSE event stream hook
    approvals/                        # Exec approval system (fully wired end-to-end)
  lib/
    controlplane/
      runtime.ts                      # ControlPlaneRuntime singleton (on globalThis)
      openclaw-adapter.ts             # WebSocket gateway adapter (29-method allowlist)
      projection-store.ts             # SQLite projection store (outbox pattern)
      contracts.ts                    # Domain event types
    gateway/                          # Gateway client abstractions
    rocclaw/                          # Settings store and coordinator
    system/
      rocm.ts                         # ROCm GPU detection (AMD GPUs)
      gpu-fallback.ts                 # Basic GPU detection fallback
    text/                             # Markdown, message extraction, media
    agents/                           # Agent file/personality management
    cron/                             # Cron payload builder
server/
  index.js                            # Custom Node.js entry point (plain JS)
  access-gate.js                      # Cookie-based auth via ROCCLAW_ACCESS_TOKEN
  network-policy.js                   # Refuses public IP binding without access token
  rocclaw-settings.js                 # Reads settings from ~/.openclaw/
tests/
  unit/                               # 119+ Vitest test files
  e2e/                                # 10 Playwright spec files
  setup.ts                            # Test setup (localStorage polyfill)
```

## Key Architecture Patterns

**Proxy pattern**: The server mediates all browser-to-gateway communication. The browser has no direct gateway access and never sees raw tokens.

**Intent pattern**: Browser write operations are "intents" — POST requests to `/api/intents/*` that the server validates, rate-limits, and forwards to the gateway.

**Event sourcing / outbox**: Gateway events are persisted to SQLite, then fanned out to browser SSE subscribers. Supports Last-Event-ID replay on reconnect.

**Workflow/operation naming**: Complex operations use `*Workflow.ts` (pure planning functions) and `*Operation.ts` (side-effectful executors) suffixes. Workflows produce plans; operations execute them.

**Process singleton**: `ControlPlaneRuntime` is stored on `globalThis` to ensure one instance per Node.js process (important for Next.js hot reload).

## Path Alias

`@/` maps to `./src/` in both TypeScript and Vitest:
```typescript
import { something } from "@/lib/gateway/agentConfig";
// resolves to: ./src/lib/gateway/agentConfig.ts
```

## Important Caveats

- `next.config.ts` has `ignoreBuildErrors: true` — production builds skip type checking. Type errors are caught by `npm run typecheck` but not by `npm run build`. This is a known issue with a TODO to fix.
- The `server/` directory is plain JavaScript (CommonJS), not TypeScript. This is intentional — it's the entry point that boots Next.js.
- The main `page.tsx` is ~1,935 lines with 30+ useState calls. This is the primary refactoring target. It orchestrates the entire application — gateway connection, agent state, settings, modals, tabs, SSE events, approvals, cron, and all UI layout.
- TypeScript strict mode is enabled. The codebase has zero `@ts-ignore`, `@ts-expect-error`, or `as any` casts.

## Security Rules

- Never commit tokens, passwords, or SSH keys.
- Never expose gateway credentials in browser-accessible code.
- Always redact tokens in logs and responses (browser only sees `hasToken: true`).
- The gateway adapter enforces a 29-method allowlist — no wildcard RPC calls.
- Rate limiting is applied per-client-IP (30/s for chat, 60/s default).

## Testing Conventions

- Unit tests go in `tests/unit/` and follow the pattern `tests/unit/<moduleName>.test.ts`.
- Tests use Vitest with jsdom environment. Import from `vitest` (`describe`, `it`, `expect`).
- E2E tests go in `tests/e2e/` as `*.spec.ts` files using Playwright.
- Test setup in `tests/setup.ts` provides a `localStorage` polyfill for jsdom.
- Workflow tests focus on pure planning functions and their decision outputs.
- Operation tests mock side effects (fetch, gateway calls) and verify orchestration.

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

## Related Documentation

- `docs/ARCHITECTURE.md` — Technical deep-dive (data flow, API routes, durability model, security)
- `docs/CONTRIBUTING.md` — Development setup, testing, commit conventions, PR guidelines
- `docs/permissions-sandboxing.md` — Security and permissions model
- `docs/CHANGELOG.md` — Release history
