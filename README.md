<div align="center">

# ⚠️ rocCLAW — Alpha Preview

> **This is early, unstable software (v0.9.0-alpha).** Expect rough edges, breaking changes, and incomplete features. Do not use in production environments. Feedback welcome!

**Your focused operator studio for OpenClaw AI agents**

<p align="center">
  <a href="https://discord.gg/EFkFHbZw"><img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://github.com/simoncatbot/rocclaw/releases"><img src="https://img.shields.io/github/v/release/simoncatbot/rocclaw?include_prereleases&logo=github&color=red" alt="GitHub Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/version-0.9.0--alpha-red" alt="Version">
</p>

</div>

## ✨ What is rocCLAW?

rocCLAW is a sleek, modern dashboard that puts you in control of your OpenClaw AI agents. Instead of juggling command lines and config files, you get an intuitive web interface to:

- 🤖 **Manage agents** — Create, configure, and organize your AI assistants
- 💬 **Chat in real-time** — Interactive conversations with streaming responses
- 📊 **Monitor systems** — Live CPU, memory, GPU, disk, and network metrics
- ⏰ **Schedule tasks** — Cron jobs that run your agents on autopilot
- 🔒 **Control execution** — Approve or deny commands inline

---

## 🚀 Quick Start

> **Prerequisites:** Node.js 20.9+ and OpenClaw running on your gateway

### Step 1: Install

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install
```

### Step 2: Configure

**For same-machine setup** (OpenClaw + rocCLAW on one computer):

```bash
# Allow gateway to accept connections
openclaw config set gateway.bind lan
openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
openclaw gateway restart

# Get your token
openclaw config get gateway.auth.token
# → copy this token for the next step
```

**Create environment file:**

```bash
cat > .env << 'EOF'
# Point to your OpenClaw state directory
OPENCLAW_STATE_DIR=/home/$USER/.openclaw

# Gateway URL (MUST use localhost/127.0.0.1)
NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:18789
EOF
```

### Step 3: Launch

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and paste your gateway token. Click **Test Connection**, then **Save Settings**.

🎉 You're in!

---

## 📦 Installation Options

### Option 1: Pre-built Package (Fastest)

Download ready-to-run packages from [GitHub Releases](https://github.com/simoncatbot/rocclaw/releases):

**Linux/macOS:**
```bash
# Download and extract the latest release
curl -L -o rocclaw.tar.gz https://github.com/simoncatbot/rocclaw/releases/latest/download/rocclaw-linux-x64.tar.gz
tar -xzf rocclaw.tar.gz
cd rocclaw

# Start the application
./start.sh
```

**Windows:**
1. Download `rocclaw-windows-x64.zip` from [GitHub Releases](https://github.com/simoncatbot/rocclaw/releases/latest)
2. Extract the zip file
3. Run `start.bat`

### Option 2: npm (Global Install)

```bash
npm install -g @simoncatbot/rocclaw
rocclaw
```

### Option 3: From Source

```bash
git clone https://github.com/simoncatbot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

---

## 📖 Documentation

