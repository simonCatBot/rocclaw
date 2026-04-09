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
- **Agent management** -- Create, configure, and organize AI agents with personality files
- **Real-time chat** -- Interactive conversations with streaming responses, tool call visibility, and thinking traces
- **System monitoring** -- Live CPU, memory, GPU, disk, and network metrics
- **Task scheduling** -- Cron jobs that run agents on autopilot
- **Exec approvals** -- Approve or deny agent commands inline with allow-once, allow-always, and deny options
- **Permissions & sandboxing** -- Per-agent sandbox modes, workspace access controls, and tool policies

## Architecture

```
Browser (React)  <--HTTP/SSE-->  rocCLAW Server (Next.js + SQLite)  <--WebSocket-->  OpenClaw Gateway
```

The server mediates all communication. It handles authentication, rate limiting, event persistence (SQLite outbox), and SSE replay on reconnect. The gateway token never reaches the browser.

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

## Agent Configuration

Each agent has personality files that define its behavior:

| File | Purpose |
|------|---------|
| `SOUL.md` | Core identity and principles |
| `AGENTS.md` | Operating rules and workflows |
| `USER.md` | Context about the human operator |
| `IDENTITY.md` | Agent metadata (name, emoji, avatar) |

## Permissions

| Setting | Options | Description |
|---------|---------|-------------|
| Command Mode | `Off` / `Ask` / `Auto` | Whether commands need approval |
| Sandbox Mode | `Off` / `Non-main` / `All` | Container isolation for sessions |
| Workspace Access | `None` / `Read-only` / `Read-write` | Filesystem visibility in sandbox |
| Tools Profile | `Minimal` / `Coding` / `Messaging` / `Full` | Available tool groups |

See [Permissions & Sandboxing](docs/permissions-sandboxing.md) for details.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16, React 19, TypeScript 5 (strict) |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Gateway Communication | WebSocket (`ws`) |
| State Management | React Context + `useReducer` |
| Server | Custom Node.js entry point (`server/index.js`) |

## Development

```bash
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm run typecheck    # TypeScript strict checking
npm run lint         # ESLint
npm run test         # Unit tests (Vitest)
npm run e2e          # E2E tests (Playwright)
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
| Connection test passes but dashboard won't load | Use `127.0.0.1` or `localhost` in `NEXT_PUBLIC_GATEWAY_URL`, not a LAN IP |
| SQLite errors on startup | Run `npm run verify:native-runtime:repair` |
| Agent won't respond (shows as offline) | Try "New Session" in the chat header |
| 401 errors | Regenerate token: `openclaw config get gateway.auth.token` |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Technical deep-dive: data flow, API routes, durability model |
| [Contributing](docs/CONTRIBUTING.md) | Development setup, testing, commit conventions |
| [Permissions & Sandboxing](docs/permissions-sandboxing.md) | Security model and sandbox configuration |
| [Changelog](docs/CHANGELOG.md) | Release history |

## License

[MIT](LICENSE)

---

<div align="center">

[Documentation](docs/) &middot; [Issues](../../issues) &middot; [Discord](https://discord.gg/EFkFHbZw)

</div>
