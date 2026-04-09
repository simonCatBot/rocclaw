# Permissions & Sandboxing

How rocCLAW configures security and how the OpenClaw gateway enforces it.

rocCLAW is a UI layer. It writes configuration to the gateway, but the **gateway is the enforcement point**. Approvals and sandboxing work even if rocCLAW is offline.

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

**Layer 1 — Per-agent tool overrides** (set in Capabilities tab): Controls the host toolset. Profiles: Minimal, Coding, Messaging, Full. Plus `alsoAllow` and `deny` lists for fine-grained control.

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
| Allow always | Adds command pattern to agent's permanent allowlist |
| Deny | Blocks this command this time |

Approvals are enforced by the gateway. If rocCLAW is offline and an agent runs, the approval policy still applies. The gateway pauses the run until you decide.

## Session-Level Exec Settings

Each session can override the default exec behavior:

| Setting | Options | What It Controls |
|---------|---------|------------------|
| execHost | `sandbox` / `gateway` / `node` | Where commands physically execute |
| execSecurity | `deny` / `allowlist` / `full` | Default security level |
| execAsk | `off` / `on-miss` / `always` | When to prompt for approval |

When `sandbox.mode = All` and there are exec overrides, rocCLAW forces `execHost = sandbox` to prevent accidentally running commands on the host.

## Troubleshooting

**Agent can't read/write files:**
1. Check `sandbox.mode` — if All, agent is in a sandbox
2. Check `sandbox.workspaceAccess` — Read-only disables write/edit/apply_patch
3. Check `tools.profile` and `tools.deny` lists

**Commands don't need approval:**
1. Check `execAsk` in session settings — `off` suppresses approvals
2. Check agent's allowlist — wildcards may auto-approve

**Sandbox not applying:**
1. Check `sandbox.mode` — Off means no sandboxing
2. Check `execHost` — `gateway` or `node` runs on host, not sandbox
3. If Non-main, confirm you're not on the main session key

**Diagnostic commands:**
```bash
openclaw config get                                    # Current gateway config
cat ~/.openclaw/agents/{agentId}/openclaw.json         # Agent config
cat ~/.openclaw/agents/{agentId}/exec-approvals.json   # Exec approvals
```