| Guide | What you'll learn |
|-------|-------------------|
| [📚 Setup & Configuration](README.md#setup-guides) | Detailed installation for different scenarios |
| [🖥️ UI Guide](docs/ui-guide.md) | How to use each feature in the interface |
| [🔐 Permissions & Sandboxing](docs/permissions-sandboxing.md) | Security settings explained |
| [🏗️ Architecture](ARCHITECTURE.md) | Technical deep-dive for developers |
| [🤝 Contributing](CONTRIBUTING.md) | Development setup and contribution guide |

---

## 🏗️ Architecture Overview

```
┌──────────────┐      HTTP/SSE       ┌──────────────┐     WebSocket      ┌──────────────┐
│   Browser    │ ◄──────────────────► │  rocCLAW     │ ◄────────────────► │  OpenClaw    │
│   (React)    │    Events/UI       │   Server     │    Commands        │   Gateway    │
└──────────────┘                     │   (SQLite)   │                     │              │
                                     │  • Outbox    │                     │ • AI Runtime │
                                     │  • Replay    │                     │ • Config     │
                                     └──────────────┘                     └──────────────┘
```

**Key design:** The browser never connects directly to the gateway. rocCLAW acts as a secure proxy, managing authentication, event replay, and rate limiting.

---

## 📋 Setup Guides

<details>
<summary><b>🏠 Same-Machine Setup (Recommended for Beginners)</b></summary>

Running OpenClaw and rocCLAW on the same machine? Follow these steps:

**1. Configure OpenClaw Gateway**

```bash
# Allow connections from LAN (not just localhost)
openclaw config set gateway.bind lan

# Allow control-ui to connect without strict HTTPS checks
openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true

# Restart the gateway
openclaw gateway restart
```

> ⚠️ **Security:** These settings relax security checks. Only use on trusted local networks.

**2. Create rocCLAW Environment File**

```bash
cat > .env << 'EOF'
# Point to your OpenClaw state directory
OPENCLAW_STATE_DIR=/home/$(whoami)/.openclaw

# Gateway URL - MUST use localhost for browser security
NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:18789
EOF
```

**3. Get Your Gateway Token**

```bash
openclaw config get gateway.auth.token
# Example output: eyJhbGciOiJIUzI1NiIs...
```

**4. Start and Connect**

```bash
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000) (must use `localhost`, not IP)
2. Enter URL: `ws://127.0.0.1:18789`
3. Paste the token from step 3
4. Click **Test Connection** → should show ✅ "Connection test succeeded"
5. Click **Save Settings**

</details>

<details>
<summary><b>🌐 Remote Gateway via Tailscale</b></summary>

**On the gateway machine:**

```bash
# Find your Tailscale IP
ip addr show tailscale0 | grep inet
# → 100.x.x.x

openclaw config set gateway.bind 100.x.x.x
openclaw gateway restart
```

**On your local machine:**

```bash
cat > .env << 'EOF'
NEXT_PUBLIC_GATEWAY_URL=wss://my-gateway.ts.net
EOF
```

Use `wss://` (WebSocket Secure) when connecting via Tailscale.

</details>

<details>
<summary><b>🔒 Remote Gateway via SSH Tunnel</b></summary>

Create an SSH tunnel to forward the gateway port:

```bash
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Keep this terminal open, then connect rocCLAW to `ws://localhost:18789`.

</details>

---

## 🎯 Core Features

### 🤖 Agent Management

Create and manage AI agents with personality files:

| File | Purpose | Example Content |
|------|---------|-----------------|
| `SOUL.md` | Agent's core identity | "I am a helpful coding assistant..." |
| `AGENTS.md` | Operating rules | "Always ask before running commands..." |
| `USER.md` | Human context | "My name is Alex, I prefer TypeScript..." |
| `IDENTITY.md` | Agent metadata | Name, emoji, avatar settings |

**Quick tip:** After creating an agent, rocCLAW automatically applies permissive defaults (auto commands, web access, file tools).

### 💬 Real-Time Chat

The chat interface includes powerful controls:

- **New session** — Clear conversation context (agent forgets previous messages)
- **Model** — Override the default model for this session
- **Thinking** — `off` / `low` / `medium` / `high` (how much reasoning to show)
- **Tool calls** — Toggle visibility of tool usage in the transcript
- **Thinking traces** — Show the model's internal reasoning
- **Stop run** — Emergency brake for long-running operations

**Example workflow:**
1. Send a message → Agent starts "thinking"
2. Agent uses tools (visible if "Tool calls" enabled)
3. Response streams in real-time
4. Click "New session" to start fresh

### 📊 System Metrics

Live monitoring of:

- **CPU** — Per-core and average usage
- **Memory** — RAM utilization
- **GPU** — Graphics card load (if available)
- **Disk** — Storage usage
- **Network** — I/O statistics

*Data comes from the machine running rocCLAW (via `systeminformation` package).*

### ⏰ Cron Jobs

Schedule automated agent runs:

```
┌─────────────────────────────────────────────────────────┐
│  Template: "Daily Standup"                               │
│  Task: "Summarize yesterday's commits and today's plan" │
│  Schedule: 0 9 * * 1-5  (9 AM weekdays)                │
└─────────────────────────────────────────────────────────┘
```

- Schedules survive gateway restarts
- Run immediately or on the timer
- Each agent can have multiple cron jobs

### 🔒 Exec Approvals

When an agent tries to run a command that needs approval:

```
┌────────────────────────────────────────────────────────┐
│  ⚠️ Command needs approval                              │
│  > rm -rf /important/data                              │
│                                                        │
│  [ Allow once ]  [ Allow always ]  [ Deny ]          │
└────────────────────────────────────────────────────────┘
```

- **Allow once** — Approve just this time
- **Allow always** — Add to permanent allowlist
- **Deny** — Block this attempt

*Approvals are enforced by the gateway — they work even if rocCLAW is offline.*

---

## ⚙️ Permission Settings

Control what each agent can do:

| Setting | Options | Description |
|---------|---------|-------------|
| **Command Mode** | `Off` / `Ask` / `Auto` | Whether commands need approval |
| **Sandbox Mode** | `Off` / `Non-main` / `All` | Container isolation for sessions |
| **Workspace Access** | `None` / `Read-only` / `Read-write` | Filesystem visibility |
| **Tools Profile** | `Minimal` / `Coding` / `Messaging` / `Full` | Available tool groups |

> ⚠️ **Note:** `Read-only` workspace access **disables** `write`, `edit`, and `apply_patch` tools in sandboxed sessions, even if the tools profile allows them.

---

## 🐛 Troubleshooting

### Connection Issues

<table>
<tr><th>Problem</th><th>Solution</th></tr>
<tr>
<td><code>Control ui requires device identity</code></td>
<td>

```bash
openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
openclaw gateway restart
```

</td>
</tr>
<tr>
<td><code>Connection test succeeded</code> but dashboard won't load</td>
<td>
Ensure `NEXT_PUBLIC_GATEWAY_URL` uses <code>127.0.0.1</code> or <code>localhost</code>, not a LAN IP. Restart rocCLAW after editing <code>.env</code>.

</td>
</tr>
<tr>
<td><code>npm install</code> fails with git error</td>
<td>

```bash
git pull origin main
npm install
```

</td>
</tr>
<tr>
<td>SQLite errors on startup</td>
<td>

```bash
npm run verify:native-runtime:repair
```

</td>
</tr>
</table>

### Runtime Issues

| Symptom | Check |
|---------|-------|
| Agent won't respond | Sidebar shows ○ (offline)? Try "New session" |
| Gateway keeps disconnecting | Check gateway machine memory/GPU pressure |
| 401 errors | Regenerate token: `openclaw config get gateway.auth.token` |
| Agent ignores commands | Check "Command Mode" setting — is it `Off`? |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development environment setup
- Testing procedures
- PR guidelines

---

## 📜 License

[MIT License](LICENSE) © simonCatBot

---

<div align="center">

**[Documentation](docs/) · [Issues](../../issues) · [Discussions](../../discussions)**

</div>
