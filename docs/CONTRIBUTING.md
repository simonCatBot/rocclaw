# Contributing

Guide for developing and contributing to rocCLAW.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | >= 20.9.0 (LTS) |
| npm | >= 10.x |
| OpenClaw Gateway | Latest (for integration testing) |

Use `nvm use` to switch to the pinned version from `.nvmrc`.

## Setup

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install
```

Native dependencies (`better-sqlite3`) are automatically verified on dev startup. If you encounter issues:

```bash
# Dev mode auto-repairs:
npm run dev

# Manual repair:
node scripts/verify-native-runtime.mjs --repair

# macOS: xcode-select --install
# Ubuntu: sudo apt install build-essential python3
```

Start the dev server:

```bash
npm run dev
```

Connect at [http://localhost:3000](http://localhost:3000) with your gateway URL and token (`openclaw config get gateway.auth.token`).

## Development Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with hot reload (auto-repairs native deps) |
| `npm run dev:turbo` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Build + start production server |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript strict checking (`tsc --noEmit`) |
| `npm run test` | Unit tests (Vitest) |
| `npm run e2e` | E2E tests (Playwright) |

Before submitting changes:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

E2E tests require Playwright browsers: `npx playwright install`

## Project Structure

```
src/
  app/
    page.tsx                  # Main orchestrator page (~1,650 lines)
    layout.tsx                # Root layout with fonts and theme
    api/
      intents/                # 16 POST routes — write operations
      runtime/                # 11 GET routes — read operations
      rocclaw/                # Settings management + connection test
      cron/                   # Cron job management
      gateway-info/           # Gateway information
      gateway-metrics/        # System metrics (local + remote)
      usage/                  # Token usage data
    styles/                   # Modular CSS tokens and components
  components/                 # Shared UI components
  features/agents/
    components/               # Agent-specific UI
    operations/               # Workflow (pure) + Operation (side effects) files
    state/                    # AgentStore, SSE stream hook, transcript
    approvals/                # Exec approval system (10 files)
  lib/
    controlplane/             # Runtime singleton, WebSocket adapter, SQLite outbox
    gateway/                  # Gateway client abstractions
    rocclaw/                  # Settings store and coordinator
    system/                   # GPU detection (ROCm + fallback)
    text/                     # Markdown, message extraction, media
    agents/                   # Agent files and personality builder
    cron/                     # Cron payload builder and types
server/                       # Plain JS entry point (CJS, not TypeScript)
tests/
  unit/                       # 145 Vitest test files (1,091 tests)
  e2e/                        # 11 Playwright spec files
  setup.ts                    # Test setup (localStorage polyfill)
```

## Testing

### Unit Tests

- **Location:** `tests/unit/`
- **Runner:** Vitest with jsdom environment
- **Pattern:** `tests/unit/<moduleName>.test.ts`
- **Count:** 145 files, 1,091 tests

**Conventions:**
- Workflow tests focus on pure planning functions and their decision outputs — no mocking needed
- Operation tests mock side effects (fetch, gateway calls) and verify orchestration
- Tests needing Node.js (not jsdom) use `// @vitest-environment node` at the top
- Import from `vitest` (`describe`, `it`, `expect`, `vi`) and use `@/` path aliases
- Rate limit tests use unique keys per test to avoid cross-test state pollution
- Agent state tests use factory functions with defaults and overrides
- `vi.doMock()` for module-level mocks, `vi.fn()` for function mocks, `vi.stubGlobal("fetch", ...)` for global fetch

### E2E Tests

- **Location:** `tests/e2e/`
- **Runner:** Playwright
- **Pattern:** `*.spec.ts`
- **Count:** 11 specs

**Conventions:**
- API routes are stubbed using helper functions (`stubRocclawRoute`, `stubRuntimeRoutes`)
- Network interception verifies actual API call payloads
- Selectors: `getByTestId()`, `getByRole()`, `getByLabel()`, `getByText()`

### Test Setup

`tests/setup.ts` provides:
- `@testing-library/jest-dom/vitest` for DOM assertion matchers
- A `localStorage` polyfill (Map-backed) for jsdom environments

## Architecture Patterns

### Workflow / Operation Pattern

Complex operations are split into two layers:

- **`*Workflow.ts`** — Pure planning functions. Accept data, return intent objects. No side effects. Easily unit-testable.
- **`*Operation.ts`** — Side-effectful executors. Call workflows, execute plans (fetch, gateway calls, state mutations). Return command arrays.
- **`use*Controller.ts`** — React hooks that wire workflows and operations to UI.

### State Management

React Context + `useReducer` in `AgentStoreProvider`. No Redux or Zustand. Actions are dispatched via a wrapped `dispatch` that also updates a `stateRef` for stale-closure protection.

### Transcript Deduplication

FNV-1a fingerprinting (32-bit) with 2-second timestamp bucketing. Entries matched by `entryId` first, then by content similarity (normalized text + matching session/kind/role).

## Scope

This repo is a **UI + server proxy** only. It reads config from `~/.openclaw` and communicates with the OpenClaw gateway via WebSocket. Do not modify gateway source code from this repo.

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

## Pull Requests

- Keep PRs focused — one task per PR
- Include test results (`typecheck`, `lint`, `test`, `build`)
- Call out gateway behavior changes explicitly
- Run `npm run cleanup:ux-artifacts` before committing UX work

## CI Pipeline

GitHub Actions runs on push to `master`/`main` and on PRs. Four parallel jobs:

1. **Lint & Type Check** — `npm run lint` + `npm run typecheck`
2. **Unit Tests** — `npm run test -- --run`
3. **Build** — `npm run build`
4. **E2E Tests** — installs Playwright browsers, runs `npm run e2e`, uploads report on failure

All jobs use Node.js 22 on Ubuntu.

## Troubleshooting Setup

**`better-sqlite3` compilation errors:**
```bash
node scripts/verify-native-runtime.mjs --repair
# macOS: xcode-select --install
# Ubuntu: sudo apt install build-essential python3
```

**Node version mismatch:**
```bash
nvm use  # reads .nvmrc
```

**SQLite errors on startup:**
```bash
npm run dev  # auto-repairs in dev mode
```

**Port already in use:**
```bash
lsof -i :3000  # find the process
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
