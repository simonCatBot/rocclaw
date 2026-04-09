# Architecture

Technical reference for how rocCLAW works under the hood.

## Overview

rocCLAW uses a single-runtime proxy architecture. The browser never connects directly to the OpenClaw gateway.

```
Browser (React) <--HTTP/SSE--> rocCLAW Server (Next.js + SQLite) <--WebSocket--> OpenClaw Gateway
```

| Channel | Direction | Purpose |
|---------|-----------|---------|
| HTTP APIs | Browser -> Server | Actions (intents), data queries |
| SSE Stream | Server -> Browser | Real-time events, streaming |
| WebSocket | Server <-> Gateway | Commands and gateway events |

## Data Flow

### Inbound (Gateway -> Browser)

1. Gateway emits event via WebSocket
2. Server receives in `openclaw-adapter.ts`, validates, applies to `projection-store.ts`
3. Event persisted to SQLite outbox (idempotent, WAL mode)
4. Broadcast via SSE to connected browsers

### Outbound (Browser -> Gateway)

1. Browser sends intent via `POST /api/intents/*`
2. Server validates, rate-limits, checks method allowlist
3. Forwarded to gateway via WebSocket
4. Gateway executes and emits response events

## Core Modules

### Control Plane (`src/lib/controlplane/`)

| Module | File | Responsibility |
|--------|------|----------------|
| OpenClaw Adapter | `openclaw-adapter.ts` | WebSocket lifecycle, handshake, reconnect with exponential backoff, 29-method allowlist |
| Runtime | `runtime.ts` | Process-local singleton (on `globalThis`); event fanout to SSE subscribers |
| Projection Store | `projection-store.ts` | SQLite outbox; idempotent event application; deduplication; replay cursor |
| Domain Runtime Client | `domain-runtime-client.ts` | High-level operations |

### State Management (`src/features/agents/state/`)

| Module | File | Responsibility |
|--------|------|----------------|
| Agent Store | `store.tsx` | React Context + `useReducer` — holds all agent state |
| Transcript | `transcript.ts` | Chat transcript with dedup (FNV-1a fingerprinting) |
| Event Stream | `useRuntimeEventStream.ts` | SSE connection hook with reconnect |
| Event Bridge | `runtimeEventBridge.ts` | Maps gateway events to store actions |

### Operations (`src/features/agents/operations/`)

Operations follow a workflow/operation naming pattern:
- `*Workflow.ts` — Pure planning functions that produce decisions
- `*Operation.ts` — Side-effectful executors that carry out plans
- `use*Controller.ts` — React hooks that wire workflows to UI

## API Routes

### Runtime Read Routes (GET)

| Endpoint | Purpose |
|----------|---------|
| `/api/runtime/summary` | Gateway status summary |
| `/api/runtime/fleet` | All agents with status |
| `/api/runtime/agents/[agentId]/history` | Agent chat history (paginated) |
| `/api/runtime/agents/[agentId]/preview` | Agent preview |
| `/api/runtime/stream` | SSE event stream |
| `/api/runtime/config` | Gateway configuration snapshot |
| `/api/runtime/models` | Available models |
| `/api/runtime/cron` | Cron jobs |
| `/api/runtime/agent-file` | Agent personality file content |
| `/api/runtime/agent-state` | Agent runtime state |
| `/api/runtime/media` | Media files / attachments |
| `/api/runtime/disconnect` | Disconnect from gateway |

### Intent Routes (POST)

| Category | Routes |
|----------|--------|
| Chat | `chat-send`, `chat-abort`, `sessions-reset` |
| Agents | `agent-create`, `agent-rename`, `agent-delete`, `agent-wait` |
| Config | `agent-permissions-update`, `agent-file-set`, `session-settings-sync` |
| Exec | `exec-approval-resolve` |
| Cron | `cron-add`, `cron-run`, `cron-remove`, `cron-remove-agent`, `cron-restore` |

### Other Routes

| Endpoint | Purpose |
|----------|---------|
| `/api/rocclaw` | rocCLAW settings (read/write) |
| `/api/rocclaw/test-connection` | Gateway connection test |
| `/api/gateway-info` | Gateway version and info |
| `/api/gateway-metrics` | System metrics (local + remote) |
| `/api/usage` | Token usage data |
| `/api/cron/jobs` | Cron job listing |
| `/api/cron/run` | Cron job execution |

All intent routes follow the same pattern: validate request body, rate-limit check, forward to gateway via WebSocket, return result or error.

## Settings System

| Setting | Location |
|---------|----------|
| Gateway URL / Token | `~/.openclaw/openclaw-rocclaw/settings.json` (server-side only) |
| Agent Config | `~/.openclaw/openclaw.json` (gateway-managed) |
| Runtime Database | `~/.openclaw/openclaw-rocclaw/runtime.db` |

The gateway token is never sent to the browser. The browser only sees `hasToken: true`.

## Durability Model

**Database:** SQLite with WAL mode at `~/.openclaw/openclaw-rocclaw/runtime.db`

**Event persistence:** Each gateway event is written to the outbox table with idempotent deduplication. The same event applied twice produces the same result.

**SSE replay:**
- New connection (no `Last-Event-ID`): Server sends a tail window of recent events
- Reconnection (with `Last-Event-ID`): Server replays all events after the given ID

**Deduplication:** Both server-side (outbox ID) and client-side (store skips already-processed IDs).

## Error Handling

| Situation | HTTP Status | Client Action |
|-----------|-------------|---------------|
| Gateway unavailable | 503 | Retry with backoff |
| Rate limited | 429 | Wait for `Retry-After`, then retry |
| Config conflict | 409 | Retry with fresh base hash |
| Validation error | 400 | Fix input and retry |
| Auth error | 401 | Re-authenticate |

## Design Guardrails

1. **No direct browser-to-gateway transport.** The browser cannot open its own WebSocket to the gateway. Security (token hidden), control (rate limiting, auditing), and reliability (reconnect, buffering) depend on this.

2. **Explicit method allowlist.** Only gateway methods listed in `openclaw-adapter.ts` are callable. No wildcards, no passthrough.

3. **Token redaction is server-side.** The browser never sees the raw gateway token.

4. **Additive SQLite migrations only.** The outbox schema only adds columns/tables. No destructive migrations (no DROP COLUMN, no MODIFY).

5. **Process singleton.** `ControlPlaneRuntime` is stored on `globalThis` to ensure one instance per Node.js process, surviving Next.js hot reload.

## Security Model

```
Browser (Untrusted)  -->  Server (Trusted)  -->  Gateway (Trusted)
- No token                - Holds token          - Enforces permissions
- Limited API surface     - Rate limits          - Sandboxing
- Read-only gateway       - Validates            - Exec approvals
  access                  - Audits
```

The gateway is the enforcement point for all security policies (sandboxing, exec approvals, tool restrictions). rocCLAW configures these settings but does not enforce them.
