# 🖥️ rocCLAW UI Guide

> ⚠️ **Alpha Preview** — This guide reflects v0.9.0-alpha. UI elements and behavior may change between releases.

Complete walkthrough of the rocCLAW interface — what every button does and how to use it effectively.

---

## 📋 Table of Contents

1. [Connection Screen](#connection-screen) — Getting connected
2. [Agents Tab](#agents-tab) — Managing your agents
3. [Chat Panel](#chat-panel) — The main workspace
4. [Settings Sidebar](#settings-sidebar) — Configuring agents
5. [System Metrics Tab](#system-metrics-tab) — Live monitoring
6. [Tokens Tab](#tokens-tab) — Usage tracking
7. [Troubleshooting](#troubleshooting)

---

## Connection Screen

When you first open rocCLAW (or if you get disconnected), you'll see the connection panel.

### 🔌 Connection Fields

| Field | What to enter | Example |
|-------|---------------|---------|
| **Gateway URL** | WebSocket address of your OpenClaw gateway | `ws://127.0.0.1:18789` |
| **Token** | Your gateway authentication token | `eyJhbGciOiJ...` |

### Available Actions

<details>
<summary><b>Test Connection</b></summary>

Validates that the gateway is reachable **without** saving settings. Useful for:
- Verifying URL/token are correct
- Troubleshooting connection issues
- Testing before committing changes

Expected result: ✅ "Connection test succeeded"

</details>

<details>
<summary><b>Save Settings</b></summary>

Persists the URL and token server-side. The token is **never** visible in the browser after saving — rocCLAW stores it securely on the server.

**Important:** This is the only way to actually connect. Testing alone doesn't save!

</details>

<details>
<summary><b>Disconnect</b></summary>

Tears down the live connection. Use this to:
- Switch to a different gateway
- Reset connection state
- Troubleshoot issues

</details>

### 💡 Pro Tip: Draft-Based Editing

The URL and token fields work like drafts. You can:
1. Edit the values
2. Click **Test Connection** to verify
3. Discard and try again if it fails
4. Only click **Save Settings** when you're confident

---

## Agents Tab

Your command center for managing AI agents.

### Status Indicators

| Symbol | Meaning | What it means |
|--------|---------|---------------|
| **●** | Running | Agent has an active session and is ready |
| **○** | Idle | Agent has no active session (send a message to start one) |

### 🎛️ Controls

<details>
<summary><b>Filter</b> — All / Running / Idle</summary>

Filter the agent list to focus on:
- **All** — Every agent in your gateway
- **Running** — Only agents with active sessions
- **Idle** — Only agents without active sessions

</details>

<details>
<summary><b>New Agent</b></summary>

Opens a modal to create a new agent. You'll only need to provide:
1. **Name** — Display name for the agent
2. **Avatar** — Visual identity (auto-generated, can shuffle)

After creation, rocCLAW automatically applies permissive defaults:
- Commands: Auto (run without asking)
- Web access: On
- File tools: On

Then opens the **Capabilities** sidebar so you can fine-tune settings.

</details>

### 🖱️ Interaction

**Click an agent** in the sidebar to open chat with that agent.

---

## Chat Panel

The primary workspace when you have an agent selected.

### Header Controls

<table>
<tr>
<th>Control</th>
<th>Icon</th>
<th>What it does</th>
</tr>
<tr>
<td><b>Brain</b></td>
<td>⫶</td>
<td>Opens the <b>Personality</b> sidebar to edit agent's SOUL.md, AGENTS.md, USER.md, IDENTITY.md</td>
</tr>
<tr>
<td><b>Settings</b></td>
<td>✎</td>
<td>Opens the full <b>agent settings</b> sidebar (Capabilities, Automations, Advanced)</td>
</tr>
<tr>
<td><b>New Session</b></td>
<td>🔄</td>
<td><b>Resets conversation context</b>. Agent forgets previous messages but keeps its personality.</td>
</tr>
<tr>
<td><b>Model</b></td>
<td>🤖</td>
<td>Override the default model for this session only (e.g., switch to GPT-4 for complex tasks)</td>
</tr>
<tr>
<td><b>Thinking</b></td>
<td>🧠</td>
<td>Set reasoning level: <code>off</code> / <code>low</code> / <code>medium</code> / <code>high</code>. Higher = more visible reasoning steps.</td>
</tr>
<tr>
<td><b>Tool Calls</b></td>
<td>🔧</td>
<td>Toggle visibility of <b>tool execution</b> in the transcript (shows when agent uses web search, file tools, etc.)</td>
</tr>
<tr>
<td><b>Thinking Traces</b></td>
<td>💭</td>
<td>Toggle visibility of the <b>model's internal reasoning</b> (chain-of-thought steps)</td>
</tr>
<tr>
<td><b>Stop Run</b></td>
<td>⏹️</td>
<td><b>Emergency stop</b> — Halts the current agent run immediately</td>
</tr>
</table>

### 💬 Sending Messages

1. **Type** in the compose box at the bottom
2. **Press Enter** (or click Send) to submit
3. **Watch** the agent respond in real-time via streaming

### Understanding the Flow

```
┌─────────────────────────────────────────────────────────────┐
│  You: "Analyze this code for bugs"                          │
│                                                             │
│  🤖 Agent is thinking...                                      │
│  💭 Internal reasoning appears here (if Thinking enabled)  │
│                                                             │
│  🔧 Using tool: read_file("/path/to/code.js")              │
│                                                             │
│  🤖 Response: "I found 3 potential issues..."               │
└─────────────────────────────────────────────────────────────┘
```

### New Session vs. Stop Run

| Action | What it does | When to use |
|--------|--------------|-------------|
| **New Session** | Resets conversation context. Agent forgets everything from this session. | Starting a completely new task |
| **Stop Run** | Halts the current response generation. Keeps session and transcript intact. | Agent is stuck in a loop or taking too long |

### 🚨 Exec Approval Cards

When an agent tries to run a command that needs your approval:

```
┌────────────────────────────────────────────────────────┐
│  ⚠️ Command requires approval                           │
│                                                         │
│  The agent wants to run:                                │
│  > rm -rf /path/to/directory                            │
│                                                         │
│  [ Allow once ]  [ Allow always ]  [ Deny ]          │
└────────────────────────────────────────────────────────┘
```

- **Allow once** — Approve just this command, this time only
- **Allow always** — Add this command pattern to permanent allowlist
- **Deny** — Block this attempt (agent will skip it)

**Important:** If you dismiss the card without choosing, the run pauses until you decide.

---

## Settings Sidebar

Accessed via the ✎ (settings) button in the chat header. Four configuration tabs:

### 📄 Personality

Edit the agent's core identity files:

| File | Purpose | Example Content |
|------|---------|-----------------|
| **SOUL.md** | Agent's core identity and principles | "I am a helpful coding assistant..." |
| **AGENTS.md** | Operating rules and workflows | "Always ask before running commands..." |
| **USER.md** | Context about the human | "My name is Alex, I prefer TypeScript..." |
| **IDENTITY.md** | Agent metadata | Name, emoji, avatar settings |

**Also includes:**
- **Rename agent** — Change the display name

### 🔧 Capabilities

Control what the agent is allowed to do:

| Control | Options | Effect |
|---------|---------|--------|
| **Run commands** | `Off` / `Ask` / `Auto` | Whether exec commands need approval |
| | `Off` = Blocked | Agent cannot run commands |
| | `Ask` = Require approval | You'll see approval cards |
| | `Auto` = Run silently | Commands execute automatically |
| **Web access** | `Off` / `On` | Can use web search/tools |
| **File tools** | `Off` / `On` | Can read/write files |

### ⏰ Automations

Schedule recurring tasks with cron jobs:

**Creating a cron job:**
1. **Pick a template** — "Daily Standup", "Weekly Report", etc.
2. **Define the task** — What should the agent do?
3. **Set the schedule** — Cron expression (e.g., `0 9 * * 1-5` for 9 AM weekdays)
4. **Review and save** — Confirm the details

**Managing cron jobs:**
- **Run now** — Execute immediately (for testing)
- **Delete** — Remove the schedule
- Schedules survive gateway restarts

### ⚙️ Advanced

| Setting | What it does |
|---------|--------------|
| **Show tool calls** | Display tool execution lines in transcript |
| **Show thinking** | Display model's internal reasoning |
| **Open Full Control UI** | Opens gateway's native interface in new tab |
| **Delete agent** | ⚠️ **Destructive** — Removes agent from gateway (requires confirmation) |

**Note:** Model and Thinking level are session-level controls in the chat header, not here.

---

## System Metrics Tab

Live monitoring dashboard showing:

| Metric | What it shows | Why it matters |
|--------|---------------|----------------|
| **CPU** | Per-core and average usage | Detect if system is overloaded |
| **Memory** | RAM utilization | Prevent out-of-memory crashes |
| **GPU** | Graphics card load | Monitor AI inference load |
| **Disk** | Storage usage | Avoid running out of space |
| **Network** | I/O statistics | Track data transfer |

**Data source:** The machine running rocCLAW (via `systeminformation` package). If rocCLAW and OpenClaw gateway are on different machines, these show rocCLAW's host, not the gateway host.

---

## Tokens Tab

Track per-agent token consumption:

| Column | Meaning |
|--------|---------|
| **Agent** | Which agent used the tokens |
| **Session** | Session identifier |
| **Input** | Tokens sent to the model |
| **Output** | Tokens received from the model |
| **Total** | Combined count |

Use this to:
- Monitor usage patterns
- Identify expensive operations
- Estimate costs

---

## Troubleshooting

### 🔴 Gateway Connection Lost

**What happens:** Banner appears, rocCLAW attempts reconnection automatically.

**What to do:**
- Wait — reconnection uses exponential back-off (1s → 15s max)
- Once reconnected, events replay from where it left off
- If it keeps failing, check gateway status: `openclaw status`

### ⚫ Agent Shows as Offline (○)

**What it means:** The agent has no active session.

**What to do:**
1. Send the agent a message — this starts a new session
2. If it doesn't respond, check that the gateway is running
3. Verify your connection is live (check the status indicator)

### ⏸️ Pending Exec Approval Card

**What it means:** The agent tried to run a command that matches neither allow nor deny patterns.

**What to do:**
- Choose **Allow once**, **Allow always**, or **Deny**
- If you dismiss without choosing, the run pauses
- The gateway enforces this — it works even if rocCLAW disconnects

### 🔄 Changes Not Taking Effect

**Common causes:**
1. **Gateway under load** — Config writes may queue. Wait a moment.
2. **Session state stale** — Try "New session" to refresh
3. **Gateway restart needed** — Some changes require a restart to fully apply

**Quick fix:**
```bash
openclaw gateway restart
```

---

## 🎯 Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |

### Status Icons

| Icon | Meaning |
|------|---------|
| ● | Agent running/active |
| ○ | Agent idle/offline |
| 🔄 | New session |
| ⏹️ | Stop current run |

### File Locations

| File | Location |
|------|----------|
| Agent personalities | `~/.openclaw/agents/{agentId}/` |
| Gateway config | `~/.openclaw/openclaw.json` |
| rocCLAW settings | `~/.openclaw/openclaw-rocclaw/settings.json` |
| rocCLAW database | `~/.openclaw/openclaw-rocclaw/runtime.db` |

---

<div align="center">

**Need more help?** Check the [main README](../README.md) or [Architecture docs](../ARCHITECTURE.md)

</div>
