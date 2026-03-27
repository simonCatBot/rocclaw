# UI Guide

This guide describes what each part of the rocCLAW interface does and how to use it.

---

## Connection screen

On first launch (or when disconnected), rocCLAW shows a full-screen connection panel before any agent data loads.

**Draft-based editing** — URL and token fields are draft-based. Changes are only saved when you click **Save settings**. You can edit, test, and discard without committing.

Available actions:
- **Save settings** — persists the URL and token server-side
- **Test connection** — validates the gateway is reachable without fully connecting
- **Disconnect** — tears down the live runtime

Saved gateway tokens are stored server-side. The browser can see _whether_ a token is stored, but never the token itself.

---

## Agents tab

The sidebar lists all agents from the gateway. Status indicators:

- **●** — agent is running (has an active session)
- **○** — agent is idle (no active session)

**Filter:** All / Running / Idle to narrow the list.

**New Agent** — opens the create modal. Only asks for a name and avatar. After creation, rocCLAW applies permissive defaults (Auto commands, web on, file tools on) and opens the Capabilities sidebar for next-step configuration.

Click an agent to open chat.

---

## Chat panel

The primary workspace when an agent is selected. Header controls:

| Control | What it does |
|---------|-------------|
| **⫶** (Brain) | Opens the Personality sidebar |
| **✎** (Settings) | Opens the full agent settings sidebar |
| **New session** | Ends the current session and starts a fresh conversation context |
| **Model** | Override the default model for this session |
| **Thinking** | `off` / `low` / `medium` / `high` — how much internal reasoning the model exposes |
| **Tool calls** | Toggle tool-use traces in the transcript |
| **Thinking traces** | Toggle the model's internal reasoning steps |
| **Stop run** | Halt the current agent run |

### Send a message
Type in the compose area and press **Send** (or Enter). The agent responds in real time via SSE.

### New session vs. stopping a run
- **New session** resets the conversation context. The agent has no memory of previous sessions.
- **Stop run** halts the current run but keeps the session and transcript intact.

---

## Settings sidebar

Opened from the chat header (settings cog). Four tabs:

### Personality

- **Rename agent** — changes the agent's display name
- Personality files: `SOUL.md`, `AGENTS.md`, `USER.md`, `IDENTITY.md`

The file tabs are intentionally scoped to these four files. All gateway-backed agent files are still persisted — this is a display boundary, not a restriction.

### Capabilities

Direct controls (no role labels):

| Control | Options | What it affects |
|---------|---------|----------------|
| **Run commands** | Off / Ask / Auto | Whether exec commands need approval, run silently, or are disabled |
| **Web access** | Off / On | Whether the agent can use web tools |
| **File tools** | Off / On | Whether the agent can use filesystem tools |

### Automations

Schedules and cron jobs for this agent:

1. **Template** — pick a message template
2. **Task** — define the prompt
3. **Schedule** — enter a cron expression
4. **Review** — confirm and save

Schedules survive gateway restarts. Each can be run immediately or on a timer.

### Advanced

| Control | What it does |
|---------|-------------|
| **Show tool calls** | Display tool-use lines in the transcript |
| **Show thinking** | Display thinking traces in the transcript |
| **Open Full Control UI** | Opens the gateway's own control interface in a new tab |
| **Delete agent** | Removes the agent from the gateway — destructive, requires confirmation |

Session-level controls (model, thinking level) are in the chat header, not here.

---

## System Metrics tab

Live gauges for CPU, memory, GPU, disk, and network. Refreshes automatically. Data is sourced from the machine running rocCLAW — not from the gateway host unless they are the same machine.

---

## Tokens tab

Per-agent token usage. Shows input and output token counts per session.

---

## Troubleshooting within the UI

### Gateway connection lost
 rocCLAW shows a banner and attempts reconnection automatically with exponential back-off. Once reconnected, it replays events from where it left off.

### Agent is offline (○)
The agent has no active session. Send it a message to start a new one. If it doesn't respond, check the gateway is running and the connection is live.

### Pending exec approval card in chat
The agent tried to run a command that requires approval. Click **Allow once**, **Allow always**, or **Deny** to proceed. If you dismiss it without acting, the run pauses until you decide.

### Changes to capabilities aren't taking effect
rocCLAW applies config changes via the gateway. If the gateway is under load, writes may queue. A gateway restart will reset session state and re-sync.
