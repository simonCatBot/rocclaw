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

Verify native dependencies are healthy:

```bash
npm run verify:native-runtime:check
# If errors: npm run verify:native-runtime:repair
```

Start the dev server:

```bash
npm run dev
```

Connect at [http://localhost:3000](http://localhost:3000) with your gateway URL and token (`openclaw config get gateway.auth.token`).

## Development Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:turbo` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run typecheck` | TypeScript strict checking |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run e2e` | E2E tests (Playwright) |

Before submitting changes:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

E2E tests require Playwright browsers: `npx playwright install`

## Testing

**Unit tests** (`tests/unit/`): Vitest with jsdom environment. Follow the pattern `tests/unit/<moduleName>.test.ts`.

**E2E tests** (`tests/e2e/`): Playwright specs as `*.spec.ts` files.

**Conventions:**
- Workflow tests focus on pure planning functions and their decision outputs
- Operation tests mock side effects (fetch, gateway calls) and verify orchestration
- Test setup in `tests/setup.ts` provides a `localStorage` polyfill for jsdom

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

## Troubleshooting Setup

**`better-sqlite3` compilation errors:**
```bash
npm run verify:native-runtime:repair
# macOS: xcode-select --install
# Ubuntu: sudo apt install build-essential python3
```

**Node version mismatch:**
```bash
nvm use  # reads .nvmrc
```

**SQLite errors on startup:**
```bash
npm run verify:native-runtime:repair
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
