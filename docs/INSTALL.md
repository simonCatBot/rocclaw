# Install Guide -- rocCLAW on Ubuntu 24.04

This guide walks through installing rocCLAW and the OpenClaw gateway on a fresh Ubuntu 24.04 machine. rocCLAW is a web-based operator dashboard that proxies all communication between your browser and the OpenClaw gateway.

---

## Prerequisites

| Dependency       | Minimum Version | Purpose                                        |
|------------------|-----------------|-------------------------------------------------|
| Node.js          | 20.9.0          | Runtime for Next.js server and build tooling    |
| npm              | (bundled)       | Package manager (ships with Node.js)            |
| build-essential  | any             | C/C++ compiler for native modules (better-sqlite3, ws) |
| python3          | 3.x             | Required by node-gyp during native compilation  |
| git              | any             | Clone the repository (source installs only)     |

---

## Step 1: Install Node.js

### Option A: nvm (recommended)

nvm lets you install and switch between Node.js versions without sudo.

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Load nvm into the current shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install the version pinned in .nvmrc
nvm install 20.9.0
nvm use 20.9.0

# Verify
node --version   # should print v20.9.0 or later
npm --version
```

### Option B: NodeSource apt repository

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node --version   # should print v20.x
```

---

## Step 2: Install Build Dependencies

`better-sqlite3` is a native C++ addon compiled during `npm install`. It requires a C++ toolchain and Python 3.

```bash
sudo apt update
sudo apt install -y build-essential python3
```

If you also plan to clone the repo, install git:

```bash
sudo apt install -y git
```

---

## Step 3: Install rocCLAW

### Option A: npm global (quickest)

Run rocCLAW directly without cloning the repository:

```bash
npx openclaw-rocclaw@latest
```

This downloads the latest published package, compiles native dependencies, and starts the server on `http://localhost:3000`.

### Option B: From source (development)

```bash
git clone https://github.com/simoncatbot/rocclaw.git
cd rocclaw
npm install
npm run dev
```

`npm run dev` automatically repairs native module ABI mismatches on startup (via `verify-native-runtime.mjs --repair`). The dev server runs at `http://localhost:3000` with hot reload.

### Option C: From source (production)

```bash
git clone https://github.com/simoncatbot/rocclaw.git
cd rocclaw
npm install
npm run build
node server/index.js
```

Or use the combined command:

```bash
npm run start   # runs: next build && node server/index.js
```

The production server binds to `127.0.0.1` and `::1` on port 3000 by default. Native modules are verified in check mode on startup -- if they fail, rebuild with `npm run verify:native-runtime:repair`.

---

## Step 4: Install and Start the OpenClaw Gateway

rocCLAW connects to the OpenClaw gateway over WebSocket. Install the gateway separately if it is not already running.

```bash
# Install the OpenClaw CLI (if not already installed)
npm install -g openclaw

# Start the gateway on the default port
openclaw gateway --port 18789
```

The gateway listens on `ws://localhost:18789` by default. For a same-machine setup where both rocCLAW and the gateway run on the same host, no further network configuration is needed.

To verify the gateway is running:

```bash
openclaw status --json
openclaw sessions --json
```

To read the gateway auth token (rocCLAW needs this to connect):

```bash
openclaw config get gateway.auth.token
```

---

## Step 5: Connect rocCLAW to the Gateway

### Method A: Auto-detection (easiest)

If the OpenClaw CLI is installed and the gateway is running on the same machine, rocCLAW automatically detects the gateway URL and auth token from `~/.openclaw/openclaw.json` on startup. No manual configuration is needed.

### Method B: Manual (via the UI)

1. Open `http://localhost:3000` in your browser.
2. Click the **Connection** tab.
3. Enter the gateway URL (e.g., `ws://localhost:18789`).
4. Enter the gateway auth token.
5. Click **Connect**.

Settings are saved to `~/.openclaw/openclaw-rocclaw/settings.json` and persist across restarts.

