# Permissions & Sandboxing

How rocCLAW configures agent capabilities and how the gateway enforces them.

## Mental model

rocCLAW is a UI layer. It does two things with permissions:

1. **Writes configuration** to the gateway (per-agent overrides in `openclaw.json`)
2. **Writes policy** to the gateway (per-agent exec approval rules in `exec-approvals.json`)

The **gateway** is the enforcement point. It decides:
- Whether a session runs sandboxed
- What the sandbox can see of the filesystem
- Which tools are available
- Whether a command requires user approval

rocCLAW shows you what's configured and lets you change it. The gateway does the actual work.

---

## Sandbox modes

Controls when sessions run inside a sandbox container.

| Mode | What it means |
|------|--------------|
| **Off** | Sessions run on the host — no sandbox |
| **Non-main** | Sandboxes everything except the agent's main session |
| **All** | Every session is sandboxed |

> [!NOTE]
> "Non-main" vs "All" matters for automation. If an agent has heartbeat or cron jobs, `All` sandboxes those too. `Non-main` keeps the main persistent session on the host and sandboxes everything else.

---

## Workspace access

Controls what the sandbox can see of the agent's workspace directory.

| Setting | Sandbox root | Agent workspace mounted at | PI file tools |
|---------|-------------|--------------------------|---------------|
| **Read-write** | Agent workspace | — | `read`, `write`, `edit`, `apply_patch` all work normally |
| **Read-only** | Separate sandbox workspace | `/agent` (read-only, for CLI inspection) | **`write`, `edit`, `apply_patch` are disabled** |
| **None** | Separate sandbox workspace | Not mounted | `read` only (from sandbox workspace) |

> [!WARNING]
> `workspaceAccess = Read-only` is not just a mount flag. It also **disables** `write`, `edit`, and `apply_patch` tools inside sandboxed sessions at the tool-construction level, regardless of what the tools profile allows. If you want the agent to be able to write files in a sandbox, use **Read-write**.

### Where the sandbox workspace lives

The sandbox workspace root defaults to `~/.openclaw/sandboxes/<agentId>/` on the gateway host. It is seeded from the agent workspace on first use (bootstrap files, skills).

---

## Tool policy

Two separate gates control which tools an agent can use in a sandboxed session.

### 1. Per-agent tool overrides

Set in the **Capabilities** tab: `Minimal / Coding / Messaging / Full` profiles, plus per-tool allow/deny lists (`alsoAllow`, `deny`). These control the **host** toolset.

### 2. Sandbox tool policy

An additional layer that gates tools **inside the sandbox container**. Controlled by `tools.sandbox.tools.allow` and `tools.sandbox.tools.deny`.

These are **independent layers**. An agent can have `group:runtime` enabled in Capabilities and still be blocked inside a sandbox if sandbox tool policy denies it.

> [!TIP]
> If you set `tools.sandbox.tools.allow = []` (empty array), the gateway auto-adds `image` to the allowlist. This often results in "only image generation works in sandbox." Use `["*"]` for "allow everything in sandbox."

---

## Exec approvals

Controls whether specific shell commands require user confirmation before running.

**How it works in rocCLAW:**

1. The agent tries to run a command
2. The gateway checks the approval policy for the agent
3. If the command matches a deny pattern → blocked
4. If it matches an allow pattern → runs
5. If it matches neither → the gateway pauses the run and broadcasts an `exec.approval.requested` event
6. rocCLAW shows an in-chat approval card
7. You click **Allow once**, **Allow always**, or **Deny**
8. The gateway resumes or blocks accordingly

Approvals are **enforced by the gateway**, not by rocCLAW. If rocCLAW is offline and an agent runs, the approval policy still applies.

### Approval options

| Action | Effect |
|--------|--------|
| **Allow once** | Approves this exact command for this run only |
| **Allow always** | Adds the command pattern to the agent's permanent allowlist |
| **Deny** | Blocks this command this time |

---

## Session-level exec settings

Separately from per-agent config and exec approvals, each session has its own exec settings:

| Setting | Options | What it controls |
|---------|---------|-----------------|
| **execHost** | `sandbox` / `gateway` / `node` | Where commands run |
| **execSecurity** | `deny` / `allowlist` / `full` | Default security level |
| **execAsk** | `off` / `on-miss` / `always` | When to prompt for approval |

When `sandbox.mode = All` and there are exec overrides, rocCLAW forces `execHost = sandbox` to prevent accidentally running on the host.

---

## Debugging: when something feels wrong

### Agent can't read/write files
1. Check `sandbox.mode` — if `All`, the agent is in a sandbox
2. Check `sandbox.workspaceAccess` — if `Read-only`, `write`/`edit`/`apply_patch` are disabled
3. Check `tools.profile` and `tools.alsoAllow` / `tools.deny` in Capabilities

### Commands don't need approval
1. Check `execAsk` in session settings — if `off`, approvals are suppressed
2. Check the agent's allowlist patterns — a wildcard match may be auto-approving

### Agent sees different files than expected
- `workspaceAccess = Read-write` → tools operate on the **agent workspace**
- `workspaceAccess = Read-only` → tools operate on the **sandbox workspace**; the agent workspace is at `/agent` for CLI inspection only
- `workspaceAccess = None` → tools operate on the **sandbox workspace**; agent workspace is not accessible

### Sandbox not applying
1. Check `sandbox.mode` — `Off` means no sandboxing regardless of other settings
2. Check `execHost` — if set to `gateway` or `node`, commands run on the host
3. If using `Non-main` — confirm you're not on the main session key
