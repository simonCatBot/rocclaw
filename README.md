<div align="center">

<img src="public/logo.png" alt="rocCLAW" width="280" />

# rocCLAW

**The dashboard for your AI agents.**

Monitor, chat, configure, and schedule your OpenClaw agents — from any browser, anywhere.

[![Node.js](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![GitHub Release](https://img.shields.io/github/v/release/simoncatbot/rocclaw?include_prereleases&logo=github)](https://github.com/simoncatbot/rocclaw/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## Why rocCLAW?

OpenClaw is powerful — but it's headless. You manage agents from the terminal, check logs in the shell, and approve commands by pasting tokens. That works fine on your workstation. It falls apart when your gateway is on a VPS, a Raspberry Pi, or another room.

**rocCLAW gives your agents a face.** Point your browser at any OpenClaw gateway — local, Tailscale, or SSH-tunneled — and everything is right there.

---

## What You Can Do

### 💬 Chat with any agent

Real-time streaming conversations with thinking traces, tool call visibility, and inline exec approvals. Approve or deny shell commands right in the chat — allow-once, allow-always, or deny. No context switching, no copy-pasting tokens.

### 🧠 Make agents smarter with skills

Browse and install skills from **ClawHub** — a curated marketplace of pre-built agent capabilities — right from the dashboard. Assign skills per-agent with one click. No editing config files, no restarting.

**Featured skills include:**

| Skill | What it does |
|-------|-------------|
| 🦞 **Proactive Agent** | Turns task-followers into proactive partners — anticipates needs, self-schedules crons, maintains a working buffer |
| 🔄 **Self-Improving Agent** | Self-reflection, self-criticism, self-learning, self-organizing memory. Agents evaluate their own work and improve permanently |
| 📋 **Plan First** | Generates a detailed plan before execution. Based on Plan-and-Solve research — breaks complex tasks into validated steps |
| 🔁 **ReAct Loop** | Interleaves reasoning with actions, observing results to inform next steps. Great for debugging, research, and data analysis |
| ⚖️ **Agent Debate** | Multiple agents independently answer, then critique each other's responses to reduce hallucinations and explore viewpoints |
| 🔍 **Self-Critique** | Structured self-review against quality criteria before finalizing output. Based on Constitutional AI research |
| 👨‍💻 **Team Code** | Coordinate multiple agents as a development team working in parallel on different parts of your codebase |
| 🤝 **Multi-Agent Collaboration** | Intent recognition, intelligent routing, reflection mechanisms, and user adaptation across agent teams |
| 🛠️ **Skill Creator** | Create, edit, improve, or audit AgentSkills. Build new skills from scratch validated against the spec |
| 🐙 **GitHub** | Issues, PRs, CI runs, code review, and API queries via `gh` CLI. Essential for any development workflow |

Skills are **per-agent** — assign Proactive Agent to your main agent and Team Code to your dev agent. Mix and match for the behavior you want.

### 📊 Monitor your fleet at a glance

Live CPU, memory, GPU (AMD ROCm + fallback), disk, and network metrics with time-series graph views. Per-agent token usage dashboards. Works for local machines **and** remote gateways — see "Remote" vs "Local" labels automatically.

### ⏰ Put agents on autopilot

Schedule cron jobs with drag-and-drop. Interval, daily, or cron expression — your agents run on your schedule. No crontab editing required.

### ⚙️ Configure without SSH

Edit any agent's 7 personality files (SOUL, IDENTITY, USER, AGENTS, TOOLS, HEARTBEAT, MEMORY) directly in the browser. Adjust permissions — exec mode, sandbox, workspace access, tool profiles — without touching the terminal.

### 🖥️ Access from anywhere

Connect to any OpenClaw gateway via LAN, Tailscale, or SSH tunnel. Your gateway stays secure; you stay mobile. Three setup modes cover every deployment pattern.

### 🔒 Stay in control

Three-layer security: network policy refuses public binding without an access token, cookie-based auth guards all API routes, and a 29-method allowlist on the gateway adapter prevents unauthorized operations. Ed25519 device identity provides cryptographic authentication. Your tokens never leave the server — the browser only sees `hasToken: true`.

---

## Quick Start

**Prerequisites:** Node.js 20.9+ and a running OpenClaw gateway.

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your gateway URL (`ws://127.0.0.1:18789`), paste your token, and click **Save Settings**.

Get your token:

```bash
openclaw config get gateway.auth.token
```

That's it. You're in.

---

## Installation

### npm (recommended)

```bash
npm install -g @simoncatbot/rocclaw
rocclaw
```

### Pre-built package

Download from [GitHub Releases](https://github.com/simoncatbot/rocclaw/releases):

```bash
# Linux/macOS
curl -L -o rocclaw.tar.gz https://github.com/simoncatbot/rocclaw/releases/latest/download/rocclaw-linux-x64.tar.gz
tar -xzf rocclaw.tar.gz && cd rocclaw
npm ci --include=dev && node server/index.js
```

### From source

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

---

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

Start with `npm run dev`, open [http://localhost:3000](http://localhost:3000), enter the URL and token, then click **Save Settings**.

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

On your local machine, start rocCLAW and enter `wss://my-gateway.ts.net` as the gateway URL. Use `wss://` (WebSocket Secure) when connecting via Tailscale.

</details>

<details>
<summary><strong>Remote Gateway via SSH Tunnel</strong></summary>

```bash
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Keep the terminal open, then connect rocCLAW to `ws://localhost:18789`.

</details>

---

## Dashboard Overview

rocCLAW provides 8 toggleable tabs that can be shown side-by-side:

| Tab | What it's for |
|-----|--------------|
| **Agents** | Fleet sidebar — search, filter, status, avatars, identity names |
| **Chat** | Streaming conversations with thinking traces and tool calls |
| **Skills** | ClawHub marketplace + per-agent skill assignment + install management |
| **Connection** | Gateway URL, token, connection testing |
| **System** | Live CPU, memory, GPU, disk, and network metrics |
| **Graph** | Time-series charts for system metrics (5m/10m/30m ranges) |
| **Tasks** | Cron job management — schedule, reorder, manual run |
| **Tokens** | Per-agent and aggregate token usage |
| **Settings** | Application preferences |

---

## Agent Personality Files

Each agent is shaped by 7 personality files you can edit directly in the dashboard:

| File | What it defines |
|------|----------------|
| `IDENTITY.md` | Name, creature type, vibe, emoji, avatar |
| `SOUL.md` | Core truths, boundaries, personality, continuity |
| `USER.md` | Context about you — name, pronouns, timezone, preferences |
| `AGENTS.md` | Operating rules, workflows, conventions |
| `TOOLS.md` | Tool usage guidelines and local notes |
| `HEARTBEAT.md` | Periodic check configuration |
| `MEMORY.md` | Persistent memory and learned context |

---

## Permissions & Security

rocCLAW keeps your gateway safe at three layers:

| Layer | What it does |
|-------|-------------|
| **Network Policy** | Refuses public IP binding without `ROCCLAW_ACCESS_TOKEN` |
| **Access Gate** | Cookie-based auth for all API routes and WebSocket upgrades |
| **Gateway Adapter** | 29-method allowlist, token redaction, per-IP rate limiting |

Per-agent security settings:

- **Exec Mode** — Conservative / Collaborative / Autonomous
- **Sandbox** — Off / Non-main / All
- **Workspace Access** — None / Read-only / Read-write
- **Tools Profile** — Minimal / Coding / Messaging / Full
- **Exec Security** — Deny / Allowlist / Full

See [Permissions & Sandboxing](docs/permissions-sandboxing.md) for details.

---

## Development

```bash
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm run start        # Build + start production server
npm run typecheck    # TypeScript strict checking
npm run lint         # ESLint
npm run test         # Unit tests (Vitest, 145 files, 1,091 tests)
npm run e2e          # E2E tests (Playwright, 11 specs)
```

Run all checks before submitting:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

See [Contributing](docs/CONTRIBUTING.md) for full development setup.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Control ui requires device identity` | Run `openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true && openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true && openclaw gateway restart` |
| Connection test passes but dashboard won't load | Use `127.0.0.1` or `localhost` in the gateway URL, not a LAN IP |
| SQLite errors on startup | Run `npm run dev` (auto-repairs native deps) or `npx scripts/verify-native-runtime.mjs --repair` |
| Agent won't respond (shows offline) | Try "New Session" in the chat header |
| 401 errors | Regenerate token: `openclaw config get gateway.auth.token` |
| GPU not detected | ROCm is checked first (`rocminfo` + `rocm-smi`); if unavailable, falls back to `lspci` + DRM sysfs on Linux |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Technical deep-dive: data flow, API routes, durability model, security |
| [Contributing](docs/CONTRIBUTING.md) | Development setup, testing, commit conventions, PR guidelines |
| [Permissions & Sandboxing](docs/permissions-sandboxing.md) | Security model, sandbox modes, exec approvals, tool policies |
| [Changelog](docs/CHANGELOG.md) | Release history |

---

<div align="center">

[Documentation](docs/) &middot; [Issues](../../issues) &middot; [Discord](https://discord.gg/EFkFHbZw)

</div>