### Method C: Setup script

The interactive setup script prompts for the gateway URL and token, then writes `settings.json`:

```bash
npm run rocclaw:setup
```

It auto-detects the token from the OpenClaw CLI if available. To overwrite existing settings, add `--force`:

```bash
npm run rocclaw:setup -- --force
```

---

## Remote Access

rocCLAW binds to loopback (`127.0.0.1` / `::1`) by default, so it is not reachable from other machines. Two methods for remote access are documented below: SSH tunnels and Tailscale.

---

### Method A: SSH Tunnels

SSH tunnels are the simplest way to access a remote rocCLAW instance. They require no extra software on the remote host — just an SSH server. All traffic is encrypted through the SSH connection.

#### How it works

```
Your laptop                          Remote server
┌────────────┐   SSH tunnel          ┌─────────────────────┐
│ Browser    │──────────────────────▶│ rocCLAW (:3000)     │
│ :3000      │                       │ Gateway (:18789)    │
└────────────┘                       └─────────────────────┘
```

SSH `-L` (local forwarding) binds a port on your local machine and forwards all traffic through the SSH connection to a port on the remote host.

#### Scenario 1: rocCLAW and gateway on the same remote machine

Forward both ports in a single SSH command:

```bash
ssh -L 3000:127.0.0.1:3000 -L 18789:127.0.0.1:18789 user@remote-host
```

Then open `http://localhost:3000` in your local browser. rocCLAW connects to the gateway via `ws://localhost:18789`, which the tunnel forwards to the remote host.

#### Scenario 2: rocCLAW on one host, gateway on another

Forward each port to its respective host:

```bash
# Terminal 1: Forward rocCLAW
ssh -L 3000:127.0.0.1:3000 user@rocclaw-host

# Terminal 2: Forward the gateway
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Or, if you can reach the gateway host from the rocCLAW host:

```bash
# Single command — forward rocCLAW directly, gateway via jump
ssh -L 3000:127.0.0.1:3000 -L 18789:<gateway-host-ip>:18789 user@rocclaw-host
```

#### Scenario 3: Forward only the gateway (rocCLAW runs locally)

If you run rocCLAW on your local machine and only the gateway is remote:

```bash
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Then set the gateway URL in rocCLAW to `ws://localhost:18789`.

#### SSH flags reference

| Flag | Meaning |
|------|---------|
| `-L local:remote_host:remote` | Forward `local` port to `remote_host:remote` through the SSH connection |
| `-N` | Don't open a shell — just forward ports |
| `-f` | Run in background after authentication |
| `-o ServerAliveInterval=30` | Send a keepalive every 30 seconds to prevent idle disconnects |
| `-o ExitOnForwardFailure=yes` | Exit if the port forward fails (e.g., port already in use) |

**Recommended one-liner** (background, keepalive, fail-fast):

```bash
ssh -f -N \
  -o ServerAliveInterval=30 \
  -o ExitOnForwardFailure=yes \
  -L 3000:127.0.0.1:3000 \
  -L 18789:127.0.0.1:18789 \
  user@remote-host
```

#### Persistent tunnels with autossh

`autossh` monitors the SSH connection and restarts it automatically if it drops. This is essential for long-running setups.

**Install:**

```bash
# Ubuntu / Debian
sudo apt install -y autossh

# macOS
brew install autossh
```

**Run:**

```bash
autossh -M 0 -f -N \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -L 3000:127.0.0.1:3000 \
  -L 18789:127.0.0.1:18789 \
  user@remote-host
```

- `-M 0` disables autossh's built-in monitoring port and relies on SSH's `ServerAliveInterval` instead (recommended for modern OpenSSH).
- `-f` runs in the background after connecting.
- `ServerAliveCountMax=3` means the tunnel restarts after 3 missed keepalives (90 seconds).

#### Persistent tunnels with systemd

For a tunnel that starts on boot and restarts on failure, create a systemd user service:

```bash
mkdir -p ~/.config/systemd/user
```

