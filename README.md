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

OpenClaw agents run on your terms — terminal-driven, scriptable, headless. That's the strength. But when your gateway lives on a VPS, a Pi, or another room, managing agents over SSH gets old fast.

**rocCLAW is the browser interface for OpenClaw.** Point it at any gateway — local, Tailscale, or SSH-tunneled — and your entire agent fleet is right there. Chat, configure, monitor, schedule. No SSH required.

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

```bash
openclaw config get gateway.auth.token   # Get your token
```

Other install options: [npm](#installation) · [pre-built package](#installation) · [setup guides →](#setup-guides)

---

## What You Can Do

### 💬 Chat with any agent

Real-time streaming conversations with thinking traces, tool call visibility, and inline exec approvals. Approve or deny shell commands right in the chat — allow-once, allow-always, or deny. No context switching, no copy-pasting tokens.

### ⏰ Put agents on autopilot

Schedule cron jobs with drag-and-drop. Interval, daily, or cron expression — your agents run on your schedule. No crontab editing required.

### ⚙️ Configure without SSH

Edit any agent's 7 personality files (SOUL, IDENTITY, USER, AGENTS, TOOLS, HEARTBEAT, MEMORY) directly in the browser. Adjust permissions — exec mode, sandbox, workspace access, tool profiles — without touching the terminal.

### 🖥️ Access from anywhere

Connect to any OpenClaw gateway via LAN, Tailscale, or SSH tunnel. Your gateway stays secure; you stay mobile.

### 🔒 Stay in control

Three-layer security: network policy refuses public binding without an access token, cookie-based auth guards all API routes, and a method allowlist on the gateway adapter prevents unauthorized operations. Ed25519 device identity provides cryptographic authentication. Your tokens never leave the server — the browser only sees `hasToken: true`.

Per-agent controls: exec mode · sandbox isolation · workspace access · tools profile · command security. See [Permissions & Sandboxing](docs/permissions-sandboxing.md) for details.

---

## 🧠 Make Agents Smarter with Skills

Browse and install skills from [**ClawHub**](https://clawhub.ai) — the public skill registry for OpenClaw — right from the dashboard. Assign skills per-agent with one click. No editing config files, no restarting the gateway.

Skills are **per-agent** — give your main agent Proactive Agent and your dev agent Team Code. Mix and match for the behavior you want.

**Agent Behavior**
- 🦞 **Proactive Agent** — Anticipates needs, self-schedules crons, maintains a working buffer. Turns task-followers into proactive partners
- 🔄 **Self-Improving Agent** — Self-reflection, self-criticism, self-learning. Evaluates its own work and improves permanently

**Problem Solving**
- 📋 **Plan First** — Generates a detailed plan before execution. Based on Plan-and-Solve research
- 🔁 **ReAct Loop** — Interleaves reasoning with actions, observing results to inform next steps

**Quality & Accuracy**
- ⚖️ **Agent Debate** — Multiple agents independently answer, then critique each other to reduce hallucinations
- 🔍 **Self-Critique** — Structured self-review against quality criteria before finalizing. Based on Constitutional AI research

**Development**
- 👨‍💻 **Team Code** — Coordinate multiple agents as a dev team working in parallel on your codebase
- 🛠️ **Skill Creator** — Build new skills from scratch, validated against the AgentSkills spec
- 🐙 **GitHub** — Issues, PRs, CI runs, code review via `gh` CLI

**Multi-Agent**
- 🎯 **Agent Team Orchestration** — Defined roles, task lifecycles, handoff protocols, review workflows
- 🤝 **Multi-Agent Collaboration** — Intent recognition, intelligent routing, reflection across agent teams

Browse the full catalog at [clawhub.ai](https://clawhub.ai).

---

## 🏗️ Run a Hybrid Local + Cloud Fleet

Not every task needs a cloud model. rocCLAW lets you build a **hybrid agent fleet** — local LLMs handle routine work, cloud models step in for complex reasoning — and manage it all from one dashboard.

**How it works:**

1. **Local agents** run on your hardware with open-weight models (via Ollama, vLLM, or any local provider). They handle the daily load — file operations, simple queries, monitoring, cron tasks. Zero token cost.

2. **Cloud agents** use high-capability models for the hard stuff — complex reasoning, multi-step planning, code generation that needs deep context. You only pay when you need the horsepower.

3. **Per-agent skills** route the right work to the right tier. Assign Plan First and Agent Debate to your cloud agent. Give ReAct Loop and GitHub to your local agent. Skills + model selection = automatic workload tiering.

4. **Token usage dashboards** show you exactly where your spend goes — per agent, per model. No surprise bills.

**The result: maximum hardware utilization, minimum cloud spend.** Your local GPUs run warm instead of idle. Your cloud tokens go to tasks that actually need them.

---

## 📊 System Monitoring

Live CPU, memory, GPU (AMD ROCm + fallback), disk, and network metrics with time-series graph views. Works for local machines **and** remote gateways — see "Remote" vs "Local" labels automatically.

Per-agent and aggregate token usage dashboards so you know exactly what each agent is costing you.

---

## Dashboard Overview

9 toggleable tabs, shown side-by-side:

**Agents** · **Chat** · **Skills** · **Connection** · **System** · **Graph** · **Tasks** · **Tokens** · **Settings**

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

## Agent Personality Files

Every agent has 7 personality files that define its behavior — all editable from the dashboard:

`IDENTITY.md` → name, creature type, vibe, emoji, avatar · `SOUL.md` → core truths, boundaries, personality · `USER.md` → context about you (name, pronouns, timezone) · `AGENTS.md` → operating rules and workflows · `TOOLS.md` → tool usage guidelines · `HEARTBEAT.md` → periodic check configuration · `MEMORY.md` → persistent memory and learned context

---

## Tested Configurations

### Operating Systems

| OS | Version | Status |
|----|---------|--------|
| **Ubuntu** | 24.04 LTS (Noble Numbat) | ✅ Tested |
| **Ubuntu** | 22.04 LTS (Jammy Jellyfish) | ✅ Tested |
| Linux (generic) | Kernel 6.x+ | ✅ GPU fallback via sysfs |

### GPU Configurations

rocCLAW supports AMD GPU monitoring with ROCm-first detection and a sysfs fallback for systems without ROCm installed.

| APU / GPU | Architecture | Detection | Notes |
|-----------|-------------|-----------|-------|
| **Ryzen AI MAX+ 395** (Strix Halo) | RDNA 3.5 (gfx1151) | ROCm + device ID | 40 CU variant auto-detected as 8060S; 32 CU as 8050S |
| **Ryzen AI 300 series** (Strix Point) | RDNA 3.5 (gfx1150) | ROCm + device ID | 16 CU → 890M, 12 CU → 880M; handles rocm-smi index mismatches |
| **Radeon RX 7900 XTX** | RDNA 3 (gfx1100) | ROCm | Full VRAM, temp, power, and clock metrics |
| **Other AMD GPUs** | Varies | ROCm or sysfs fallback | `lspci` + DRM sysfs on Linux when ROCm is unavailable |

ROCm is checked first (`rocminfo` + `rocm-smi`). If unavailable, rocCLAW falls back to `lspci` + DRM sysfs for basic GPU info — no ROCm install required.

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

---

> **Disclaimer:** rocCLAW is a community project and is not affiliated with, endorsed by, or an official product of AMD.

**Acknowledgments:** Built with help from [Ollama](https://ollama.com) models — [Kimi K2](https://huggingface.co/moonshotai/Kimi-K2), [GLM 5.1](https://huggingface.co/THUDM/GLM-5.1), and [Claude](https://www.anthropic.com/claude).