# 🔐 Permissions & Sandboxing Guide

Understanding how rocCLAW configures security and how the OpenClaw gateway enforces it.

---

## 🎯 Overview

**rocCLAW is a UI layer.** It writes configuration to the gateway, but the gateway is the **enforcement point**. This means:

- ✅ rocCLAW shows you what's configured
- ✅ rocCLAW lets you change settings
- 🔒 The **gateway actually enforces** the rules

**Two main configuration files:**
1. `openclaw.json` — Per-agent capabilities and settings
2. `exec-approvals.json` — Per-agent command approval rules

---

## 📚 Table of Contents

1. [Sandbox Modes](#sandbox-modes) — Container isolation
2. [Workspace Access](#workspace-access) — Filesystem visibility
3. [Tool Policy](#tool-policy) — What tools are allowed
4. [Exec Approvals](#exec-approvals) — Command confirmation
5. [Session-Level Settings](#session-level-exec-settings) — Runtime overrides
6. [Troubleshooting](#debugging-when-something-feels-wrong)

---

## Sandbox Modes

Controls when sessions run inside a sandbox container.

<table>
<tr>
<th>Mode</th>
<th>Behavior</th>
<th>Best For</th>
</tr>
<tr>
<td><code>Off</code></td>
<td>Sessions run directly on the host — no container isolation</td>
<td>Trusted agents, maximum performance, full filesystem access</td>
</tr>
<tr>
<td><code>Non-main</code></td>
<td>Sandboxes everything <b>except</b> the agent's main persistent session</td>
<td>Balance — main session has full access, cron/heartbeats are sandboxed</td>
</tr>
<tr>
<td><code>All</code></td>
<td>Every session runs in a sandbox container</td>
<td>Maximum security, automation isolation</td>
</tr>
</table>

### 💡 When to Use Each Mode

```
┌─────────────────────────────────────────────────────────────────────┐
│  Scenario                          │ Recommended Mode               │
├─────────────────────────────────────────────────────────────────────┤
│  Personal assistant               │ Off or Non-main               │
│  Automated cron jobs                │ Non-main or All               │
│  Running untrusted code             │ All                           │
│  Production automation              │ All                           │
│  Development/coding tasks           │ Off or Non-main               │
└─────────────────────────────────────────────────────────────────────┘
```

### ⚠️ Important: "Non-main" vs "All"

The difference matters for automation:

- **Non-main:** Your main chat session runs on the host (fast, full access), but scheduled cron jobs and heartbeats run sandboxed
- **All:** Everything is sandboxed, including your main chat session

---

## Workspace Access

Controls what the sandbox can see of the agent's workspace.

<table>
<tr>
<th>Setting</th>
<th>Sandbox Root</th>
<th>Agent Workspace</th>
<th>File Tools Available</th>
</tr>
<tr>
<td><b>Read-write</b></td>
<td>Agent workspace itself</td>
<td>Direct access (same as root)</td>
<td>✅ <code>read</code>, <code>write</code>, <code>edit</code>, <code>apply_patch</code></td>
</tr>
<tr>
<td><b>Read-only</b></td>
<td>Separate sandbox workspace</td>
<td>Mounted at <code>/agent</code> (read-only)</td>
<td>⚠️ <code>read</code> only — <b>write/edit/apply_patch are DISABLED</b></td>
</tr>
<tr>
<td><b>None</b></td>
<td>Separate sandbox workspace</td>
<td>Not mounted</td>
<td>✅ <code>read</code> from sandbox workspace only</td>
</tr>
</table>

### ⚠️ Critical Warning: Read-only Mode

`workspaceAccess = Read-only` does **more** than just mount the workspace read-only:

> **It also DISABLES `write`, `edit`, and `apply_patch` tools** at the tool-construction level, regardless of what the tools profile allows.

If you want the agent to be able to write files in a sandbox, you **must** use **Read-write**.

### 📁 Where Sandboxes Live

Default location on the gateway host:

```
~/.openclaw/sandboxes/
└── {agentId}/
    ├── workspace/        # Sandbox workspace (isolated)
    ├── skills/          # Copied from agent workspace
    └── bootstrap/       # Bootstrap files
```

The sandbox workspace is seeded from the agent workspace on first use.

---

## Tool Policy

Two independent layers control which tools an agent can use:

### Layer 1: Per-Agent Tool Overrides

Set in **Capabilities** tab:

| Profile | Tools Included |
|---------|---------------|
| **Minimal** | Core essentials only |
| **Coding** | Development tools |
| **Messaging** | Communication tools |
| **Full** | All available tools |

Plus `alsoAllow` and `deny` lists for fine-grained control.

**Controls:** The **host** toolset (what tools are available on the gateway).

### Layer 2: Sandbox Tool Policy

Additional layer that gates tools **inside the sandbox container**:

```json
{
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["read", "write"],
        "deny": ["exec"]
      }
    }
  }
}
```

**Controls:** What tools are available **inside the container**.

### 🔗 How Layers Interact

```
┌──────────────────────────────────────────┐
│  User Request: "Read a file"             │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  Layer 1: Per-Agent Tools                │
│  Profile: Full, no denials               │
│  ✅ Allowed on host                      │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  Layer 2: Sandbox Tool Policy            │
│  allow: ["read", "write"]                │
│  ✅ Allowed in sandbox                   │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  ✅ Tool executes successfully           │
└──────────────────────────────────────────┘
```

### 💡 Tip: Allow Everything in Sandbox

To allow all tools inside the sandbox:

```json
{
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["*"]
      }
    }
  }
}
```

**Don't use an empty array `[]`** — the gateway auto-adds `image` to empty allowlists, which can lead to unexpected behavior.

---

## Exec Approvals

Controls whether shell commands require user confirmation.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Agent tries to run a command                        │
│         > rm -rf /important/data                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Gateway checks policy                               │
│                                                              │
│  • Matches deny pattern?     → ❌ BLOCKED                     │
│  • Matches allow pattern?    → ✅ RUNS                      │
│  • Matches neither?          → ⏸️ PAUSE & NOTIFY           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: rocCLAW shows approval card                         │
│                                                              │
│  ⚠️ Command requires approval                               │
│  > rm -rf /important/data                                  │
│                                                              │
│  [Allow once] [Allow always] [Deny]                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: You decide                                           │
│                                                              │
│  • Allow once  → ✅ Runs this time only                     │
│  • Allow always→ ✅ Runs + added to allowlist               │
│  • Deny       → ❌ Blocked this time                        │
└─────────────────────────────────────────────────────────────┘
```

### Approval Options Explained

| Option | Effect | Use When |
|--------|--------|----------|
| **Allow once** | Approves this exact command for this run only | One-time, unusual operation |
| **Allow always** | Adds command pattern to agent's permanent allowlist | Common, safe operation |
| **Deny** | Blocks this command this time | Potentially dangerous |

### 🔒 Important Security Notes

- Approvals are **enforced by the gateway**, not rocCLAW
- If rocCLAW is offline and an agent runs, approval policy **still applies**
- The gateway pauses the run until you decide (if you dismiss the card)

---

## Session-Level Exec Settings

Each session can override the default exec behavior:

| Setting | Options | What It Controls |
|---------|---------|------------------|
| **execHost** | `sandbox` / `gateway` / `node` | Where commands physically execute |
| **execSecurity** | `deny` / `allowlist` / `full` | Default security level for commands |
| **execAsk** | `off` / `on-miss` / `always` | When to prompt for approval |

### Option Details

**execHost:**
- `sandbox` — Run in container
- `gateway` — Run on gateway host
- `node` — Run on a remote node

**execSecurity:**
- `deny` — Block by default
- `allowlist` — Only allow listed commands
- `full` — Allow all (dangerous!)

**execAsk:**
- `off` — Never ask (respects allow/deny patterns)
- `on-miss` — Ask when command matches neither allow nor deny
- `always` — Ask for every command

### ⚠️ Automatic Sandbox Override

When `sandbox.mode = All` and there are exec overrides, rocCLAW **forces** `execHost = sandbox` to prevent accidentally running commands on the host.

---

## Debugging: When Something Feels Wrong

### 🐛 Agent Can't Read/Write Files

**Checklist:**

1. [ ] Check `sandbox.mode` — if `All`, agent is in a sandbox
2. [ ] Check `sandbox.workspaceAccess`:
   - `Read-only` → write/edit/apply_patch are **DISABLED**
   - `None` → agent workspace not accessible
   - `Read-write` → Full access
3. [ ] Check `tools.profile` — make sure file tools are allowed
4. [ ] Check `tools.alsoAllow` / `tools.deny` lists

### 🐛 Commands Don't Need Approval

**Checklist:**

1. [ ] Check `execAsk` in session settings
   - `off` → Approvals suppressed
   - `on-miss` → Only asks for unknown commands
   - `always` → Asks for every command
2. [ ] Check agent's allowlist patterns
   - Wildcard like `*` or `rm *` may auto-approve

### 🐛 Agent Sees Different Files Than Expected

| Workspace Access | What Agent Sees |
|------------------|-----------------|
| **Read-write** | Direct access to agent workspace |
| **Read-only** | Sandbox workspace; agent workspace at `/agent` (read-only) |
| **None** | Only sandbox workspace |

### 🐛 Sandbox Not Applying

**Checklist:**

1. [ ] Check `sandbox.mode` — `Off` means no sandboxing
2. [ ] Check `execHost` — `gateway` or `node` runs on host, not sandbox
3. [ ] If using `Non-main` — confirm you're not on the main session key

### 🔍 Quick Diagnostic Commands

```bash
# Check current gateway config
openclaw config get

# Check specific agent config
cat ~/.openclaw/agents/{agentId}/openclaw.json

# Check exec approvals
cat ~/.openclaw/agents/{agentId}/exec-approvals.json

# List running sandboxes
ls ~/.openclaw/sandboxes/{agentId}/
```

---

## 📋 Summary Table

| Concept | Controls | Enforced By |
|---------|----------|-------------|
| **Sandbox Mode** | When to use containers | Gateway |
| **Workspace Access** | Filesystem visibility | Gateway + Tool Layer |
| **Tool Policy** | Available tools | Gateway (2 layers) |
| **Exec Approvals** | Command confirmation | Gateway |
| **Session Settings** | Runtime overrides | Gateway |

---

<div align="center">

**Questions?** Check the [UI Guide](ui-guide.md) or [README](../README.md)

</div>