Create `~/.config/systemd/user/rocclaw-tunnel.service`:

```ini
[Unit]
Description=SSH tunnel to rocCLAW and OpenClaw gateway
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/ssh -N \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -L 3000:127.0.0.1:3000 \
  -L 18789:127.0.0.1:18789 \
  user@remote-host
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable rocclaw-tunnel
systemctl --user start rocclaw-tunnel

# Check status
systemctl --user status rocclaw-tunnel

# View logs
journalctl --user -u rocclaw-tunnel -f
```

> **Note**: For systemd services, SSH key-based authentication is required (no interactive password prompts). See the next section.

#### SSH key-based authentication

Password prompts don't work with background tunnels. Set up key-based auth:

```bash
# Generate a key (if you don't have one)
ssh-keygen -t ed25519 -C "rocclaw-tunnel"

# Copy the public key to the remote host
ssh-copy-id user@remote-host

# Test — should connect without a password prompt
ssh -o BatchMode=yes user@remote-host echo "Key auth works"
```

#### Stopping SSH tunnels

```bash
# Find the tunnel process
ps aux | grep 'ssh.*-L.*3000'

# Kill by PID
kill <pid>

# Or kill all SSH tunnels to a specific host
pkill -f 'ssh.*remote-host'

# If using systemd
systemctl --user stop rocclaw-tunnel
```

---

### Method B: Tailscale

Tailscale is a mesh VPN built on WireGuard that gives every device a stable DNS name and encrypted connectivity. It requires no port forwarding, no firewall rules, and no SSH tunnels. Tailscale is optional but recommended for teams or multi-device setups.

#### How it works

```
Your laptop                    Tailscale network                Remote server
┌────────────┐                                                  ┌─────────────────────┐
│ Browser    │◀──── encrypted WireGuard tunnel ────────────────▶│ rocCLAW (:3000)     │
│            │    my-server.tailnet-name.ts.net                  │ Gateway (:18789)    │
└────────────┘                                                  └─────────────────────┘
```

Every machine on the tailnet gets a DNS name like `my-server.tailnet-name.ts.net` and a stable 100.x.x.x IP address.

#### Step 1: Install Tailscale

Install on **every machine** that needs to communicate (your laptop, the rocCLAW host, the gateway host):

```bash
# Ubuntu / Debian
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# macOS
brew install --cask tailscale
# Then open Tailscale from Applications and sign in

# Other Linux
# See https://tailscale.com/download/linux
```

After `tailscale up`, it opens a browser to authenticate with your Tailscale account (Google, Microsoft, GitHub, etc.).

#### Step 2: Verify connectivity

```bash
# Check your tailnet status
tailscale status

# Example output:
# 100.64.0.1   my-laptop        yourname@  linux  -
# 100.64.0.2   gpu-server       yourname@  linux  -

# Ping another device by tailnet name
tailscale ping gpu-server
```

#### Step 3: Expose rocCLAW with Tailscale Serve

Tailscale Serve lets you expose a local service over HTTPS on your tailnet with automatic TLS certificates.

On the **rocCLAW host**:

```bash
# Expose rocCLAW (port 3000) over HTTPS on port 443
tailscale serve --bg --https 443 http://127.0.0.1:3000

# Verify it's serving
tailscale serve status
```

Then open `https://<rocclaw-host>.tailnet-name.ts.net` from any device on your tailnet.

#### Step 4: Expose the gateway (if on a different machine)

If the OpenClaw gateway runs on a different machine:

On the **gateway host**:

```bash
# Expose the gateway WebSocket port
tailscale serve --bg --tcp 18789 tcp://127.0.0.1:18789
```

Then set the gateway URL in rocCLAW to:

```
wss://<gateway-host>.tailnet-name.ts.net
```

> **Note**: When using Tailscale Serve with HTTPS, use `wss://` (secure WebSocket) instead of `ws://`.

#### Step 5: Find your tailnet DNS name

