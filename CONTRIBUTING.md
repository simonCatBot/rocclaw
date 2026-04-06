# 🤝 Contributing to rocCLAW

> ⚠️ **Alpha Preview** — Contribution guidelines are a starting point. As the project matures, these will evolve. Please ask in Discussions before investing time in large contributions.

Thank you for your interest in making rocCLAW better! This guide will help you get set up and contribute effectively.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites) — What you need before starting
2. [Understanding the Scope](#understanding-the-scope) — What this repo is and isn't
3. [Setup Guide](#local-setup) — Step-by-step installation
4. [Development Workflow](#development-scripts) — Commands you'll use daily
5. [Testing](#testing) — How to ensure quality
6. [Commit Guidelines](#commit-message-convention) — How to write good commits
7. [Pull Requests](#pull-requests) — Submission guidelines

---

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Why |
|-------------|---------|-----|
| **Node.js** | ≥ 20.9.0 (LTS) | Next.js 16 and React 19 compatibility |
| **npm** | ≥ 10.x | Bundled with Node 20+ |
| **OpenClaw Gateway** | Latest | For testing integration |

### Checking Your Environment

```bash
# Verify Node version
node --version
# Should output: v20.9.0 or higher

# Verify npm version
npm --version
# Should output: 10.x.x or higher

# Check if using nvm
nvm --version
# If installed, you can use: nvm use (reads .nvmrc)
```

---

## Understanding the Scope

### ✅ This Repo Is...

- **UI-only** — A dashboard interface for OpenClaw
- **Gateway Client** — Reads config from `~/.openclaw`, communicates via WebSocket
- **Server-Side Proxy** — Browser never connects directly to gateway

### ❌ This Repo Is NOT...

- The OpenClaw gateway itself
- A standalone AI runtime
- A replacement for `openclaw` CLI commands

**Want to work on the gateway?** → See [openclaw/openclaw](https://github.com/openclaw/openclaw)

---

## Local Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment (Optional)

```bash
# Copy the example environment file
cp .env.example .env

# Edit as needed
nano .env  # or your preferred editor
```

**Default `.env`:**
```bash
# Gateway connection (default: local development)
NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_STATE_DIR=~/.openclaw
```

### Step 4: Verify Native Runtime

```bash
# Check if native dependencies are healthy
npm run verify:native-runtime:check

# If you see errors, repair them:
npm run verify:native-runtime:repair
```

### Step 5: Start Development Server

```bash
npm run dev
```

**Expected output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Step 6: Connect to Gateway

1. Open [http://localhost:3000](http://localhost:3000)
2. Enter your gateway URL: `ws://127.0.0.1:18789`
3. Get your token:
   ```bash
   openclaw config get gateway.auth.token
   ```
4. Paste the token and click **Save Settings**

🎉 You're ready to develop!

---

## Troubleshooting Setup

### ❌ `better-sqlite3` Fails to Compile

**Symptoms:** Native module compilation errors during `npm install`

**Solution:**

```bash
# Step 1: Try the repair script
npm run verify:native-runtime:repair

# Step 2: Install build tools if still failing

# macOS:
xcode-select --install

# Ubuntu/Debian:
sudo apt install build-essential python3

# Alpine:
apk add python3 make g++

# Step 3: Rebuild
npm run verify:native-runtime:repair
```

### ❌ `npm run dev` Exits Immediately

**Symptoms:** Process exits with status 1, no error message

**Solution (Last Resort):**

```bash
# Skip native runtime verification (NOT recommended for development)
OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY=1 npm run dev
```

**⚠️ Warning:** This only hides the problem. Native dependency issues will surface at runtime.

### ❌ Node Version Mismatch

**Symptoms:** Build errors, unexpected behavior

**Solution:**

```bash
# Check active version
node --version
npm --version

# If using nvm:
nvm use
# Reads .nvmrc and switches automatically

# If not using nvm, manually switch:
nvm install 20
nvm use 20
```

### ❌ SQLite Errors on Startup

**Symptoms:** Database connection errors

**Solution:**

```bash
# Re-link native module against current Node
npm run verify:native-runtime:repair
```

---

## Development Scripts

### Daily Development

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run dev` | Start dev server with hot reload | Every development session |
| `npm run dev:turbo` | Start with Turbopack (experimental) | When you want faster builds |
| `npm run build` | Production build | Before deploying |
| `npm run start` | Production server | After building |

### Code Quality

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run lint` | ESLint check | Before committing |
| `npm run typecheck` | TypeScript validation | Before committing |
| `npm run lint:fix` | Auto-fix linting issues | When lint fails |

### Testing

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run test` | Unit tests (Vitest) | After changes to logic |
| `npm run test:watch` | Unit tests in watch mode | During TDD |

### Maintenance

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run verify:native-runtime:check` | Check native dependencies | When something feels off |
| `npm run verify:native-runtime:repair` | Fix native dependencies | When check fails |
| `npm run cleanup:ux-artifacts` | Clean UX audit files | Before committing UX work |

### Running the Full Test Suite

Before submitting a PR:

```bash
# Full validation pipeline
npm run lint
npm run typecheck
npm run test
npm run e2e
```

**⚠️ Note:** E2E tests require Playwright installation:
```bash
npx playwright install
```

---

## Testing

### Unit Tests (Vitest)

Located in: `tests/unit/**/*.test.ts`

**Running tests:**

```bash
# Run once
npm run test

# Run in watch mode (for development)
npm run test:watch

# Run with coverage
npm run test -- --coverage
```

**Example test:**

```typescript
// tests/unit/example.test.ts
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(true);
  });
});
```

### End-to-End Tests (Playwright)

Located in: `tests/e2e/**/*.spec.ts`

**Running tests:**

```bash
# Install Playwright browsers (one-time)
npx playwright install

# Run all E2E tests
npm run e2e

# Run with UI mode (for debugging)
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/chat.spec.ts
```

---

## UX Audit Cleanup

When running UX audits or localhost testing:

```bash
# Always run this before committing UX-related work
npm run cleanup:ux-artifacts
```

**This clears:**
- `output/playwright/ux-audit/`
- `.agent/ux-audit.md`
- `.agent/execplan-pending.md`

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Use For | Example |
|------|---------|---------|
| `feat:` | New features | `feat: add dark mode toggle` |
| `fix:` | Bug fixes | `fix: resolve connection retry loop` |
| `docs:` | Documentation | `docs: update setup instructions` |
| `chore:` | Maintenance | `chore: update dependencies` |
| `refactor:` | Code restructuring | `refactor: simplify auth flow` |
| `test:` | Testing | `test: add agent store tests` |
| `style:` | Formatting | `style: fix indentation` |

### Examples

```bash
# Good commits
git commit -m "feat: add cron job scheduling UI"
git commit -m "fix: handle gateway disconnect gracefully"
git commit -m "docs: add troubleshooting section to README"
git commit -m "refactor: extract event handler into module"
```

---

## Pull Requests

### Guidelines

✅ **Do:**
- Keep PRs focused and small
- Prefer **one task → one PR**
- Link to relevant issue/task
- Include tests you ran
- Call out gateway behavior changes explicitly
- Run `npm run cleanup:ux-artifacts` if applicable

❌ **Don't:**
- Submit PRs with failing tests
- Mix unrelated changes
- Include UX artifacts in commits

### PR Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Change 1
- Change 2

## Testing
- [ ] `npm run lint` (results: ✅)
- [ ] `npm run typecheck` (results: ✅)
- [ ] `npm run test` (results: ✅)
- [ ] `npm run e2e` (results: N/A or ✅)

## Screenshots (if UI changes)
Before/after screenshots

## AI-assisted
- [ ] Yes (describe what and include prompts/logs)
- [ ] No
```

---

## Reporting Issues

### Issue Template

```markdown
## Summary
One-line description of the issue.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: macOS 14.2 / Ubuntu 22.04 / Windows 11
- Node: 20.9.0
- UI version/commit: abc1234
- Gateway version: 1.2.3
- Gateway running: yes/no

## Logs/Screenshots
```

---

## Getting Help

- **Discord:** [Join our community](https://discord.gg/EFkFHbZw)
- **Issues:** [GitHub Issues](../../issues)
- **Documentation:** [README](../README.md), [Architecture](../ARCHITECTURE.md)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).

---

<div align="center">

**Happy coding! 🚀**

</div>
