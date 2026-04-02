# 🏗️ rocCLAW Architecture

Technical deep-dive into how rocCLAW works under the hood.

---

## 📋 Table of Contents

1. [Overview](#overview) — The big picture
2. [Data Flow](#data-flow) — How data moves through the system
3. [Core Boundaries](#core-boundaries) — Security and separation
4. [API Routes](#api-routes) — Runtime and Intent endpoints
5. [Settings System](#settings-system) — Configuration management
6. [Durability Model](#runtime-durability-model) — Event persistence
7. [Error Handling](#error-semantics) — What happens when things go wrong
8. [Design Guardrails](#design-guardrails) — Architectural constraints

---

## Overview

rocCLAW uses a **single-runtime architecture** with clear separation between browser and gateway:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         REQUEST FLOW                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐     HTTP/SSE      ┌──────────────┐     WebSocket    │
│  │   Browser   │ ◄───────────────► │   rocCLAW    │ ◄─────────────► │
│  │   (React)   │                   │   Server     │                 │
│  └─────────────┘                   │   (Next.js)  │                 │
│                                     │              │                 │
│                                     │ • SQLite     │                 │
│                                     │ • Event      │                 │
│                                     │   Replay     │                 │
│                                     └──────────────┘                 │
│                                                                       │
│  Key Rule: Browser NEVER connects directly to the gateway!          │
└──────────────────────────────────────────────────────────────────────┘
```

### Communication Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| **HTTP APIs** | Browser → Server | Actions (intents), data queries |
| **SSE Stream** | Server → Browser | Real-time events, streaming |
| **WebSocket** | Server ↔ Gateway | Commands and gateway events |

---

## Data Flow

### 1. Gateway → Server (Inbound Events)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Gateway emits event                                     │
│  > Event: agent.message                                          │
└────────────────┬────────────────────────────────────────────────┘
                 │ WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Server receives via openclaw-adapter.ts              │
│  • Validates event                                              │
│  • Applies to projection-store.ts                             │
└────────────────┬────────────────────────────────────────────────┘
                 │ SQLite write
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Persisted to SQLite outbox                            │
│  • Idempotent deduplication                                     │
│  • WAL mode for durability                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │ Fanout
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Broadcast via SSE to browsers                          │
│  • Subscribers receive event                                   │
│  • Replay available on reconnect                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Browser → Gateway (Outbound Actions)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Browser sends intent                                  │
│  POST /api/intents/chat-send                                   │
│  { agentId, message }                                          │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Server validates and forwards                         │
│  • Rate limiting check                                         │
│  • Token redaction (token never in browser)                   │
│  • Method allowlist verification                               │
└────────────────┬────────────────────────────────────────────────┘
                 │ WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Gateway receives and executes                         │
│  • Runs agent logic                                            │
│  • Emits response events                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Boundaries

### Browser Boundary

**What the browser can do:**
- ✅ Call HTTP APIs (`/api/runtime/*`, `/api/intents/*`)
- ✅ Listen to SSE stream (`/api/runtime/stream`)
- ✅ Manage UI state in React components

**What the browser CANNOT do:**
- ❌ Open direct WebSocket to gateway
- ❌ See raw gateway token
- ❌ Execute arbitrary gateway methods

**Implementation:**

```typescript
// src/app/page.tsx (simplified)
// Browser only communicates via:
- useRuntimeEventStream()      // SSE connection
- fetch('/api/intents/*')      // HTTP actions
- AgentStore (React Context)   // Local state
```

### Server-Owned Control Plane

Located in: `src/lib/controlplane/`

| Module | File | Responsibility |
|--------|------|----------------|
| **OpenClaw Adapter** | `openclaw-adapter.ts` | WebSocket lifecycle, handshake, reconnect with exponential backoff, method allowlist |
| **Runtime** | `runtime.ts` | Process-local singleton; event fanout to subscribers |
| **Projection Store** | `projection-store.ts` | SQLite outbox; idempotent event application; deduplication; replay cursor |

### Key Files

```
src/lib/controlplane/
├── openclaw-adapter.ts      # Gateway WebSocket management
├── runtime.ts               # Event bus and subscriptions
├── projection-store.ts     # SQLite persistence
├── contracts.ts             # TypeScript types
└── domain-runtime-client.ts # High-level operations
```

---

## API Routes

### Runtime Read Routes (GET)

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/api/runtime/summary` | Gateway status summary | Connection status, version |
| `/api/runtime/fleet` | All agents | Agent list with status |
| `/api/runtime/agents/{id}/history` | Agent chat history | Messages with pagination |
| `/api/runtime/stream` | SSE event stream | Real-time events |
| `/api/runtime/config` | Gateway configuration | Current config snapshot |
| `/api/runtime/models` | Available models | Model choices |
| `/api/runtime/sessions` | Active sessions | Session metadata |
| `/api/runtime/chat-history` | Global chat history | Cross-agent messages |
| `/api/runtime/cron` | Cron jobs | Scheduled tasks |
| `/api/runtime/skills/status` | Skills status | Installed skills |
| `/api/runtime/agent-file` | Agent file content | Personality files |
| `/api/runtime/agent-state` | Agent state | Current agent status |
| `/api/runtime/media` | Media files | Attachments, images |

**Example History Query:**

```bash
GET /api/runtime/agents/my-agent/history?limit=50&beforeOutboxId=1234

Response:
{
  "entries": [...],
  "hasMore": true,
  "nextBeforeOutboxId": 1184
}
```

### Intent Routes (POST)

| Category | Routes |
|----------|--------|
| **Chat** | `/api/intents/chat-send`, `/api/intents/chat-abort`, `/api/intents/sessions-reset` |
| **Agents** | `/api/intents/agent-create`, `/api/intents/agent-rename`, `/api/intents/agent-delete`, `/api/intents/agent-wait` |
| **Permissions** | `/api/intents/agent-permissions-update` |
| **Exec** | `/api/intents/exec-approval-resolve`, `/api/intents/exec-approvals-set` |
| **Session** | `/api/intents/session-settings-sync` |
| **Cron** | `/api/intents/cron-add`, `/api/intents/cron-run`, `/api/intents/cron-remove`, `/api/intents/cron-remove-agent`, `/api/intents/cron-restore` |
| **Skills** | `/api/intents/skills-install`, `/api/intents/skills-update`, `/api/intents/skills-remove`, `/api/intents/agent-skills-allowlist`, `/api/intents/agent-file-set` |

**Intent Pattern:**

```typescript
// Intent routes follow a consistent pattern:
1. Validate request body
2. Rate limit check
3. Forward to gateway via WebSocket
4. Return async result or error
```

---

## Settings System

### Storage Locations

| Setting | Location | Notes |
|---------|----------|-------|
| Gateway URL | `~/.openclaw/openclaw-studio/settings.json` | Server-side only |
| Gateway Token | `~/.openclaw/openclaw-studio/settings.json` | **NEVER sent to browser** |
| User Preferences | `~/.openclaw/openclaw-studio/settings.json` | Theme, filters, etc. |
| Agent Config | `~/.openclaw/openclaw.json` | Gateway-managed |

### Token Security

```
┌─────────────────────────────────────────┐
│  Token Flow                              │
├─────────────────────────────────────────┤
│                                          │
│  Browser    Server    Settings File     │
│     │          │            │           │
│     │          │            │           │
│     │─────────►│            │           │
│     │  Save   │            │           │
│     │  Token  │───────────►│           │
│     │          │  Write    │           │
│     │          │            │           │
│     │◄─────────│            │           │
│     │  "Saved"  │            │           │
│     │  (no     │            │           │
│     │  token)  │            │           │
│     │          │            │           │
│     │◄─────────│            │           │
│     │  Status  │            │           │
│     │  "has    │            │           │
│     │  token"  │            │           │
│                                          │
│  Browser NEVER sees the raw token!      │
└─────────────────────────────────────────┘
```

### Reconnection Logic

When settings change:

```typescript
// src/lib/controlplane/runtime.ts
runtime.reconnectForGatewaySettingsChange()
// 1. Closes existing WebSocket
// 2. Applies new settings
// 3. Reconnects with exponential backoff
// 4. Replays missed events
```

---

## Runtime Durability Model

### Database Schema

**Path:** `~/.openclaw/openclaw-studio/runtime.db`

**Tables:**

```sql
-- Outbox table for event persistence
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL
);
```

**Configuration:**
- **Mode:** WAL (Write-Ahead Logging)
- **Sync:** NORMAL
- **Purpose:** Durability without blocking

### Event Persistence

**Idempotent Application:**

```typescript
// Same event applied twice = same result
async function applyEvent(event: DomainEvent) {
  const existing = await db.get(
    'SELECT id FROM outbox WHERE id = ?',
    event.id
  );
  
  if (existing) {
    return { applied: false, reason: 'already_exists' };
  }
  
  await db.run(
    'INSERT INTO outbox (id, event_type, payload) VALUES (?, ?, ?)',
    event.id, event.type, JSON.stringify(event.payload)
  );
  
  return { applied: true };
}
```

### SSE Replay Behavior

**Scenario 1: New Connection (No Last-Event-ID)**

```
Client connects ──► Server sends recent tail (last N events)
```

**Scenario 2: Reconnection (With Last-Event-ID)**

```
Client reconnects ──► Server replays from Last-Event-ID forward
                      (catches up on missed events)
```

**Implementation:**

```typescript
// src/app/api/runtime/stream/route.ts
export async function GET(request: Request) {
  const lastEventId = request.headers.get('Last-Event-ID');
  
  if (lastEventId) {
    // Replay from specific point
    const events = await getEventsAfter(parseInt(lastEventId));
    await sendEvents(events);
  } else {
    // Send recent tail
    const events = await getRecentEvents(100);
    await sendEvents(events);
  }
  
  // Continue with live events...
}
```

---

## Error Semantics

### Error Categories

| Situation | HTTP Status | Response | Client Action |
|-----------|-------------|----------|---------------|
| **Gateway Unavailable** | `503` | `GATEWAY_UNAVAILABLE` | Retry with backoff |
| **Rate Limited** | `429` | With `Retry-After` header | Wait, then retry |
| **Config Conflict** | `409` | Base hash mismatch | Retry once |
| **Validation Error** | `400` | Field errors | Fix and retry |
| **Auth Error** | `401` | Token invalid | Re-authenticate |

### Rate Limiting Headers

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
```

### Config Conflict Resolution

```typescript
// Retry with base-hash check
async function updateConfig(newConfig: Config) {
  const baseHash = await getCurrentConfigHash();
  
  try {
    await gateway.updateConfig(newConfig, { baseHash });
  } catch (error) {
    if (error.code === 'CONFIG_CONFLICT') {
      // Retry once with fresh hash
      const freshHash = await getCurrentConfigHash();
      await gateway.updateConfig(newConfig, { baseHash: freshHash });
    }
    throw error;
  }
}
```

---

## Design Guardrails

These are **intentional architectural constraints**, not historical accidents:

### 1. No Direct Browser-to-Gateway Transport

**Rule:** The browser must not open its own WebSocket to the gateway.

**Why:**
- Security: Token never exposed to browser
- Control: Server can rate limit, audit, transform
- Reliability: Server handles reconnects, buffering

**Enforcement:**
- Gateway binds to localhost/private interfaces
- Browser CORS policy blocks direct connections
- Server proxies all gateway traffic

### 2. No `/api/gateway/*` Routes

**Rule:** All browser-to-gateway traffic goes through `/api/runtime/*` or `/api/intents/*`.

**Why:**
- Consistent API surface
- Easier to audit and secure
- Clear separation of concerns

### 3. Explicit Method Allowlist

**Rule:** Only gateway methods listed in `openclaw-adapter.ts` are callable. No wildcards.

**Implementation:**

```typescript
// src/lib/controlplane/openclaw-adapter.ts
const ALLOWED_METHODS = [
  'agent.chat',
  'agent.create',
  'agent.delete',
  'agent.rename',
  // ... explicit list
] as const;

function callGatewayMethod(method: string, params: unknown) {
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`Method not allowed: ${method}`);
  }
  // Proceed with call...
}
```

### 4. Token Redaction is Server-Side

**Rule:** The browser never sees the raw gateway token.

**Implementation:**

```typescript
// When returning settings to browser:
{
  gatewayUrl: 'ws://127.0.0.1:18789',
  hasToken: true,      // ✅ Boolean only
  // token: REDACTED   // ❌ Never included
}
```

### 5. Additive SQLite Migrations Only

**Rule:** The outbox schema only adds columns/tables. No destructive migrations.

**Why:**
- Zero-downtime updates
- Backward compatibility
- Safe rollback

**Allowed:**
```sql
ALTER TABLE outbox ADD COLUMN new_field TEXT;
CREATE TABLE new_table (...);
```

**Not Allowed:**
```sql
ALTER TABLE outbox DROP COLUMN old_field;  -- ❌ Destructive
ALTER TABLE outbox MODIFY COLUMN ...;      -- ❌ Destructive
```

---

## Component Architecture

### Frontend (Browser)

```
src/
├── app/                      # Next.js App Router
│   ├── api/                 # API route handlers
│   ├── agents/[id]/         # Agent-specific pages
│   ├── page.tsx             # Main dashboard
│   └── layout.tsx           # Root layout
├── components/              # Shared UI components
│   ├── SystemMetricsDashboard.tsx
│   ├── TasksDashboard.tsx
│   └── ...
├── features/               # Feature domains
│   └── agents/
│       ├── components/     # Agent UI
│       ├── operations/     # Business logic
│       └── state/          # State management
└── lib/                    # Utilities
    ├── controlplane/       # Gateway communication
    ├── gateway/            # Gateway abstractions
    └── ...
```

### Backend (Server)

```
src/app/api/
├── runtime/
│   ├── summary/route.ts
│   ├── fleet/route.ts
│   ├── agents/[id]/
│   │   └── history/route.ts
│   └── stream/route.ts      # SSE endpoint
├── intents/
│   ├── chat-send/route.ts
│   ├── agent-create/route.ts
│   └── ...
└── studio/route.ts         # Settings endpoint
```

---

## State Management

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL STATE (Source of Truth)                            │
├─────────────────────────────────────────────────────────────┤
│  • Gateway config (~/.openclaw/openclaw.json)               │
│  • Gateway runtime (live agents, sessions)                   │
│  • SQLite outbox (event history)                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVER STATE (Projection)                                   │
├─────────────────────────────────────────────────────────────┤
│  • projection-store.ts (SQLite)                             │
│  • runtime.ts (in-memory subscriptions)                      │
└────────────────┬────────────────────────────────────────────┘
                 │ SSE
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  BROWSER STATE (UI)                                          │
├─────────────────────────────────────────────────────────────┤
│  • AgentStore (React Context + Reducer)                      │
│  • Local UI state (useState)                                │
│  • Draft state (unsaved changes)                            │
└─────────────────────────────────────────────────────────────┘
```

### State Layers

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Server** | SQLite + Event Bus | Persistence, fanout |
| **Browser** | React Context | UI state, caching |
| **Gateway** | openclaw.json | Source of truth |

---

## Performance Considerations

### Optimizations

1. **Event Deduplication** — Same event ID = same result
2. **SSE Tail Replay** — New clients get recent history without full scan
3. **Lazy Loading** — History fetched on demand with pagination
4. **Rate Limiting** — Protects gateway from overload

### Bottlenecks to Avoid

1. ❌ Don't query full outbox on every request
2. ❌ Don't hold large state in React Context
3. ❌ Don't skip deduplication
4. ✅ Use cursors for pagination
5. ✅ Use selectors for derived state

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│  TRUST BOUNDARIES                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐      ┌─────────────┐      ┌───────────────┐ │
│  │  Browser    │      │   Server    │      │    Gateway     │ │
│  │  (Untrusted)│─────►│  (Trusted)  │─────►│   (Trusted)    │ │
│  └─────────────┘      └─────────────┘      └───────────────┘ │
│                                                                 │
│  • No token    │      • Holds token  │      • Enforces      │ │
│  • Limited API │      • Rate limits  │      • Permissions   │ │
│  • Read-only   │      • Validates    │      • Sandboxing    │ │
│    gateway     │      • Audits       │      • Approvals     │ │
│    access      │      • Transforms   │                        │ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

<div align="center">

**Questions?** See [README](../README.md) or [Contributing Guide](../CONTRIBUTING.md)

</div>
