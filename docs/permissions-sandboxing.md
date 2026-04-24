# Permissions & Sandboxing

How rocCLAW configures security and how the OpenClaw gateway enforces it.

rocCLAW is a UI layer. It writes configuration to the gateway, but the **gateway is the enforcement point**. Approvals and sandboxing work even if rocCLAW is offline.

## Execution Roles

rocCLAW provides three high-level execution roles that map to specific security settings:

| Role | Security | Ask Mode | Allowlist | Behavior |
|------|----------|----------|-----------|----------|
| **Conservative** | _(agent entry removed)_ | _(system default)_ | _(none)_ | Most restrictive — removes the agent's entry from the exec approvals file entirely, reverting to system defaults (deny). |
| **Collaborative** | `allowlist` | `always` | Preserved | Commands checked against the allowlist; user is **always** prompted for approval regardless of match. |
| **Autonomous** | `full` | `off` | Preserved | Full execution authority; user is **never** prompted. Commands run without operator confirmation. |

These are configured via the "Run Commands" segmented control (Off / Ask / Auto) in the agent capabilities panel.

## Sandbox Modes

Controls when sessions run inside a sandbox container.

| Mode | Behavior | Best For |
|------|----------|----------|
| Off | Sessions run directly on the host | Trusted agents, full filesystem access |
| Non-main | Sandboxes everything except the agent's main session | Balance — main session has full access, cron/heartbeats are sandboxed |
| All | Every session runs in a sandbox container | Maximum security, automation isolation |

**Non-main vs All:** With Non-main, your main chat session runs on the host (fast, full access), but scheduled cron jobs and heartbeats run sandboxed. With All, everything is sandboxed including your main chat session.

## Workspace Access

Controls what the sandbox can see of the agent's workspace.

| Setting | Sandbox Root | File Tools |
|---------|-------------|------------|
| Read-write | Agent workspace itself | `read`, `write`, `edit`, `apply_patch` |
| Read-only | Separate sandbox workspace; agent workspace mounted at `/agent` (read-only) | `read` only — write/edit/apply_patch are disabled |
| None | Separate sandbox workspace; agent workspace not mounted | `read` from sandbox workspace only |

**Important:** Read-only mode disables `write`, `edit`, and `apply_patch` tools at the tool-construction level, regardless of what the tools profile allows. If you want the agent to write files in a sandbox, use Read-write.

Sandboxes live at `~/.openclaw/sandboxes/{agentId}/` on the gateway host.

## Tool Policy

Two independent layers control which tools an agent can use.

**Layer 1 — Per-agent tool overrides** (set in Capabilities tab): Controls the host toolset.

| Profile | Description |
|---------|-------------|
| Minimal | Basic tools only |
| Coding | Standard development tools |
| Messaging | Communication-focused tools |
| Full | All available tools |

Plus `alsoAllow` and `deny` lists for fine-grained control.

**Layer 2 — Sandbox tool policy**: Additional gate for tools inside the sandbox container. Configured as `allow`/`deny` lists in the sandbox config.

Both layers must allow a tool for it to execute. Use `"allow": ["*"]` (not an empty array) to allow all tools in the sandbox.

## Exec Approvals

Controls whether shell commands require user confirmation.

When an agent tries to run a command:
1. Matches a deny pattern → blocked
2. Matches an allow pattern → runs
3. Matches neither → paused, approval card shown in rocCLAW

Approval options:
| Option | Effect |
|--------|--------|
| Allow once | Approves this command for this run only |
| Allow always | Adds command pattern to agent's permanent allowlist (normalized, deduplicated) |
| Deny | Blocks this command this time |

Approvals are enforced by the gateway. If rocCLAW is offline and an agent runs, the approval policy still applies. The gateway pauses the run until you decide.

### Approval Flow in rocCLAW

The exec approval system is fully wired end-to-end:

1. **Gateway event** — `exec.approval.requested` arrives via SSE with command details, working directory, host, and expiry time.
2. **Lifecycle workflow** — Pure planning function determines scoped/unscoped upserts, removals, and activity markers.
3. **Pending store** — Two-tier state: `approvalsByAgentId` (scoped) and `unscopedApprovals` (not yet matched to an agent).
4. **UI rendering** — Approval cards appear inline in the chat transcript showing the command, host, cwd, and three action buttons.
5. **Pause policy** — If the agent is running and ask mode is "always", the run is paused via `chatAbort()`.
6. **Resolution** — Decision sent to gateway via `exec.approval.resolve` intent. On allow, waits up to 15 seconds for the run to complete, then refreshes history.
7. **Auto-resume** — After resolution, the paused run is automatically resumed with a follow-up message.

### Approval Badges

- Agents with pending approvals show "Needs Approval" badges in the fleet sidebar.
- The `awaitingUserInput` flag is derived from the pending approval count.
- The fleet sidebar filter includes an "approvals" mode to show only agents needing attention.

## Session-Level Exec Settings

Each session can override the default exec behavior:

| Setting | Options | What It Controls |
|---------|---------|------------------|
| execHost | `sandbox` / `gateway` / `node` | Where commands physically execute |
| execSecurity | `deny` / `allowlist` / `full` | Default security level |
| execAsk | `off` / `on-miss` / `always` | When to prompt for approval |

When `sandbox.mode = All` and there are exec overrides, rocCLAW forces `execHost = sandbox` to prevent accidentally running commands on the host.

## Exec Approvals File Format

The exec approvals file (`~/.openclaw/agents/{agentId}/exec-approvals.json`) uses v1 format:

```json
{
  "version": 1,
  "socket": { "path": "...", "token": "..." },
  "defaults": {
    "security": "allowlist",
    "ask": "on-miss",
    "autoAllowSkills": true
  },
  "agents": {
    "<agentId>": {
      "security": "allowlist",
      "ask": "always",
      "allowlist": [
        { "pattern": "npm test" },
        { "pattern": "git status" }
      ]
    }
  }
}
```

rocCLAW uses optimistic concurrency (base hash check + retry on conflict) when updating this file.

## Troubleshooting

**Agent can't read/write files:**
1. Check `sandbox.mode` — if All, agent is in a sandbox
2. Check `sandbox.workspaceAccess` — Read-only disables write/edit/apply_patch
3. Check `tools.profile` and `tools.deny` lists

**Commands don't need approval:**
1. Check `execAsk` in session settings — `off` suppresses approvals
2. Check agent's allowlist — wildcards may auto-approve
3. Check the execution role — "Autonomous" (Auto) sets `ask: "off"`

**Sandbox not applying:**
1. Check `sandbox.mode` — Off means no sandboxing
2. Check `execHost` — `gateway` or `node` runs on host, not sandbox
3. If Non-main, confirm you're not on the main session key

**Approvals not showing in rocCLAW:**
1. Check SSE connection — approvals arrive via the event stream
2. Check if the approval has expired (`expiresAtMs`)
3. Check the agent is in the fleet — unscoped approvals may not be matched

**Diagnostic commands:**
```bash
openclaw config get                                    # Current gateway config
cat ~/.openclaw/agents/{agentId}/openclaw.json         # Agent config
cat ~/.openclaw/agents/{agentId}/exec-approvals.json   # Exec approvals
```