```bash
# Full DNS name
tailscale status --json | jq -r '.Self.DNSName'

# Or just the hostname part
tailscale status --json | jq -r '.Self.HostName'
```

The DNS name format is: `<hostname>.<tailnet-name>.ts.net`

#### Access Control Lists (ACLs)

By default, all devices on your tailnet can reach each other. For tighter security, use Tailscale ACLs to restrict which devices can access rocCLAW:

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/acls)
2. Add rules like:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:admin"],
      "dst": ["tag:rocclaw:3000", "tag:rocclaw:18789"]
    }
  ],
  "tagOwners": {
    "tag:admin": ["yourname@example.com"],
    "tag:rocclaw": ["yourname@example.com"]
  }
}
```

3. Tag your devices:

```bash
# On the rocCLAW host
sudo tailscale up --advertise-tags=tag:rocclaw
```

#### Tailscale + same-machine setup

If both rocCLAW and the gateway are on the same machine and you only need Tailscale for remote access to the rocCLAW UI:

```bash
# Only expose rocCLAW — the gateway stays on localhost
tailscale serve --bg --https 443 http://127.0.0.1:3000
```

Set the gateway URL in rocCLAW to `ws://localhost:18789` (no Tailscale needed for the gateway connection since they're on the same host).

#### Stopping Tailscale Serve

```bash
# Remove a specific serve rule
tailscale serve --https 443 off

# Remove all serve rules
tailscale serve reset

# Check what's being served
tailscale serve status
```

#### Tailscale troubleshooting

| Problem | Fix |
|---------|-----|
| `tailscale up` hangs | Check if a firewall blocks UDP 41641. Tailscale uses WireGuard which needs UDP connectivity. |
| DNS name not resolving | Run `tailscale status` to verify the device is online. Check that MagicDNS is enabled in the admin console. |
| `wss://` connection fails | Ensure you're using `wss://` (not `ws://`) when connecting through Tailscale Serve HTTPS. |
| Certificate errors | Tailscale auto-provisions Let's Encrypt certs. Wait a minute after `tailscale serve` and retry. |
| Can't reach device | Check ACLs in the admin console. Default policy allows all traffic, but custom ACLs may block it. |

---

### Choosing between SSH and Tailscale

| Factor | SSH tunnels | Tailscale |
|--------|-------------|-----------|
| **Setup effort** | None (SSH is already available) | Install on each device + sign in |
| **Extra software** | None (autossh optional) | Tailscale client on every device |
| **DNS names** | No — use IP addresses | Yes — stable `*.ts.net` names |
| **TLS/HTTPS** | No — HTTP over tunnel | Yes — automatic certificates |
| **Multi-device** | One tunnel per device | All devices on the tailnet connect directly |
| **Firewall/NAT** | Requires SSH access (port 22) | Works through most NATs without port forwarding |
| **Persistence** | Manual (autossh/systemd) | Automatic (daemon runs on boot) |
| **Best for** | Single user, existing SSH access | Teams, multiple devices, long-term setups |

---

## Environment Variables

| Variable                              | Default              | Description                                                  |
|---------------------------------------|----------------------|--------------------------------------------------------------|
| `PORT`                                | `3000`               | HTTP port for the rocCLAW server                             |
| `HOST`                                | `127.0.0.1`          | Bind address. Set to `0.0.0.0` for LAN access (requires `ROCCLAW_ACCESS_TOKEN`) |
| `ROCCLAW_ACCESS_TOKEN`                | (none)               | Cookie-based access token. Required when binding to a public/non-loopback address |
| `NEXT_PUBLIC_GATEWAY_URL`             | `ws://127.0.0.1:18789` | Default gateway URL when no saved settings exist            |
| `OPENCLAW_STATE_DIR`                  | `~/.openclaw`        | Override the base directory for all OpenClaw/rocCLAW state   |
| `OPENCLAW_SKIP_NATIVE_RUNTIME_VERIFY` | (unset)             | Set to `1` to skip the native module ABI check on startup    |

