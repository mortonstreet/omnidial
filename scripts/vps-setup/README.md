# VPS Setup for OmniDial

Automated setup script for Hetzner CCX VPS with OpenClaw, xRDP, and Tailscale.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Hetzner CCX23 (Ashburn, VA) - Ubuntu 22.04                 │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  OpenClaw   │  │   Backend   │  │  xRDP + Xfce        │ │
│  │   :3100     │  │    :3001    │  │  Chrome + Claude    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  PostgreSQL :5432    Docker    PM2/systemd                 │
│                                                             │
│  Tailscale: 100.x.x.x (private network)                    │
│  Firewall: Only SSH (22) + Tailscale traffic               │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Hetzner Cloud Account** - https://console.hetzner.cloud
2. **Tailscale Account** - https://tailscale.com (free tier works)
3. **SSH Key** - Add to Hetzner before creating server

## Quick Start

### 1. Create Hetzner Server

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Create Project → "omnidial-infra"
3. Add Server:
   - **Location**: Ashburn, VA (us-east)
   - **Image**: Ubuntu 22.04
   - **Type**: CCX23 (4 vCPU, 16GB RAM, 160GB NVMe) ~€35/mo
   - **SSH Key**: Select your key
   - **Name**: `openclaw-vps`
4. Note the public IP address

### 2. Run Setup Script

SSH into your new server and run:

```bash
# One-liner install
curl -fsSL https://raw.githubusercontent.com/mortonstreet/omnidial/main/scripts/vps-setup/setup.sh | sudo bash

# Or clone and run
git clone https://github.com/mortonstreet/omnidial.git
cd omnidial/scripts/vps-setup
chmod +x setup.sh
sudo ./setup.sh
```

The script will:
1. Update system and install dependencies
2. Create `deploy` user
3. Install and configure Tailscale (prompts for auth)
4. Install Docker, Node.js 20, PostgreSQL
5. Install xRDP + Xfce desktop
6. Install Google Chrome
7. Clone and configure OpenClaw
8. Configure firewall (SSH + Tailscale only)
9. Create systemd service for backend

### 3. Configure API Keys

After setup, add your LLM API keys:

```bash
sudo -u deploy nano /home/deploy/apps/openclaw/.env
```

Add:
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
```

Restart OpenClaw:
```bash
cd /home/deploy/apps/openclaw
docker compose restart
```

### 4. Deploy Backend

```bash
# Switch to deploy user
sudo -u deploy -i

# Clone repo (if not already done)
cd ~/apps
git clone https://github.com/mortonstreet/omnidial.git
cd omnidial

# Install and build
pnpm install
pnpm build

# Configure backend .env
cp backend/.env.example backend/.env
nano backend/.env
# Set DATABASE_URL, OPENCLAW_API_KEY, etc.

# Start backend
sudo systemctl enable omnidial-backend
sudo systemctl start omnidial-backend

# Check logs
journalctl -u omnidial-backend -f
```

## Connecting

### From Your Mac

1. **Install Tailscale** on your Mac:
   ```bash
   brew install tailscale
   # Or download from https://tailscale.com/download/mac
   ```

2. **Authenticate** with the same Tailscale account used on the server

3. **Connect via SSH**:
   ```bash
   ssh deploy@100.x.x.x  # Your server's Tailscale IP
   ```

4. **Connect via RDP** (for desktop/Chrome):
   - Install "Windows App" from Mac App Store
   - Add PC: `100.x.x.x` (Tailscale IP)
   - User: `deploy`
   - Connect and enter password

### Test OpenClaw

```bash
# From your Mac (via Tailscale)
curl http://100.x.x.x:3100/api/health

# Expected response:
# {"status":"healthy","version":"x.x.x",...}
```

## Environment Variables

### OpenClaw (`/home/deploy/apps/openclaw/.env`)

```bash
OPENCLAW_PORT=3100
OPENCLAW_HOST=0.0.0.0
DATABASE_URL=file:./data/openclaw.db
OPENCLAW_API_KEY=oc_xxxxxxxxxxxx  # Auto-generated
ANTHROPIC_API_KEY=sk-ant-xxxxx    # Add yours
OPENAI_API_KEY=sk-xxxxx           # Add yours
MEMORY_ENABLED=true
```

### Backend (`/home/deploy/apps/omnidial/backend/.env`)

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://omnidial:omnidial_password_change_me@localhost:5432/omnidial
OPENCLAW_API_URL=http://127.0.0.1:3100
OPENCLAW_API_KEY=oc_xxxxxxxxxxxx  # From OpenClaw setup
# ... other env vars
```

## Service Management

| Service | Start | Stop | Logs |
|---------|-------|------|------|
| OpenClaw | `cd ~/apps/openclaw && docker compose up -d` | `docker compose down` | `docker compose logs -f` |
| Backend | `sudo systemctl start omnidial-backend` | `sudo systemctl stop omnidial-backend` | `journalctl -u omnidial-backend -f` |
| xRDP | `sudo systemctl start xrdp` | `sudo systemctl stop xrdp` | `journalctl -u xrdp -f` |
| PostgreSQL | `sudo systemctl start postgresql` | `sudo systemctl stop postgresql` | `journalctl -u postgresql -f` |

## Security Notes

1. **All services bind to Tailscale IP** - Not accessible from public internet
2. **Firewall rules**:
   - Port 22 (SSH): Open (consider restricting to Tailscale only)
   - Tailscale interface: All traffic allowed
   - Everything else: Blocked
3. **Credentials**:
   - Change PostgreSQL password in production
   - Keep OpenClaw API key secure
   - Use strong RDP password

## Troubleshooting

### Tailscale not connecting
```bash
sudo tailscale status
sudo tailscale up --reset
```

### OpenClaw not starting
```bash
cd /home/deploy/apps/openclaw
docker compose logs
docker compose down && docker compose up -d
```

### xRDP black screen
```bash
# Reinstall xfce session
sudo apt install --reinstall xfce4-session
sudo systemctl restart xrdp
```

### Can't connect via RDP
```bash
# Check xRDP is running
sudo systemctl status xrdp

# Check it's bound to Tailscale IP
sudo netstat -tlnp | grep 3389

# Check firewall
sudo ufw status
```

## Scaling Up

If you need more resources:

1. **Resize in Hetzner Console**: Servers → Select → Resize
2. **Or migrate to dedicated**: AX-LINE for better long-term value

## Cost Estimate

| Component | Monthly Cost |
|-----------|--------------|
| Hetzner CCX23 | ~€35 |
| Tailscale | Free (personal) |
| Total | ~€35/mo (~$38 USD) |
