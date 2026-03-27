# rocCLAW

**Focused operator studio for OpenClaw.** A clean, tabbed dashboard to connect to your gateway, manage agents, run chats, monitor system metrics, configure cron jobs, and handle exec approvals — all from one interface.

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/EFkFHbZw)
[![Node](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

---

## What it looks like

```
┌─────────────────────────────────────────────────────────────┐
│  ⬡ rocCLAW          [● Connected]           [⚙ Settings]   │
├───────────────┬─────────────────────────────────────────────┤
│               │  [Agents] [Chat] [System] [Tokens] [⚙]       │
│  ● Kapu       │  ┌─────────────────────────────────────────┐ │
│    running    │  │  Kapu                            [⫶][✎]│ │
│               │  │  Model: claude-3-5-sonnet  Thinking: low│ │
│  ● Simon      │  ├─────────────────────────────────────────┤ │
│    idle       │  │                                          │ │
│               │  │  Hi Kapu, how's it going?               │ │
│  ○ Debbie     │  │                                          │ │
│    offline    │  │  → Running...                            │ │
│               │  │                                          │ │
│  [+ New Agent]│  │  ────────────────────────────────────    │ │
│               │  │  [Message Kapu...]              [Send ➤]│ │
│  Filter: [All]│  └─────────────────────────────────────────┘ │
└───────────────┴─────────────────────────────────────────────┘
```

---

## How it works

rocCLAW is a **server-side dashboard** — it never exposes a direct gateway WebSocket to the browser.

```
Browser  ──HTTP/SSE──►  rocCLAW Server  ──WebSocket──►  OpenClaw Gateway
                        (Next.js + ws)                    (your AI runtime)
                        • owns gateway connection
                        • stores SQLite outbox
                        • redacts tokens
                        • enforces rate limits
```

All browser↔gateway traffic flows through the server. The browser subscribes to a server-owned SSE stream (`/api/runtime/stream`) and sends intents through HTTP routes (`/api/intents/*`). The server maintains a **SQLite outbox** with an event projection store — events are written to the outbox, deduplicated, and replayed to new browser connections on demand.

---

## Features

| Area | What you can do |
|------|---------------|
| **Agents** | Create, rename, delete agents. Per-agent avatar (Multiavatar), personality files (`SOUL.md`, `AGENTS.md`, `USER.md`, `IDENTITY.md`), and session controls. |
| **Chat** | Real-time chat via SSE streaming. New session, stop run, model/thinking level pickers, tool-call and thinking-trace toggles. |
| **System Metrics** | Live CPU, memory, GPU, disk, and network gauges. |
| **Cron Jobs** | Create, run, delete schedules per agent. Template → task → schedule → review flow. |
| **Exec Approvals** | Pause/resume runs, approve or deny exec commands (allow-once, allow-always, deny). |
| **Permissions** | Sandbox mode (off / non-main / all), workspace access (none / ro / rw), tools profile (minimal / coding / messaging / full), per-tool allowlist/denylist. |
| **Tokens** | Per-agent token usage dashboard. |

---

## Prerequisites

- **Node.js ≥ 20.9.0** (with npm ≥ 10.x)
- **OpenClaw Gateway** running somewhere reachable from rocCLAW
- **OpenClaw auth token** — get it with `openclaw config get gateway.auth.token`

> [!NOTE]
> rocCLAW is a UI-only dashboard. It does not build or run the OpenClaw gateway. It reads your existing `~/.openclaw/openclaw.json` and communicates with the gateway over its WebSocket API.

---

## Quick start

```bash
git clone https://github.com/simonCatBot/rocclaw.git
cd rocclaw
npm install

# Verify native dependencies (better-sqlite3). Runs automatically before
# npm run dev — but you can also run it manually:
npm run verify:native-runtime:repair

npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then:

1. Enter your **Upstream URL** (`ws://localhost:18789` for local gateway)
2. Enter your **Gateway token** (`openclaw config get gateway.auth.token`)
3. Click **Connect**

---

## Setup scenarios

### Everything on the same machine

```
Upstream URL:  ws://localhost:18789
Upstream Token: <from openclaw config>
```

### Gateway on a cloud VM, rocCLAW on your laptop

**Option A — Tailscale (recommended)**

Both machines on the same Tailscale tailnet:

```
Upstream URL:  wss://<gateway-host>.ts.net
```

No extra setup. Make sure your gateway is bound to the Tailscale interface (check `gateway.bind` in your OpenClaw config).

**Option B — SSH tunnel**

```bash
# On your laptop — tunnels local port 18789 to the gateway machine
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

```
Upstream URL:  ws://localhost:18789
```

### rocCLAW on a public host

If binding rocCLAW to a public interface (`0.0.0.0`), set the access token to require authentication:

```bash
ROCCLAW_ACCESS_TOKEN=your-secret-token npm start
```

Clients must then pass this token as a bearer header when connecting to rocCLAW.

---

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port rocCLAW listens on |
| `OPENCLAW_STATE_DIR` | `~/.openclaw` | OpenClaw config directory |
| `STUDIO_ACCESS_TOKEN` | _(none)_ | Require a bearer token to access the Studio UI |
| `OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY` | _(none)_ | Set to `1` to skip the `better-sqlite3` native dep check (not recommended) |

### File locations

| What | Where |
|------|-------|
| Gateway config | `~/.openclaw/openclaw.json` |
| Studio settings | `~/.openclaw/rocclaw/settings.json` |
| Runtime database | `~/.openclaw/rocclaw/runtime.db` |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (auto-repairs native deps) |
| `npm run dev:turbo` | Start with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checker |
| `npm run test` | Run unit tests (Vitest) |
| `npm run e2e` | Run Playwright end-to-end tests |
| `npm run verify:native-runtime:repair` | Rebuild `better-sqlite3` for your Node version |
| `npm run cleanup:ux-artifacts` | Clear UX audit artifacts before committing |

---

## Documentation

| Doc | What it covers |
|-----|---------------|
| [UI Guide](docs/ui-guide.md) | Connection flow, agent surfaces, chat, settings tabs (Personality, Capabilities, Automations, Advanced), agent creation defaults |
| [Chat Streaming](docs/pi-chat-streaming.md) | Server-owned SSE transport, event outbox, replay/resume, history backfill, degraded reads |
| [Permissions & Sandboxing](docs/permissions-sandboxing.md) | Sandbox modes, workspace access, tools profiles, per-tool allow/deny lists |
| [Color System](docs/color-system.md) | Design tokens and Tailwind CSS variables |
| [Architecture](ARCHITECTURE.md) | Full technical architecture, runtime durability model, history model, removed legacy surfaces |

---

## Troubleshooting

### "Connect" fails

1. Verify your gateway is actually running: `openclaw status`
2. Double-check the URL (use `ws://` for plain HTTP, `wss://` for TLS)
3. Confirm the token is correct: `openclaw config get gateway.auth.token`
4. If the gateway is on a remote machine, check that your network/firewall allows the connection

### EPROTO errors

Use `ws://` for non-TLS endpoints and `wss://` for TLS endpoints. Mixing these up causes SSL handshake failures.

### 401 Unauthorized

Set `ROCCLAW_ACCESS_TOKEN` when binding rocCLAW to a public interface. The gateway token and the Studio access token are separate.

### SQLite / native dependency errors

```bash
npm run verify:native-runtime:repair
```

If that fails, ensure you have build tools installed:
- **macOS:** `xcode-select --install`
- **Ubuntu/Debian:** `sudo apt install build-essential python3`
- **Alpine:** `apk add python3 make g++`

### Node version mismatch

Ensure `node` and `npm` are from the same installation:
```bash
node --version
npm --version
```

If using nvm: `nvm use` (reads `.nvmrc` automatically).

### Gateway connection drops

The server automatically reconnects with exponential back-off (1s → 15s max). If drops persist, check gateway logs and resource usage (memory/GPU pressure can cause the gateway to OOM or restart).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, testing commands, commit conventions, and PR guidelines.

## License

See [LICENSE](LICENSE)
