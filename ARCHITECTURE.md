# Architecture

## Overview

rocCLAW uses a single-runtime architecture:

1. Browser → Studio HTTP APIs (`/api/runtime/*`, `/api/intents/*`)
2. Browser → Studio SSE stream (`/api/runtime/stream`)
3. Studio server → OpenClaw Gateway (server-owned WebSocket adapter)

The browser never opens a direct gateway transport.

## Core boundaries

### Browser boundary

- UI state lives in `src/features/agents` and `src/app/page.tsx`.
- The browser communicates only through Studio HTTP routes and SSE.
- Events from `/api/runtime/stream` flow through `gatewayRuntimeEventHandler` and the approval ingress workflows.

### Server-owned control plane

Runtime modules under `src/lib/controlplane/`:

| Module | Responsibility |
|--------|---------------|
| `openclaw-adapter.ts` | Gateway WebSocket lifecycle, handshake, reconnect with exponential back-off, explicit method allowlist |
| `runtime.ts` | Process-local singleton; fanouts events to subscribers |
| `projection-store.ts` | SQLite outbox; idempotent event application, deduplication, replay cursor |

### Runtime read routes

```
/api/runtime/summary
/api/runtime/fleet
/api/runtime/agents/<agentId>/history
/api/runtime/stream
/api/runtime/config
/api/runtime/models
/api/runtime/sessions
/api/runtime/chat-history
/api/runtime/cron
/api/runtime/skills/status
/api/runtime/agent-file
/api/runtime/agent-state
/api/runtime/media
```

### Intent routes

```
/api/intents/chat-send        /api/intents/chat-abort        /api/intents/sessions-reset
/api/intents/agent-create     /api/intents/agent-rename      /api/intents/agent-delete     /api/intents/agent-wait
/api/intents/agent-permissions-update
/api/intents/exec-approval-resolve    /api/intents/exec-approvals-set
/api/intents/session-settings-sync
/api/intents/cron-add         /api/intents/cron-run         /api/intents/cron-remove     /api/intents/cron-remove-agent    /api/intents/cron-restore
/api/intents/skills-install   /api/intents/skills-update     /api/intents/skills-remove
/api/intents/agent-skills-allowlist   /api/intents/agent-file-set
```

## Settings boundary

- Route: `src/app/api/studio/route.ts`
- Persisted to: `~/.openclaw/openclaw-studio/settings.json`
- Gateway token is stored server-side and **redacted from all browser-facing responses**
- Gateway URL or token changes trigger a deterministic reconnect via `runtime.reconnectForGatewaySettingsChange()`

## Runtime durability model

**DB path:** `~/.openclaw/openclaw-studio/runtime.db`

The projection store:
- Applies domain events **idempotently** (same event keyed twice → same result, no duplicates)
- Persists ordered outbox rows to SQLite (WAL mode)
- Serves replay and history windows on demand

**SSE replay behavior:**
- With `Last-Event-ID`: replay forward from that ID
- Without `Last-Event-ID`: replay a recent tail window from the outbox head

## History model

```
GET /api/runtime/agents/<agentId>/history?limit=<n>&beforeOutboxId=<cursor>
```

Returns `{ entries, hasMore, nextBeforeOutboxId }` — newest entries first.

The client-side `useRuntimeSyncController` feeds fetched entries through the **same event pipeline** as live SSE and deduplicates by outbox ID.

## Error semantics

| Situation | Behavior |
|----------|----------|
| Gateway unavailable | Intent routes return `GATEWAY_UNAVAILABLE` with status `503` |
| Startup / read degradation | Runtime reads return projection-backed data with freshness metadata |
| Config conflict | Base-hash retry loop (up to 1 retry) before surfacing the error |
| Rate limited | Intent routes return `429` with `Retry-After` and `X-RateLimit-*` headers |

## Design guardrails

These are intentional constraints, not historical notes:

- **No direct browser-to-gateway transport.** The browser must not open its own WebSocket to the gateway.
- **No new `/api/gateway/*` routes.** All browser-to-gateway traffic goes through `/api/runtime/*` or `/api/intents/*`.
- **Explicit method allowlist.** Only gateway methods listed in `openclaw-adapter.ts` are callable from the browser. No wildcard.
- **Token redaction is server-side.** The browser never sees the raw gateway token.
- **Additive SQLite migrations only.** The outbox schema must only add columns/tables — no destructive migrations.