To set these, either export them in your shell or create a `.env` file in the project root (see `.env.example`).

---

## Files and Directories

rocCLAW creates these paths automatically on first run. All paths are relative to the state directory (`~/.openclaw` by default).

| Path                                         | Purpose                                                      |
|----------------------------------------------|--------------------------------------------------------------|
| `~/.openclaw/openclaw-rocclaw/settings.json`  | Gateway URL, token, and UI preferences                       |
| `~/.openclaw/openclaw-rocclaw/device.json`    | Ed25519 keypair for gateway authentication (file mode `0600`) |
| `~/.openclaw/openclaw-rocclaw/state.db`       | SQLite database (WAL mode) for event projection and outbox   |
| `~/.openclaw/openclaw.json`                   | Shared OpenClaw config (gateway port, auth token). Written by the OpenClaw CLI, read by rocCLAW for auto-detection |

---

## Troubleshooting

### 1. Wrong Node.js version

**Symptom**: Startup crashes or `npm install` fails with syntax errors.

**Fix**: rocCLAW requires Node.js 20.9.0 or later. Check with `node --version`. If using nvm:

```bash
nvm install 20.9.0
nvm use 20.9.0
```

### 2. Missing build-essential

**Symptom**: `npm install` fails with errors like `gyp ERR! build error` or `make: not found`.

**Fix**:

```bash
sudo apt install -y build-essential python3
rm -rf node_modules
npm install
```

### 3. Native module ABI mismatch

**Symptom**: Error on startup: `The module was compiled against a different Node.js version` or `NODE_MODULE_VERSION mismatch`.

This happens when you switch Node.js versions after `npm install`.

**Fix**:

```bash
npm run verify:native-runtime:repair
```

Or manually rebuild:

```bash
rm -rf node_modules
npm install
```

### 4. No gateway running

**Symptom**: rocCLAW loads but shows "Disconnected" or "Connection failed" in the UI.

**Fix**: Start the gateway:

```bash
openclaw gateway --port 18789
```

Verify it is running:

```bash
openclaw status --json
```

### 5. Missing gateway token

**Symptom**: rocCLAW connects but the gateway rejects the handshake.

**Fix**: The gateway requires an auth token. Retrieve it and enter it in the Connection tab:

```bash
openclaw config get gateway.auth.token
```

Or re-run the setup script:

```bash
npm run rocclaw:setup -- --force
```

### 6. Device identity error

**Symptom**: Errors mentioning Ed25519, device identity, or challenge-response signing.

**Fix**: Delete the device keypair file and restart. rocCLAW generates a new one automatically:

```bash
rm ~/.openclaw/openclaw-rocclaw/device.json
```

Ensure the directory has correct permissions:

```bash
ls -la ~/.openclaw/openclaw-rocclaw/device.json
# Should show -rw------- (0600)
```

### 7. Port already in use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`.

**Fix**: Either stop the other process using port 3000, or start rocCLAW on a different port:

```bash
PORT=3001 npm run dev
```

### 8. LAN IP in gateway URL

**Symptom**: rocCLAW is on the same machine as the gateway, but the gateway URL is set to a LAN IP (e.g., `ws://192.168.1.50:18789`) and connections fail or are slow.

**Fix**: When both services are on the same machine, always use `ws://localhost:18789` or `ws://127.0.0.1:18789`. The gateway typically binds to loopback only.

### 9. Public binding without access token

**Symptom**: Server refuses to start with the error: `Refusing to bind ROCclaw to public host "0.0.0.0" without ROCCLAW_ACCESS_TOKEN`.

**Fix**: When binding to a non-loopback address (e.g., `HOST=0.0.0.0`), you must set an access token:

```bash
ROCCLAW_ACCESS_TOKEN=your-secret-token HOST=0.0.0.0 npm run dev
```

Then open the dashboard once with the token in the URL to set the auth cookie:

```
http://<your-ip>:3000/?access_token=your-secret-token
```
