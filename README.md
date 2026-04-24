<div align="center">

<img src="public/logo.png" alt="rocCLAW" width="280" />

# rocCLAW

**Operator dashboard for managing OpenClaw AI agents**

[![Node.js](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![GitHub Release](https://img.shields.io/github/v/release/simoncatbot/rocclaw?include_prereleases&logo=github)](https://github.com/simoncatbot/rocclaw/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green)](https://github.com/simoncatbot/rocclaw)

</div>

---

## About

rocCLAW is a web-based dashboard for managing [OpenClaw](https://github.com/openclaw/openclaw) AI agents. It acts as a secure proxy between your browser and the OpenClaw gateway, so you can connect from any client machine -- a laptop, a workstation, or a remote desktop -- to an OpenClaw instance running anywhere on your network. No need to SSH into the gateway host or work from the terminal. Just point rocCLAW at your gateway (locally, over Tailscale, or through an SSH tunnel) and manage everything from the browser.

**Key capabilities:**

- **Remote access** -- Connect to any OpenClaw gateway from any machine on your network, via LAN, Tailscale, or SSH tunnel
- **Agent management** -- Create, configure, rename, and organize AI agents with 7 personality files (SOUL, IDENTITY, USER, AGENTS, TOOLS, HEARTBEAT, MEMORY)
- **Real-time chat** -- Interactive conversations with streaming responses, tool call visibility, thinking traces, and inline exec approvals
- **System monitoring** -- Live CPU, memory, GPU (AMD ROCm + fallback), disk, and network metrics with time-series graph views
- **Task scheduling** -- Cron jobs with drag-and-drop reordering that run agents on autopilot (interval, daily, and cron expression schedules)
- **Token usage tracking** -- Per-agent and aggregate token usage dashboards
- **Exec approvals** -- Approve or deny agent shell commands inline with allow-once, allow-always, and deny options
- **Permissions & sandboxing** -- Per-agent sandbox modes, workspace access controls, tool profiles, and exec security policies
- **Avatar system** -- Auto-generated (Multiavatar), default cat profiles, or custom URL avatars per agent
- **Ed25519 device identity** -- Cryptographic device authentication for gateway handshake

## Architecture

```
Browser (React)  <--HTTP/SSE-->  rocCLAW Server (Next.js + SQLite)  <--WebSocket-->  OpenClaw Gateway
```

The server mediates all communication. The browser never connects directly to the gateway and never sees raw tokens.

**How it works:**

- **Write operations** flow through 16 intent routes (`POST /api/intents/*`) -- the server validates, rate-limits (30/s chat, 60/s default), and forwards to the gateway via WebSocket
- **Read operations** flow through 11 runtime routes (`GET /api/runtime/*`) -- fleet listing, config, models, agent history, media, and more
- **Real-time events** use SSE with SQLite-backed replay -- gateway events are persisted to an outbox table, then fanned out to browser subscribers. On reconnect, the browser sends `Last-Event-ID` and the server replays missed events
- **Security** is enforced at three layers: network policy (refuses public binding without access token), cookie-based access gate (`ROCCLAW_ACCESS_TOKEN`), and a 29-method allowlist on the gateway adapter

## Quick Start

**Prerequisites:** Node.js 20.9+ and a running OpenClaw gateway.

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your gateway URL (`ws://127.0.0.1:18789`), paste your token, and click **Save Settings**.

To get your gateway token:

```bash
openclaw config get gateway.auth.token
```

## Installation

### Pre-built Package

Download from [GitHub Releases](https://github.com/simoncatbot/rocclaw/releases):

```bash
# Linux/macOS
curl -L -o rocclaw.tar.gz https://github.com/simoncatbot/rocclaw/releases/latest/download/rocclaw-linux-x64.tar.gz
tar -xzf rocclaw.tar.gz && cd rocclaw
npm ci --include=dev && node server/index.js

# Windows: download rocclaw-windows-x64.zip, extract, run the same commands
```

### npm

```bash
npm install -g @simoncatbot/rocclaw
rocclaw
```

### From Source

```bash
git clone https://github.com/simoncatbot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

## Setup Guides

<details>
<summary><strong>Same-Machine Setup</strong></summary>

For running OpenClaw and rocCLAW on the same machine:

```bash
# Configure the gateway
openclaw config set gateway.bind lan
openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
openclaw gateway restart

# Get your token
openclaw config get gateway.auth.token
```

Start with `npm run dev`, open [http://localhost:3000](http://localhost:3000), enter the URL and token, then click **Save Settings**. No `.env` file is needed — the gateway URL defaults to `ws://localhost:18789` and all settings are configurable through the UI.

> **Note:** The `dangerously*` flags relax security checks. Only use on trusted local networks.

</details>

<details>
<summary><strong>Remote Gateway via Tailscale</strong></summary>

On the gateway machine:

```bash
ip addr show tailscale0 | grep inet  # Find your Tailscale IP (100.x.x.x)
openclaw config set gateway.bind 100.x.x.x
openclaw gateway restart
```

On your local machine, start rocCLAW and enter `wss://my-gateway.ts.net` as the gateway URL in the connection settings. Use `wss://` (WebSocket Secure) when connecting via Tailscale.

</details>

<details>
<summary><strong>Remote Gateway via SSH Tunnel</strong></summary>

```bash
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Keep the terminal open, then connect rocCLAW to `ws://localhost:18789`.

</details>

## Dashboard Tabs

rocCLAW provides 8 toggleable dashboard tabs that can be shown side-by-side:

| Tab | Description |
|-----|-------------|
| **Agents** | Fleet sidebar with agent cards, search/filter, status indicators, avatars, and identity names |
| **Chat** | Real-time streaming chat with the focused agent, including thinking traces and tool calls |
| **Connection** | 4-tab gateway connection settings with connection testing |
| **System** | Live system metrics -- CPU cores/threads, memory, GPU (ROCm + fallback), disk, and network |
| **Graph** | Time-series graph view of system metrics history |
| **Tasks** | Cron job management with drag-and-drop, interval/daily/cron scheduling, and manual run |
| **Tokens** | Per-agent and aggregate token usage tracking |
| **Settings** | Application settings and preferences |

## Agent Configuration

Each agent has 7 personality files that define its behavior:

| File | Purpose |
|------|---------|
| `IDENTITY.md` | Agent metadata -- name, creature type, vibe, emoji, avatar |
| `SOUL.md` | Core truths, boundaries, vibe, and continuity principles |
| `USER.md` | Context about the human operator -- name, pronouns, timezone |
| `AGENTS.md` | Operating rules and workflows |
| `TOOLS.md` | Tool usage guidelines and preferences |
| `HEARTBEAT.md` | Periodic heartbeat configuration |
| `MEMORY.md` | Persistent memory and learned context |

## Permissions

| Setting | Options | Description |
|---------|---------|-------------|
| Exec Mode | `Conservative` / `Collaborative` / `Autonomous` | Approval policy for shell commands |
| Sandbox Mode | `Off` / `Non-main` / `All` | Container isolation for sessions |
| Workspace Access | `None` / `Read-only` / `Read-write` | Filesystem visibility in sandbox |
| Tools Profile | `Minimal` / `Coding` / `Messaging` / `Full` | Available tool groups with allow/deny lists |
| Exec Security | `Deny` / `Allowlist` / `Full` | Shell command security level |
| Exec Ask | `Off` / `On miss` / `Always` | When to prompt for command approval |

See [Permissions & Sandboxing](docs/permissions-sandboxing.md) for details.

## Security

rocCLAW enforces a three-layer security model:

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| **Network Policy** | Refuses public IP binding without `ROCCLAW_ACCESS_TOKEN` | Server startup |
| **Access Gate** | Cookie-based auth for all `/api/*` routes and WebSocket upgrades | HTTP layer |
| **Gateway Adapter** | 29-method allowlist, token redaction, per-IP rate limiting | RPC layer |

Additional security measures:
- Ed25519 device identity with challenge-response gateway authentication
- Gateway tokens stored server-side only -- browser sees `hasToken: true`, never raw values
- Rate limiting: 30 req/s for chat, 60 req/s for other intents, per client IP
- Device keypair stored at `~/.openclaw/openclaw-rocclaw/device.json` with `0o600` permissions

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16.1.6, React 19.2.3, TypeScript 5 (strict) |
| Styling | Tailwind CSS v4, shadcn/ui (New York style, zinc base) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Gateway Communication | WebSocket (`ws`) with Ed25519 auth |
| State Management | React Context + `useReducer` |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Icons | Lucide React |
| Markdown | react-markdown + remark-gfm |
| Server | Custom Node.js entry point (`server/index.js`) |

## Project Structure

```
src/
  app/
    page.tsx                          # Main orchestrator page
    layout.tsx                        # Root layout with fonts and theme
    api/
      intents/                        # 16 POST routes — write operations
      runtime/                        # 11 GET routes — read operations
      rocclaw/                        # Settings management + connection test
      cron/                           # Cron job management
      gateway-info/                   # Gateway information
      gateway-metrics/                # System metrics (local + remote)
      usage/                          # Token usage data
    styles/                           # Modular CSS: tokens, components, chat, typography
  components/                         # Shared UI (ConnectionPage, SystemMetrics, Tasks, etc.)
  features/agents/
    components/                       # Agent UI (ChatPanel, InspectPanels, FleetSidebar, etc.)
    operations/                       # Workflow (pure planning) + Operation (side effects)
    state/                            # AgentStore (Context+useReducer), SSE stream hook
    approvals/                        # Exec approval system (10 files, fully wired e2e)
  lib/
    controlplane/                     # Runtime singleton, WebSocket adapter, SQLite outbox
    gateway/                          # Gateway client abstractions and agent config
    rocclaw/                          # Settings store and coordinator
    system/                           # ROCm GPU detection + fallback (AMD GPUs)
    text/                             # Markdown, message extraction, media
    agents/                           # Agent files and personality builder
    cron/                             # Cron payload builder and types
server/
  index.js                            # Custom Node.js entry point (plain JS)
  access-gate.js                      # Cookie-based auth
  network-policy.js                   # Public IP binding protection
  rocclaw-settings.js                 # Settings resolution cascade
  rocclaw-install-context.js          # Startup environment detection
tests/
  unit/                               # 145 Vitest test files (1,091 tests)
  e2e/                                # 11 Playwright spec files
  setup.ts                            # Test setup (localStorage polyfill)
```

## Development

```bash
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm run start        # Build + start production server
npm run typecheck    # TypeScript strict checking (tsc --noEmit)
npm run lint         # ESLint
npm run test         # Unit tests (Vitest, 145 files, 1,091 tests)
npm run e2e          # E2E tests (Playwright, 11 specs)
```

Run all checks before submitting:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

See [Contributing](docs/CONTRIBUTING.md) for full development setup.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Control ui requires device identity` | Run `openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true && openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true && openclaw gateway restart` |
| Connection test passes but dashboard won't load | Use `127.0.0.1` or `localhost` in the gateway URL, not a LAN IP |
| SQLite errors on startup | Run `npm run dev` (auto-repairs native deps) or `npx scripts/verify-native-runtime.mjs --repair` |
| Agent won't respond (shows as offline) | Try "New Session" in the chat header |
| 401 errors | Regenerate token: `openclaw config get gateway.auth.token` |
| System metrics showing wrong Local/Remote label | Ensure the gateway-metrics route detects your connection correctly; metrics are routed through the gateway for remote connections |
| GPU not detected | ROCm is checked first (`rocminfo` + `rocm-smi`); if unavailable, falls back to `lspci` + DRM sysfs on Linux |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Technical deep-dive: data flow, API routes, durability model, security |
| [Contributing](docs/CONTRIBUTING.md) | Development setup, testing, commit conventions, PR guidelines |
| [Permissions & Sandboxing](docs/permissions-sandboxing.md) | Security model, sandbox modes, exec approvals, tool policies |
| [Changelog](docs/CHANGELOG.md) | Release history |

## License

[MIT](LICENSE)

---

<div align="center">

[Documentation](docs/) &middot; [Issues](../../issues) &middot; [Discord](https://discord.gg/EFkFHbZw)

</div>
