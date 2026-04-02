# 💬 Chat Streaming

Understanding how real-time chat events flow from the OpenClaw gateway to your browser.

---

## 📋 Table of Contents

1. [Transport Model](#transport-model) — How messages flow
2. [Event Flow](#event-flow-detailed) — Step-by-step breakdown
3. [Reconnect and Replay](#reconnect-and-replay) — Handling disconnections
4. [History](#history) — Loading older messages
5. [Gateway Unavailability](#when-the-gateway-is-unavailable) — Degraded operation

---

## Transport Model

**The browser never connects directly to the gateway.** Instead, rocCLAW uses a proxy architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHAT MESSAGE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  BROWSER              SERVER               GATEWAY              │
│     │                    │                     │                 │
│     │  1. POST /api/     │                     │                 │
│     │     intents/       │                     │                 │
│     │     chat-send      │                     │                 │
│     │───────────────────►│                     │                 │
│     │                    │  2. Forward via     │                 │
│     │                    │     WebSocket       │                 │
│     │                    │────────────────────►│                 │
│     │                    │                     │  3. Process     │
│     │                    │                     │     message     │
│     │                    │                     │                 │
│     │                    │  4. Gateway emits │                 │
│     │                    │     events          │                 │
│     │                    │◄────────────────────│                 │
│     │                    │                     │                 │
│     │                    │  5. Persist to    │                 │
│     │                    │     SQLite outbox   │                 │
│     │                    │                     │                 │
│     │  6. SSE stream     │                     │                 │
│     │◄───────────────────│                     │                 │
│     │     gateway.event   │                     │                 │
│     │                    │                     │                 │
│     │  7. Render UI      │                     │                 │
│     │                    │                     │                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Benefit | Explanation |
|---------|-------------|
| **Security** | Gateway token never reaches the browser |
| **Reliability** | Server handles reconnects, buffering, replay |
| **Auditing** | All events persisted in SQLite for review |
| **Rate Limiting** | Server can throttle requests to protect gateway |

---

## Event Flow (Detailed)

### Step 1: User Sends Message

```typescript
// Browser action
async function sendMessage(agentId: string, message: string) {
  await fetch('/api/intents/chat-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message })
  });
}
```

### Step 2: Server Forwards to Gateway

```typescript
// Server: src/app/api/intents/chat-send/route.ts
export async function POST(request: Request) {
  const { agentId, message } = await request.json();
  
  // Forward to gateway via WebSocket
  const result = await gatewayClient.send({
    method: 'agent.chat',
    params: { agentId, message }
  });
  
  return Response.json(result);
}
```

### Step 3: Gateway Processes Message

The OpenClaw gateway:
1. Validates the request
2. Starts a new agent run
3. Streams response chunks
4. Emits events throughout the process

### Step 4: Gateway Emits Events

Example event sequence:

```json
{
  "type": "event",
  "event": "agent.run.started",
  "payload": {
    "agentId": "my-agent",
    "runId": "run-123",
    "timestamp": "2026-04-01T10:30:00Z"
  }
}
```

```json
{
  "type": "event",
  "event": "agent.message.chunk",
  "payload": {
    "agentId": "my-agent",
    "runId": "run-123",
    "content": "I'll help you",
    "index": 0
  }
}
```

```json
{
  "type": "event",
  "event": "agent.tool.called",
  "payload": {
    "agentId": "my-agent",
    "tool": "web_search",
    "params": { "query": "TypeScript tips" }
  }
}
```

```json
{
  "type": "event",
  "event": "agent.run.completed",
  "payload": {
    "agentId": "my-agent",
    "runId": "run-123",
    "status": "success"
  }
}
```

### Step 5: Server Persists to SQLite

```typescript
// src/lib/controlplane/projection-store.ts
async function persistEvent(event: GatewayEvent) {
  await db.run(
    `INSERT INTO outbox (event_type, payload, created_at)
     VALUES (?, ?, datetime('now'))`,
    event.type,
    JSON.stringify(event.payload)
  );
  
  return { id: db.lastInsertRowId };
}
```

### Step 6: SSE Stream Emits Events

```typescript
// src/app/api/runtime/stream/route.ts
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to new events
      const unsubscribe = runtime.subscribe((event) => {
        const frame = {
          type: 'gateway.event',
          event: event.type,
          payload: event.payload,
          seq: event.id
        };
        
        controller.enqueue(
          `data: ${JSON.stringify(frame)}\n\n`
        );
      });
      
      // Cleanup on disconnect
      request.signal.addEventListener('abort', unsubscribe);
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Step 7: Browser Renders Events

```typescript
// src/features/agents/state/store.tsx
function eventReducer(state, action) {
  switch (action.event) {
    case 'agent.message.chunk':
      return appendMessageChunk(state, action.payload);
    case 'agent.tool.called':
      return addToolCall(state, action.payload);
    case 'agent.run.completed':
      return markRunComplete(state, action.payload);
    default:
      return state;
  }
}
```

---

## Reconnect and Replay

### Scenario 1: Browser Reconnects

**What happens:** Your browser disconnects (network issue, page refresh) and reconnects.

**Solution:** Server-Sent Events (SSE) with `Last-Event-ID`.

```
┌─────────────────────────────────────────────────────────────┐
│  RECONNECT WITH REPLAY                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Browser disconnects                                          │
│       │                                                       │
│       ▼                                                       │
│  Events continue on server                                  │
│       │                                                       │
│       ▼                                                       │
│  Browser reconnects with header:                              │
│  Last-Event-ID: 1234                                         │
│       │                                                       │
│       ▼                                                       │
│  Server replays events 1235+                                  │
│       │                                                       │
│       ▼                                                       │
│  Browser is caught up — no missed messages!                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Browser: src/lib/runtimeEventStream.ts
const eventSource = new EventSource('/api/runtime/stream', {
  headers: {
    'Last-Event-ID': lastSeenEventId  // From localStorage or memory
  }
});

eventSource.addEventListener('message', (e) => {
  const event = JSON.parse(e.data);
  lastSeenEventId = event.seq;  // Update for next reconnect
  dispatch(event);
});
```

### Scenario 2: Fresh Connect

**What happens:** New browser session, no `Last-Event-ID`.

**Solution:** Server sends a "tail window" — recent events from the outbox.

```typescript
// Server: src/app/api/runtime/stream/route.ts
export async function GET(request: Request) {
  const lastEventId = request.headers.get('Last-Event-ID');
  
  if (!lastEventId) {
    // Fresh connect — send recent history
    const recentEvents = await db.query(
      `SELECT * FROM outbox 
       ORDER BY id DESC 
       LIMIT 100`
    );
    
    // Send in chronological order
    for (const event of recentEvents.reverse()) {
      yield event;
    }
  }
  
  // Continue with live events...
}
```

### Deduplication

**Problem:** Same event might arrive twice (from replay + live).

**Solution:** Deduplicate by outbox ID.

```typescript
// src/features/agents/state/store.tsx
function reducer(state, action) {
  // Skip if already processed
  if (state.processedIds.has(action.seq)) {
    return state;
  }
  
  // Process and mark as seen
  return {
    ...processEvent(state, action),
    processedIds: new Set([...state.processedIds, action.seq])
  };
}
```

---

## History

### Loading Older Messages

For messages not in the live buffer, rocCLAW fetches paginated history:

```bash
GET /api/runtime/agents/my-agent/history?limit=50&beforeOutboxId=1234
```

**Response:**

```json
{
  "entries": [
    {
      "id": 1233,
      "type": "agent.message",
      "payload": { /* ... */ },
      "createdAt": "2026-04-01T10:25:00Z"
    },
    {
      "id": 1232,
      "type": "agent.tool.called",
      "payload": { /* ... */ },
      "createdAt": "2026-04-01T10:24:50Z"
    }
    // ... 48 more entries
  ],
  "hasMore": true,
  "nextBeforeOutboxId": 1184
}
```

### Pagination Flow

```
┌─────────────────────────────────────────────────────────────┐
│  INFINITE SCROLL WITH CURSOR                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Initial load: GET /history?limit=50                      │
│     → Returns entries 1185-1234, hasMore: true               │
│                                                               │
│  2. User scrolls up, triggers load more                      │
│     → GET /history?limit=50&beforeOutboxId=1185              │
│                                                               │
│  3. Returns entries 1135-1184, hasMore: true                 │
│                                                               │
│  4. Continue until hasMore: false                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Unified Event Pipeline

History entries and live events go through **the same processing pipeline**:

```typescript
// src/features/agents/state/transcript.ts
function processEvent(event: GatewayEvent) {
  switch (event.type) {
    case 'agent.message':
      return processMessage(event);
    case 'agent.tool.called':
      return processToolCall(event);
    case 'agent.run.started':
    case 'agent.run.completed':
      return processRunState(event);
    // ... etc
  }
}

// Used for both:
// - History fetch (initial load)
// - Live SSE events (real-time)
```

---

## When the Gateway is Unavailable

### Degraded Operation Mode

If the gateway goes offline, rocCLAW doesn't crash — it continues serving data from SQLite:

**Runtime Reads:**

```typescript
// Returns projection-backed data with freshness metadata
{
  "data": { /* last known state */ },
  "freshness": {
    "lastUpdate": "2026-04-01T10:30:00Z",
    "isLive": false
  }
}
```

**Runtime Writes:**

```typescript
// Fails immediately with clear error
{
  "error": "GATEWAY_UNAVAILABLE",
  "message": "Gateway is offline. Changes will be applied when it reconnects.",
  "status": 503
}
```

### UI Behavior

| State | UI Behavior |
|-------|-------------|
| **Gateway Online** | Full functionality, real-time updates |
| **Gateway Offline** | Shows cached data, "offline" indicator, write operations queued or failed |
| **Reconnecting** | Banner with retry countdown, attempts exponential backoff |

### Reconnection Strategy

```
┌─────────────────────────────────────────────────────────────┐
│  EXPONENTIAL BACKOFF                                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Attempt 1: Wait 1 second                                    │
│  Attempt 2: Wait 2 seconds                                   │
│  Attempt 3: Wait 4 seconds                                   │
│  Attempt 4: Wait 8 seconds                                   │
│  ...                                                         │
│  Max: 15 seconds (cap)                                       │
│                                                               │
│  On success: Replay missed events from last known ID        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Types Reference

| Event | When Emitted | Payload |
|-------|------------|---------|
| `agent.run.started` | Agent begins processing | `{ agentId, runId, timestamp }` |
| `agent.run.completed` | Agent finishes successfully | `{ agentId, runId, status }` |
| `agent.run.aborted` | Run was stopped | `{ agentId, runId, reason }` |
| `agent.message.chunk` | Token streamed from model | `{ agentId, content, index }` |
| `agent.message` | Complete message | `{ agentId, content, role }` |
| `agent.tool.called` | Tool execution started | `{ agentId, tool, params }` |
| `agent.tool.completed` | Tool execution finished | `{ agentId, tool, result }` |
| `agent.status` | Agent status changed | `{ agentId, status }` |
| `agent.session.created` | New session started | `{ agentId, sessionKey }` |
| `exec.approval.requested` | Command needs approval | `{ agentId, command, runId }` |

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  KEY PRINCIPLES                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ Browser never connects directly to gateway              │
│  ✅ Server proxies all communication                         │
│  ✅ All events persisted to SQLite                           │
│  ✅ SSE with replay for reliability                          │
│  ✅ Deduplication by outbox ID                               │
│  ✅ Degraded mode when gateway offline                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

<div align="center">

**Questions?** See [Architecture](../ARCHITECTURE.md) or [README](../README.md)

</div>
