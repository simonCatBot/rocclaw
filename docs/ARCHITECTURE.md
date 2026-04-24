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

## Server Boot Process

The custom Node.js entry point (`server/index.js`) orchestrates startup:

1. **Verify native runtime** -- runs `scripts/verify-native-runtime.mjs` synchronously to ensure `better-sqlite3` bindings match the current Node.js ABI. Auto-repairs in dev mode, check-only in production. Skippable via `OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY=1`.
2. **Resolve hosts** -- defaults to dual-stack `["127.0.0.1", "::1"]`, configurable via `HOST` env var.
3. **Assert public host allowed** -- refuses to bind to non-loopback addresses without `ROCCLAW_ACCESS_TOKEN`.
4. **Initialize Next.js** -- creates the app with `next({ dev, hostname, port })`.
5. **Create access gate** -- cookie-based auth middleware from `ROCCLAW_ACCESS_TOKEN`.
6. **Create HTTP servers** -- one per host (typically IPv4 + IPv6 loopback). Each server intercepts requests through the access gate before delegating to Next.js.
7. **Listen on all hosts** concurrently via `Promise.all`.
8. **Detect install context** -- asynchronously probes local gateway (`openclaw status --json`, `openclaw sessions --json`), Tailscale (`tailscale status --json`), and rocCLAW CLI version (with 12-hour npm registry cache). Builds startup guidance messages.
9. **Print browser URL and startup guidance** -- SSH tunnel instructions, Tailscale serve recommendations, version update notices.

## Core Modules

### Control Plane (`src/lib/controlplane/`)

| Module | File | Responsibility |
|--------|------|----------------|
| Runtime | `runtime.ts` | Process-local singleton (on `globalThis`); event fanout to SSE subscribers |
| OpenClaw Adapter | `openclaw-adapter.ts` | WebSocket lifecycle, Ed25519 challenge-response handshake, exponential backoff reconnect (1s initial, 1.7x growth, 15s max), 29-method allowlist, automatic profile fallback |
| Projection Store | `projection-store.ts` | SQLite outbox (3 tables); idempotent event application; FNV-1a deduplication keys; agent-scoped history with backfill; replay cursor |
| Device Identity | `device-identity.ts` | Ed25519 keypair generation, disk persistence (`~/.openclaw/openclaw-rocclaw/device.json`, `0o600`), v3 challenge-response signing |
| Connect Profile | `gateway-connect-profile.ts` | Two profiles: `backend-local` (Node.js backend) and `legacy-control-ui` (webchat fallback); automatic fallback on missing scope errors |
| Domain Runtime Client | `domain-runtime-client.ts` | Browser-side API client for all domain operations |
| Intent Route | `intent-route.ts` | Rate-limited intent handler factory (30/s chat, 60/s default); error mapping (503/409/400) |
| Exec Approvals | `exec-approvals.ts` | Three roles (conservative/collaborative/autonomous); optimistic concurrency with retry |
| Degraded Read | `degraded-read.ts` | CLI probe fallback (`openclaw status/sessions --json`); three freshness tiers (gateway/probe/projection) |

### Gateway Connect Handshake

The adapter authenticates using Ed25519 device identity:

1. Gateway sends `connect.challenge` event with a nonce.
2. Adapter signs a v3 payload (`v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily`) with the Ed25519 private key.
3. Adapter sends `connect` request with role `"operator"` and five scopes: `operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing`.
4. If rejected for missing scopes, automatically falls back to `legacy-control-ui` profile (webchat mode with origin header).

### State Management (`src/features/agents/state/`)

| Module | File | Responsibility |
|--------|------|----------------|
| Agent Store | `store.tsx` | React Context + `useReducer` — holds all agent state (~40 fields per agent) |
| Transcript | `transcript.ts` | Dual transcript system: legacy `outputLines` + structured V2 `TranscriptEntry` with FNV-1a fingerprinting (32-bit, 2-second timestamp bucketing) for deduplication and merge |
| Event Stream | `useRuntimeEventStream.ts` | SSE connection hook with `Last-Event-ID` resume via `sessionStorage` |
| Event Bridge | `runtimeEventBridge.ts` | Maps gateway events to store actions |

### Operations (`src/features/agents/operations/`)

Operations follow a workflow/operation naming pattern:

- `*Workflow.ts` — Pure planning functions that produce decisions. No side effects. Return typed intent objects with `kind: "skip" | "patch" | "load"` and a `reason` for skip cases.
- `*Operation.ts` — Side-effectful executors that carry out plans. Call workflow functions, execute side effects (fetch, gateway calls), return command arrays processed by `execute*Commands()` functions.
- `use*Controller.ts` — React hooks that wire workflows to UI.

35 files cover: bootstrap, fleet hydration, agent permissions, agent settings mutation, chat send, chat first-paint, config mutation, cron creation, agent deletion, domain history, gateway restart policy, mutation lifecycle, runtime sync, and more.

### Exec Approval System (`src/features/agents/approvals/`)

A fully wired end-to-end approval system across 10 files:

| File | Layer | Responsibility |
|------|-------|----------------|
| `types.ts` | Types | `PendingExecApproval`, `ExecApprovalDecision` (allow-once/allow-always/deny) |
| `execApprovalEvents.ts` | Parsing | Parse `exec.approval.requested` and `exec.approval.resolved` gateway events |
| `execApprovalLifecycleWorkflow.ts` | Planning | Pure function producing scoped/unscoped upserts, removals, activity markers |
| `pendingStore.ts` | Data | Pure data operations: upsert, merge, remove, prune expired approvals |
| `execApprovalRuntimeCoordinator.ts` | Coordination | Two-tier state (scoped by agent + unscoped); derive `awaitingUserInput` patches; two-phase auto-resume |
| `execApprovalPausePolicy.ts` | Policy | Pause run only if: agent running, run not paused, ask mode is "always" |
| `execApprovalResolveOperation.ts` | Execution | Send decision to gateway; wait up to 15s for run completion; handle "unknown approval id" |
| `execApprovalControlLoopWorkflow.ts` | Planning | Expiry pruning timer; ingress command planning |
| `execApprovalRunControlWorkflow.ts` | Planning | Pause/resume planning |
| `execApprovalRunControlOperation.ts` | Execution | Execute pause (`chatAbort`), auto-resume with follow-up message |

## API Routes

### Runtime Read Routes (GET)

| Endpoint | Purpose |
|----------|---------|
| `/api/runtime/summary` | Gateway status summary |
| `/api/runtime/fleet` | All agents with status (supports degraded mode) |
| `/api/runtime/agents/[agentId]/history` | Agent chat history (paginated) |
| `/api/runtime/agents/[agentId]/preview` | Agent preview |
| `/api/runtime/stream` | SSE event stream with replay |
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
| `/api/rocclaw` | rocCLAW settings (GET: redacted read, PUT: patch + reconnect) |
| `/api/rocclaw/test-connection` | Gateway connection test |
| `/api/gateway-info` | Gateway version and info |
| `/api/gateway-metrics` | System metrics (local + remote, polled every 5s) |
| `/api/usage` | Token usage data |
| `/api/cron/jobs` | Cron job listing |
| `/api/cron/run` | Cron job execution |

All intent routes follow the same pattern: validate request body, rate-limit check (per client IP), forward to gateway via WebSocket, return result or error.

## SSE Stream Implementation

The `/api/runtime/stream` endpoint implements reliable event delivery:

1. **Subscribe immediately** to live events, buffering them during startup phase.
2. **Snapshot** the outbox head position.
3. **Replay** historical events from `lastDeliveredId` up to the snapshot head (max 2,000 entries per batch).
4. **Flush startup buffer** -- deliver any events received during replay (sorted by ID).
5. **Switch to live mode** -- deliver events directly + 15-second heartbeat keepalive.

This prevents event loss during the gap between subscribing and replaying.

**Resume support:** Clients send `Last-Event-ID` (via query parameter or HTTP header). The browser persists the latest event ID in `sessionStorage` for reconnection.

## Fleet Hydration and Degraded Mode

The `/api/runtime/fleet` endpoint supports graceful degradation:

**Normal mode:** Full gateway RPC hydration (agents, sessions, summaries, config).

**Degraded mode** (triggered by gateway unavailable, start failure, or missing scope):
- Scans the last 5,000 outbox entries backward to extract agent identities from event payloads.
- Builds synthetic fleet seeds from `agentId` and `sessionKey` patterns (`agent:{agentId}:*`).
- Includes a CLI probe (`openclaw status/sessions --json`) and runtime freshness derivation.
- Returns `{ degraded: true, freshness: { source, stale, reason } }`.

Three freshness tiers:
1. `source: "gateway"` — live data from connected gateway.
2. `source: "probe"` — CLI probe succeeded, gateway unavailable.
3. `source: "projection"` — fallback to SQLite projection store.

## Settings System

| Setting | Location |
|---------|----------|
| Gateway URL / Token | `~/.openclaw/openclaw-rocclaw/settings.json` (server-side only) |
| Device Identity | `~/.openclaw/openclaw-rocclaw/device.json` (Ed25519 keypair, `0o600`) |
| Agent Config | `~/.openclaw/openclaw.json` (gateway-managed) |
| Runtime Database | `~/.openclaw/openclaw-rocclaw/runtime.db` |
| UI Preferences | Browser `localStorage` |

The gateway token is never sent to the browser. The browser only sees `hasToken: true`.

**Settings resolution cascade:** `settings.json` -> fallback to `~/.openclaw/openclaw.json` for gateway defaults (port + auth token) -> final default `ws://localhost:18789`.

**Browser-side coordination:** `ROCclawSettingsCoordinator` debounces patches (350ms) and serializes writes through a promise queue.

## Durability Model

**Database:** SQLite with WAL mode at `~/.openclaw/openclaw-rocclaw/runtime.db`

**Schema (3 tables):**
- `runtime_projection` — single-row status tracking (status, reason, timestamp).
- `outbox` — auto-incrementing event log (id, event_type, event_json, created_at, agent_id).
- `processed_events` — deduplication table keyed by deterministic event keys.

