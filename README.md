# rocCLAW

**Focused operator studio for OpenClaw.** Connect to your gateway, manage agents, run chats, monitor system metrics, configure cron schedules, and handle exec approvals — all from one interface.

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/EFkFHbZw)
[![Node](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

---

## How to connect

### Prerequisites

- **Node.js 20.9+** with `npm`
- **OpenClaw** installed and running on your gateway machine
- **GitHub CLI (`gh`)** authenticated (for auto-fix skill)

### Quick Start

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Same-Machine Setup (OpenClaw + rocCLAW on one host)

If OpenClaw and rocCLAW run on the same machine, you need extra configuration because browsers block WebSocket connections to non-localhost origins.

#### 1. Configure OpenClaw Gateway

Set the gateway to allow LAN connections and disable strict device identity checks:

```bash
# Allow connections from LAN (not just 127.0.0.1)
openclaw config set gateway.bind lan

# Allow control-ui to connect without strict HTTPS/localhost checks
openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true

# Restart the gateway
openclaw gateway restart
```

> ⚠️ **Security note**: These settings relax security checks. Only use them on trusted local networks or single-user machines.

#### 2. Configure rocCLAW Environment

Create a `.env` file in your rocCLAW directory. Replace `YOUR_USERNAME` with your actual username:

```bash
cat > .env << 'EOF'
# rocclaw .env - Local development configuration

# Point to your OpenClaw state directory (update YOUR_USERNAME)
OPENCLAW_STATE_DIR=/home/YOUR_USERNAME/.openclaw

# Gateway URL - MUST use localhost for browser security
NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:18789

# SSH target for gateway operations (optional - for agent workspace cleanup)
# Only needed if rocCLAW and OpenClaw are on different machines
OPENCLAW_GATEWAY_SSH_TARGET=
OPENCLAW_GATEWAY_SSH_USER=
EOF
```

**Example for user "alice":**
```bash
OPENCLAW_STATE_DIR=/home/alice/.openclaw
NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:18789
```

> **Important**: `NEXT_PUBLIC_GATEWAY_URL` must use `127.0.0.1` or `localhost`, not your machine's LAN IP.

#### 3. Get Your Gateway Token

```bash
openclaw config get gateway.auth.token
```

Copy this token — you'll paste it into rocCLAW.

#### 4. Start rocCLAW and Connect

```bash
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000) (**must** use `localhost`, not IP)
2. Enter gateway URL: `ws://127.0.0.1:18789`
3. Paste the token from step 3
4. Click **Test Connection** — should show "Connection test succeeded"
5. Click **Save Settings**

---

### Remote Gateway Setup

| Gateway location | Upstream URL | Prerequisites |
|------------------|-------------|---------------|
| Same machine | `ws://localhost:18789` | See same-machine setup above |
| Tailscale | `wss://<gateway-host>.ts.net` | Tailscale on both ends, HTTPS enabled |
| SSH tunnel | `ws://localhost:18789` | Run `ssh -L 18789:127.0.0.1:18789 user@gateway-host` |
| Cloud with TLS | `wss://<vm-address>` | Valid SSL certificate on gateway |

---

### Troubleshooting Connection Issues

#### "Control ui requires device identity" or "INVALID_REQUEST"

Your OpenClaw gateway is rejecting the connection because the browser's security context doesn't match. Fix:

1. Ensure you're accessing rocCLAW via `http://localhost:3000`, not `http://<ip>:3000`
2. Add these OpenClaw settings:
   ```bash
   openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
   openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
   openclaw gateway restart
   ```

#### "Connection test succeeded" but dashboard won't load

The test uses a different path than the actual WebSocket. Make sure:
- `NEXT_PUBLIC_GATEWAY_URL` uses `127.0.0.1` or `localhost`, not a LAN IP
- You restarted rocCLAW after creating `.env`

#### "Could not connect to saved gateway settings"

Delete the saved settings to reset:
```bash
rm ~/.openclaw/openclaw-studio/settings.json
```

Then reconnect via `http://localhost:3000`.

#### "npm install" fails with git reference error

If you see `The git reference could not be found`, the `@multiavatar/multiavatar` dependency has an invalid commit hash. This was fixed in PR #10 — pull the latest code:
```bash
git pull origin main
npm install
```

---

## How it works

rocCLAW is a **server-side dashboard** — the browser never connects directly to the gateway.

```
Browser  ──HTTP/SSE──►  rocCLAW Server  ──WebSocket──►  OpenClaw Gateway
                        (Next.js + ws)                    (your AI runtime)
                        • owns the gateway connection
                        • writes events to SQLite outbox
                        • redacts the gateway token from the browser
                        • enforces rate limits
```

The server maintains a **SQLite outbox** of all gateway events. When the browser reconnects, it replays from its last-seen event ID so nothing is missed.

---

## Features

### Agents
Create, rename, and delete agents. Each agent has personality files (`SOUL.md`, `AGENTS.md`, `USER.md`, `IDENTITY.md`) that live in its workspace directory on the gateway host.

**Agent creation** captures only a name and avatar. rocCLAW then applies a permissive default: commands set to Auto, web access on, file tools on.

### Chat
Real-time messaging via SSE. Controls in the chat header:

- **New session** — clears the conversation context
- **Model** / **Thinking level** — per-session overrides
- **Tool calls** / **Thinking traces** — toggle visibility of internal reasoning and tool use in the transcript
- **Stop run** — halt the current agent run

### System Metrics
Live gauges for CPU, memory, GPU, disk, and network. Data comes from the machine running rocCLAW.

### Cron Jobs
Schedule agent runs using cron expressions. Schedules survive gateway restarts. Run immediately or on a timer.

### Exec Approvals
When an agent's command is blocked by the approval policy, rocCLAW shows an in-chat card:

- **Allow once** — approve this exact command for this run
- **Allow always** — add the command pattern to the agent's permanent allowlist
- **Deny** — block this time

Approvals are enforced by the gateway — they survive rocCLAW being offline.

### Token Usage
Per-agent token consumption dashboard.

---

## Permissions

rocCLAW exposes four settings that control what an agent can do. For the full model, see [Permissions & Sandboxing](docs/permissions-sandboxing.md).

| Setting | Options | What it controls |
|---------|---------|-----------------|
| **Command mode** | Off / Ask / Auto | Whether exec commands need approval, run silently, or are blocked |
| **Sandbox mode** | Off / Non-main / All | Whether sessions run sandboxed (`non-main` = everything except the main session) |
| **Workspace access** | None / Read-only / Read-write | What the sandbox can see of the agent's workspace |
| **Tools profile** | Minimal / Coding / Messaging / Full | Which tool groups are available |

> [!WARNING]
> `workspaceAccess = Read-only` does more than it sounds. It also **disables** the agent's `write`, `edit`, and `apply_patch` tools inside sandboxed sessions — even when those tools are nominally allowed by the tools profile. This is enforced by the gateway.

---

## Connecting to a remote gateway

### Tailscale (recommended)

Both machines on the same tailnet. On the gateway machine, set `gateway.bind` to your Tailscale IP or hostname:

```bash
# On the gateway machine — find your Tailscale IP
ip addr show tailscale0 | grep inet

# Set and restart
openclaw config set gateway.bind <tailscale-ip>
openclaw restart
```

Then use `wss://<gateway-host>.ts.net` as the Upstream URL in rocCLAW.

### SSH tunnel

```bash
# On your laptop
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Keep the tunnel open. Connect rocCLAW to `ws://localhost:18789`.

---

## Troubleshooting

### "Connect" fails
1. Is the gateway running? `openclaw status`
2. Is the URL correct? (`ws://` for plain, `wss://` for TLS — mixing them causes `EPROTO`)
3. Is the token correct? `openclaw config get gateway.auth.token`
4. Is the port right? `openclaw config get gateway.port`
5. Is the network/firewall allowing outbound WebSocket connections?

### Two kinds of 401
- **rocCLAW itself**: if you set `ROCCLAW_ACCESS_TOKEN` on the server, clients must send it as a bearer header
- **Gateway**: the gateway token is wrong or expired — re-run the config command and paste fresh

### SQLite errors
```bash
npm run verify:native-runtime:repair
```
If that fails: `xcode-select --install` (macOS) or `sudo apt install build-essential python3` (Ubuntu).

### Gateway keeps dropping
The server reconnects with exponential back-off (1s → 15s max). Frequent drops usually mean the gateway machine is under memory or GPU pressure.

### Agent won't respond
1. Check the sidebar: ● running, ○ offline
2. Look for a pending exec approval card in chat
3. Try a new session (chat header → New session)
4. Check gateway logs on the host

---

## Document map

Not sure where to look? Start here:

| What you want | Go to |
|--------------|-------|
| How to connect, what it looks like | This README |
| How each settings tab works | [UI Guide](docs/ui-guide.md) |
| How chat events flow from gateway to browser | [Chat Streaming](docs/pi-chat-streaming.md) |
| Sandbox modes, workspace access, exec approvals in depth | [Permissions & Sandboxing](docs/permissions-sandboxing.md) |
| Project structure, route inventory, event model | [Architecture](ARCHITECTURE.md) |
| Dev setup, testing, contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |

---

## License

See [LICENSE](LICENSE)
