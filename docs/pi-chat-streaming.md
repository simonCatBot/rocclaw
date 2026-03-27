# Chat Streaming

How real-time chat events flow from the OpenClaw gateway to the rocCLAW browser.

## Transport model

The browser never connects directly to the gateway.

1. User sends a message via `POST /api/intents/chat-send`
2. rocCLAW's server forwards it over the server-owned WebSocket connection to the gateway
3. The gateway emits runtime events (stream chunks, tool calls, run state changes)
4. rocCLAW's server projects each event into its SQLite outbox
5. The SSE stream `/api/runtime/stream` emits ordered `gateway.event` frames with monotonic outbox IDs
6. The browser renders events as they arrive

## Reconnect and replay

**Reconnect:** If the browser disconnects and reconnects with a `Last-Event-ID` header, the server replays all events after that ID.

**Fresh connect (no `Last-Event-ID`):** The server replays a recent tail window from the outbox so the browser doesn't start completely blank.

Live events and replayed events are sequenced together to avoid gaps and duplicate terminal effects.

## History

For older messages not in the live buffer, rocCLAW fetches paginated history:

```
GET /api/runtime/agents/<agentId>/history?limit=50&beforeOutboxId=<cursor>
```

Returns `{ entries, hasMore, nextBeforeOutboxId }` — newest first. History entries are fed through the same event pipeline as live SSE and deduplicated by outbox ID.

## When the gateway is unavailable

Runtime reads return **degraded responses** — data is served from the SQLite projection if it's available, and the response includes a freshness timestamp. Writes fail immediately with `GATEWAY_UNAVAILABLE`. The UI stays renderable rather than blanking out.