**Event persistence:** Each gateway event is written to the outbox table within a SQLite transaction. Event keys are derived deterministically (e.g., `gateway.event:<event>:epoch:<epoch>:seq:<seq>`). The same event applied twice produces the same result.

**SSE replay:**
- New connection (no `Last-Event-ID`): Server sends a tail window of recent events.
- Reconnection (with `Last-Event-ID`): Server replays all events after the given ID.

**Deduplication:** Both server-side (outbox ID + processed_events table) and client-side (store skips already-processed IDs, FNV-1a fingerprinting in transcript).

**Migrations:** Additive only — columns and tables are added, never dropped. Schema auto-creates on construction with evolution support (e.g., adding `agent_id` column and composite index).

## Error Handling

| Situation | HTTP Status | Client Action |
|-----------|-------------|---------------|
| Gateway unavailable | 503 | Retry with backoff |
| Rate limited | 429 | Wait for `Retry-After: 1`, then retry |
| Config conflict | 409 | Retry with fresh base hash |
| Validation error | 400 | Fix input and retry |
| Auth error | 401 | Re-authenticate |
| Native module mismatch | 503 | Run `npm rebuild better-sqlite3` |

**Rate limit responses** include: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers.

**Gateway intent timeout:** 600,000ms (10 minutes) for long-running operations like `chat.send`.

## Design Guardrails

1. **No direct browser-to-gateway transport.** The browser cannot open its own WebSocket to the gateway. Security (token hidden), control (rate limiting, auditing), and reliability (reconnect, buffering) depend on this.

2. **Explicit method allowlist.** Only 29 gateway methods listed in `openclaw-adapter.ts` are callable. No wildcards, no passthrough.

3. **Token redaction is server-side.** The browser never sees the raw gateway token.

4. **Additive SQLite migrations only.** The outbox schema only adds columns/tables. No destructive migrations (no DROP COLUMN, no MODIFY).

5. **Process singleton.** `ControlPlaneRuntime` is stored on `globalThis` to ensure one instance per Node.js process, surviving Next.js hot reload.

6. **Ed25519 device identity.** Cryptographic device authentication with challenge-response handshake. Keypair stored with `0o600` permissions.

7. **Automatic profile fallback.** If the gateway rejects operator scopes, the adapter silently falls back to legacy webchat profile.

## Security Model

```
Browser (Untrusted)  -->  Server (Trusted)  -->  Gateway (Trusted)
- No token                - Holds token          - Enforces permissions
- Limited API surface     - Rate limits          - Sandboxing
- Read-only gateway       - Validates            - Exec approvals
  access                  - Audits               - Tool restrictions
                          - Ed25519 auth
```

### Three Security Layers

| Layer | Module | Mechanism |
|-------|--------|-----------|
| Network Policy | `server/network-policy.js` | Refuses public IP binding without `ROCCLAW_ACCESS_TOKEN`. Classifies `0.0.0.0`, `::`, and non-loopback IPs as public. |
| Access Gate | `server/access-gate.js` | Cookie-based auth (`HttpOnly; SameSite=Lax`). Token exchanged via `?access_token=` query parameter. Protects all `/api/*` routes and WebSocket upgrades. |
| Gateway Adapter | `src/lib/controlplane/openclaw-adapter.ts` | 29-method allowlist, per-IP rate limiting (30/s chat, 60/s default), Ed25519 device authentication. |

The gateway is the enforcement point for all security policies (sandboxing, exec approvals, tool restrictions). rocCLAW configures these settings but does not enforce them.

## System Monitoring

### Metrics Collection

System metrics are collected via `/api/gateway-metrics` and displayed in two dashboard views:

**SystemMetricsDashboard** — real-time gauges:
- CPU: usage bar, cores/threads, speed, temperature, per-core grid
- Memory: usage percentage, used/total GB, swap
- GPU: usage, VRAM with ML-specific status (CRITICAL >95%, WARNING >85%, ELEVATED >70%), temperature, power, clock, ROCm version badge
- Disk: usage bar, used/total
- Network: throughput, download/upload speeds, total transferred

**SystemGraphView** — time-series charts (Recharts):
- Polls every 5 seconds, maintains up to 360 samples (30 minutes)
- Six metric cards: CPU %, Memory %, GPU %, GPU VRAM %, CPU Temperature, GPU Temperature
- Time range selector: 5m / 10m / 30m

### GPU Detection

Two detection paths:

1. **ROCm** (`src/lib/system/rocm.ts`): `rocminfo` + `rocm-smi` for AMD GPUs. Full metrics (usage, VRAM, temperature, power, clocks). Marketing name resolution for RDNA 1/2/3, 3.5, Vega, CDNA/Instinct. Strix Point/Halo differentiation by compute unit count.

2. **Fallback** (`src/lib/system/gpu-fallback.ts`): `lspci` + DRM sysfs for any Linux GPU without ROCm. Reads VRAM, GPU busy %, temperature, clocks from `/sys/class/drm/card*/device/`.

### Local vs Remote

Metrics display "Local" or "Remote: {hostname}" based on both server-side connection mode and browser-side hostname detection.
