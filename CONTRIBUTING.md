# Contributing

Thanks for helping improve rocCLAW.

- For external bugs and feature requests: please use GitHub Issues.
- For repo work tracked by our on-host agent squad: we use Notion.

## Before you start

### Prerequisites

- **Node.js ≥ 20.9.0** (LTS recommended). The repo targets Next.js 16 and React 19, which have specific Node version requirements. Using an older or unstable Node may cause build or runtime issues.
- **OpenClaw Gateway** installed and running. rocCLAW is a dashboard — it reads config from `~/.openclaw` and connects to your gateway via WebSocket.
- **npm ≥ 10.x** (bundled with Node 20+).

### What this repo is (and isn't)

- **UI-only.** This repo does not build or run the OpenClaw gateway.
- It reads existing config from `~/.openclaw/openclaw.json` and communicates with the gateway via its WebSocket API.
- If you want to work on the gateway itself, see the [openclaw/openclaw](https://github.com/openclaw/openclaw) repo.

## Local setup

```bash
# Clone the repo
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw

# Install dependencies
npm install

# Copy and edit env defaults (optional — defaults point to ~/.openclaw)
cp .env.example .env

# Verify native runtime dependencies are available
# This runs automatically before `npm run dev` and `npm run start`.
# If you see SQLite errors, run the repair script:
npm run verify:native-runtime:repair

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect to your gateway at `ws://localhost:18789` (or your gateway's URL + token from `openclaw config get gateway.auth.token`).

### Troubleshooting setup issues

**`better-sqlite3` fails to compile**
```
npm run verify:native-runtime:repair
```
If that doesn't work, ensure you have the proper build tools:
- macOS: `xcode-select --install`
- Ubuntu/Debian: `sudo apt install build-essential python3`
- Alpine: `apk add python3 make g++`

**`npm run dev` exits immediately with status 1**
Set `OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY=1` to bypass the native runtime check (not recommended for development):
```bash
OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY=1 npm run dev
```
This should only be used as a last resort — native dependency issues will surface at runtime instead.

**Node version mismatch**
Ensure `node` and `npm` point to the same runtime:
```bash
node --version
npm --version
```
If you're using nvm: `nvm use` (reads `.nvmrc` automatically).

**SQLite errors on startup**
```bash
npm run verify:native-runtime:repair
```
This re-links the native `better-sqlite3` module against your current Node version.

## Development scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (with native runtime repair) |
| `npm run dev:turbo` | Start dev server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checker |
| `npm run test` | Run unit tests (Vitest, `tests/unit/**/*.test.ts`) |
| `npm run e2e` | Run Playwright end-to-end tests |
| `npm run verify:native-runtime:check` | Check if native runtime is healthy |
| `npm run verify:native-runtime:repair` | Repair/rebuild native runtime |
| `npm run cleanup:ux-artifacts` | Clear UX audit artifacts before committing |

### Running the full test suite

```bash
npm run lint
npm run typecheck
npm run test
npm run e2e   # Requires: npx playwright install
```

## UX audit cleanup

For `localhost-ux-improvement` runs, always clean generated UX artifacts before committing:
```bash
npm run cleanup:ux-artifacts
```
This clears `output/playwright/ux-audit/`, `.agent/ux-audit.md`, and `.agent/execplan-pending.md`.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `chore:` — Maintenance tasks (deps, config, CI)
- `refactor:` — Code refactoring (no behavior change)
- `test:` — Test changes

## Task tracking

We track implementation work for this repo in Notion.

## Pull requests

- Keep PRs focused and small. Prefer **one task → one PR**.
- Include the tests you ran.
- Link to the relevant issue/task.
- If you changed gateway behavior, call it out explicitly.
- Run `npm run cleanup:ux-artifacts` before committing if you've done UX audit work.

## Reporting issues

When filing an issue, please include:

- Reproduction steps
- OS and Node version (`node --version`)
- UI version/commit (`git log -1 --oneline`)
- Gateway version and whether it's running (yes/no)
- Any relevant logs or screenshots

## Minimal PR template

```md
## Summary
-

## Testing
- [ ] Not run (explain why)
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run e2e`

## AI-assisted
- [ ] AI-assisted (briefly describe what and include prompts/logs if helpful)
```

## Minimal issue template

```md
## Summary

## Steps to reproduce
1.

## Expected

## Actual

## Environment
- OS:
- Node:
- UI version/commit:
- Gateway version:
- Gateway running? (yes/no)

## Logs/screenshots
```
```
