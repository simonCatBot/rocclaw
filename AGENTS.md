# 🎭 Agent Instructions for rocCLAW

Guidelines for AI agents working on this repository.

---

## 🎯 Scope Definition

### ✅ This Repository IS...

- **A Frontend Dashboard** — Web UI for managing OpenClaw agents
- **Built with Next.js + React** — TypeScript, Tailwind CSS
- **A Server-Side Proxy** — Browser never connects directly to gateway

### ❌ This Repository is NOT...

- The OpenClaw gateway itself
- AI runtime or model infrastructure
- A standalone agent platform

**Need to modify the gateway?** → Work with `~/openclaw` source code

---

## 🔍 Context Understanding

### When Implementing Changes

1. **Search OpenClaw source code** to understand full context
2. **Apply changes to rocCLAW** (this repository)
3. **Keep solutions frontend-focused**

**Example:**
- User asks for "better error handling"
- You implement it in `src/features/agents/operations/`
- You DON'T modify `~/openclaw/gateway/*`

---

## 📝 Coding Guidelines

### Do

✅ Write clean, typed TypeScript  
✅ Follow existing patterns in `src/features/agents/operations/`  
✅ Use the workflow pattern for complex operations  
✅ Add tests for new functionality  
✅ Update documentation when behavior changes  

### Don't

❌ Modify OpenClaw gateway source code  
❌ Commit environment-specific configs  
❌ Include secrets or tokens  
❌ Break existing API contracts  

---

## 🔒 Security

- **Never commit:** Tokens, passwords, SSH keys
- **Never expose:** Gateway credentials in browser code
- **Always redact:** Tokens in logs and responses

---

## 📚 Reference Materials

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and setup |
| `ARCHITECTURE.md` | Technical deep-dive |
| `CONTRIBUTING.md` | Development guide |
| `docs/ui-guide.md` | Interface documentation |
| `docs/permissions-sandboxing.md` | Security model |

---

## 🏗️ Architecture Reminders

```
Browser ──HTTP/SSE──► rocCLAW Server ──WebSocket──► OpenClaw Gateway
                      (This Repo)                      (~/openclaw)
```

**Key files:**
- `src/app/api/` — API routes
- `src/features/agents/` — Agent management
- `src/lib/controlplane/` — Gateway communication

---

## 🧪 Testing

Before considering work complete:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## 💬 Questions?

Check the documentation in `docs/` or ask for clarification.

Remember: **This is a UI project.** Gateway changes happen elsewhere.
