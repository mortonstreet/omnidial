#!/bin/bash
#
# OmniDial VPS Setup Script
# Sets up Hetzner CCX with OpenClaw, xRDP, Tailscale, and backend
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mortonstreet/omnidial/main/scripts/vps-setup/setup.sh | bash
#   OR
#   ./setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/var/log/omnidial-setup.log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Banner
echo -e "${BLUE}"
cat << 'EOF'
   ___                  _ ____  _       _
  / _ \ _ __ ___  _ __ (_)  _ \(_) __ _| |
 | | | | '_ ` _ \| '_ \| | | | | |/ _` | |
 | |_| | | | | | | | | | | |_| | | (_| | |
  \___/|_| |_| |_|_| |_|_|____/|_|\__,_|_|

  VPS Setup Script - OpenClaw + xRDP + Tailscale
EOF
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root"
   exit 1
fi

# Configuration (can be overridden via environment variables)
DEPLOY_USER="${DEPLOY_USER:-deploy}"
TIMEZONE="${TIMEZONE:-America/New_York}"
OPENCLAW_PORT="${OPENCLAW_PORT:-3100}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
NODE_VERSION="${NODE_VERSION:-20}"

# ============================================
# Step 1: System Update & Basic Setup
# ============================================
setup_system() {
    log_info "Step 1: Updating system and installing basics..."

    apt update && apt upgrade -y
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        htop \
        vim \
        nano \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw

    # Set timezone
    timedatectl set-timezone "$TIMEZONE"

    log_success "System updated and basics installed"
}

# ============================================
# Step 2: Create Deploy User
# ============================================
setup_user() {
    log_info "Step 2: Setting up deploy user..."

    if id "$DEPLOY_USER" &>/dev/null; then
        log_warn "User $DEPLOY_USER already exists, skipping creation"
    else
        adduser --disabled-password --gecos "" "$DEPLOY_USER"
        usermod -aG sudo "$DEPLOY_USER"

        # Allow sudo without password for deploy user
        echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
        chmod 440 /etc/sudoers.d/$DEPLOY_USER
    fi

    # Copy SSH keys if they exist
    if [[ -f /root/.ssh/authorized_keys ]]; then
        mkdir -p /home/$DEPLOY_USER/.ssh
        cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
        chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
        chmod 700 /home/$DEPLOY_USER/.ssh
        chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    fi

    log_success "Deploy user configured"
}

# ============================================
# Step 3: Install Tailscale
# ============================================
setup_tailscale() {
    log_info "Step 3: Installing Tailscale..."

    if command -v tailscale &>/dev/null; then
        log_warn "Tailscale already installed"
    else
        curl -fsSL https://tailscale.com/install.sh | sh
    fi

    systemctl enable tailscaled
    systemctl start tailscaled

    # Check if already authenticated
    if tailscale status &>/dev/null; then
        TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "not-connected")
        log_success "Tailscale already authenticated. IP: $TAILSCALE_IP"
    else
        log_warn "Tailscale installed but not authenticated"
        echo ""
        echo -e "${YELLOW}Run this command to authenticate Tailscale:${NC}"
        echo -e "${GREEN}  sudo tailscale up${NC}"
        echo ""
        read -p "Press Enter after authenticating Tailscale..."
        TAILSCALE_IP=$(tailscale ip -4)
        log_success "Tailscale connected. IP: $TAILSCALE_IP"
    fi

    # Save Tailscale IP for later use
    echo "$TAILSCALE_IP" > /tmp/tailscale_ip
}

# ============================================
# Step 4: Install Docker
# ============================================
setup_docker() {
    log_info "Step 4: Installing Docker..."

    if command -v docker &>/dev/null; then
        log_warn "Docker already installed"
    else
        curl -fsSL https://get.docker.com | sh
    fi

    # Add deploy user to docker group
    usermod -aG docker $DEPLOY_USER

    # Install Docker Compose plugin
    apt install -y docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    log_success "Docker installed and configured"
}

# ============================================
# Step 5: Install Node.js
# ============================================
setup_nodejs() {
    log_info "Step 5: Installing Node.js $NODE_VERSION..."

    if command -v node &>/dev/null; then
        CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_VERSION" -ge "$NODE_VERSION" ]]; then
            log_warn "Node.js $CURRENT_VERSION already installed"
            return
        fi
    fi

    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs

    # Install pnpm globally
    npm install -g pnpm pm2

    log_success "Node.js $(node -v) installed with pnpm and pm2"
}

# ============================================
# Step 6: Install PostgreSQL
# ============================================
setup_postgresql() {
    log_info "Step 6: Installing PostgreSQL..."

    if command -v psql &>/dev/null; then
        log_warn "PostgreSQL already installed"
    else
        apt install -y postgresql postgresql-contrib
    fi

    systemctl enable postgresql
    systemctl start postgresql

    # Create database and user
    sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='omnidial'" | grep -q 1 || {
        sudo -u postgres psql << EOF
CREATE USER omnidial WITH PASSWORD 'omnidial_password_change_me';
CREATE DATABASE omnidial OWNER omnidial;
GRANT ALL PRIVILEGES ON DATABASE omnidial TO omnidial;
EOF
        log_info "Created PostgreSQL user and database"
    }

    log_success "PostgreSQL configured"
}

# ============================================
# Step 7: Install xRDP + Xfce
# ============================================
setup_xrdp() {
    log_info "Step 7: Installing xRDP and Xfce desktop..."

    # Install Xfce (lightweight desktop)
    DEBIAN_FRONTEND=noninteractive apt install -y \
        xfce4 \
        xfce4-goodies \
        xfce4-terminal \
        dbus-x11

    # Install xRDP
    apt install -y xrdp

    # Configure xRDP to use Xfce
    cat > /home/$DEPLOY_USER/.xsession << 'EOF'
xfce4-session
EOF
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.xsession

    # Fix xRDP session script
    cat > /etc/xrdp/startwm.sh << 'EOF'
#!/bin/sh
if [ -r /etc/default/locale ]; then
  . /etc/default/locale
  export LANG LANGUAGE
fi
startxfce4
EOF
    chmod +x /etc/xrdp/startwm.sh

    # Configure xRDP to bind to Tailscale IP only
    TAILSCALE_IP=$(cat /tmp/tailscale_ip 2>/dev/null || echo "0.0.0.0")
    if [[ "$TAILSCALE_IP" != "0.0.0.0" && "$TAILSCALE_IP" != "not-connected" ]]; then
        sed -i "s/^address=.*/address=$TAILSCALE_IP/" /etc/xrdp/xrdp.ini
        log_info "xRDP bound to Tailscale IP: $TAILSCALE_IP"
    else
        log_warn "Tailscale IP not available, xRDP will listen on all interfaces"
    fi

    # Add deploy user to required groups
    usermod -aG ssl-cert $DEPLOY_USER

    systemctl enable xrdp
    systemctl restart xrdp

    # Set password for RDP login
    echo ""
    echo -e "${YELLOW}Set password for RDP login (user: $DEPLOY_USER):${NC}"
    passwd $DEPLOY_USER

    log_success "xRDP and Xfce installed"
}

# ============================================
# Step 8: Install Chrome
# ============================================
setup_chrome() {
    log_info "Step 8: Installing Google Chrome..."

    if command -v google-chrome &>/dev/null; then
        log_warn "Chrome already installed"
        return
    fi

    wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    apt install -y ./google-chrome-stable_current_amd64.deb
    rm -f google-chrome-stable_current_amd64.deb

    log_success "Google Chrome installed"
}

# ============================================
# Step 9: Setup OpenClaw
# ============================================
setup_openclaw() {
    log_info "Step 9: Setting up OpenClaw..."

    APPS_DIR="/home/$DEPLOY_USER/apps"
    mkdir -p $APPS_DIR
    chown $DEPLOY_USER:$DEPLOY_USER $APPS_DIR

    OPENCLAW_DIR="$APPS_DIR/openclaw"

    if [[ -d "$OPENCLAW_DIR" ]]; then
        log_warn "OpenClaw directory exists, updating..."
        cd $OPENCLAW_DIR
        sudo -u $DEPLOY_USER git pull || true
    else
        cd $APPS_DIR
        sudo -u $DEPLOY_USER git clone https://github.com/openclaw/openclaw.git
    fi

    cd $OPENCLAW_DIR

    # Create data directory
    mkdir -p data
    chown -R $DEPLOY_USER:$DEPLOY_USER data

    # Generate API key
    OPENCLAW_API_KEY="oc_$(openssl rand -hex 24)"

    # Create .env file
    cat > .env << EOF
# OpenClaw Configuration
OPENCLAW_PORT=$OPENCLAW_PORT
OPENCLAW_HOST=0.0.0.0

# Database
DATABASE_URL=file:./data/openclaw.db

# API Key
OPENCLAW_API_KEY=$OPENCLAW_API_KEY

# LLM Providers (add your keys)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Memory
DATA_DIR=./data
MEMORY_ENABLED=true
EOF

    chown $DEPLOY_USER:$DEPLOY_USER .env

    # Update docker-compose to bind to Tailscale IP
    TAILSCALE_IP=$(cat /tmp/tailscale_ip 2>/dev/null || echo "0.0.0.0")
    if [[ "$TAILSCALE_IP" != "0.0.0.0" && "$TAILSCALE_IP" != "not-connected" ]]; then
        # If docker-compose.yml exists, update port binding
        if [[ -f docker-compose.yml ]]; then
            sed -i "s/\"$OPENCLAW_PORT:$OPENCLAW_PORT\"/\"$TAILSCALE_IP:$OPENCLAW_PORT:$OPENCLAW_PORT\"/" docker-compose.yml
        fi
    fi

    # Start OpenClaw
    sudo -u $DEPLOY_USER docker compose up -d || log_warn "OpenClaw docker-compose failed - may need manual setup"

    # Save API key for reference
    echo "$OPENCLAW_API_KEY" > /home/$DEPLOY_USER/.openclaw_api_key
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.openclaw_api_key
    chmod 600 /home/$DEPLOY_USER/.openclaw_api_key

    log_success "OpenClaw configured"
    echo -e "${GREEN}OpenClaw API Key saved to: /home/$DEPLOY_USER/.openclaw_api_key${NC}"
}

# ============================================
# Step 10: Setup Firewall
# ============================================
setup_firewall() {
    log_info "Step 10: Configuring firewall..."

    # Reset UFW
    ufw --force reset

    # Default policies
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH (public)
    ufw allow 22/tcp

    # Allow all traffic on Tailscale interface
    ufw allow in on tailscale0

    # Enable firewall
    ufw --force enable

    log_success "Firewall configured - only SSH (22) and Tailscale traffic allowed"
}

# ============================================
# Step 11: Create OmniDial Backend Service
# ============================================
setup_backend_service() {
    log_info "Step 11: Creating backend systemd service..."

    TAILSCALE_IP=$(cat /tmp/tailscale_ip 2>/dev/null || echo "127.0.0.1")

    cat > /etc/systemd/system/omnidial-backend.service << EOF
[Unit]
Description=OmniDial Backend
After=network.target postgresql.service

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=/home/$DEPLOY_USER/apps/omnidial/backend
Environment=NODE_ENV=production
Environment=PORT=$BACKEND_PORT
Environment=OPENCLAW_API_URL=http://127.0.0.1:$OPENCLAW_PORT
ExecStart=/usr/bin/node dist/server.mjs
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload

    log_success "Backend systemd service created (not started - clone repo first)"
}

# ============================================
# Step 12: Print Summary
# ============================================
print_summary() {
    TAILSCALE_IP=$(cat /tmp/tailscale_ip 2>/dev/null || echo "not-connected")
    OPENCLAW_API_KEY=$(cat /home/$DEPLOY_USER/.openclaw_api_key 2>/dev/null || echo "not-generated")

    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${BLUE}Server Information:${NC}"
    echo -e "  Tailscale IP:     ${GREEN}$TAILSCALE_IP${NC}"
    echo -e "  Deploy User:      ${GREEN}$DEPLOY_USER${NC}"
    echo -e "  OpenClaw Port:    ${GREEN}$OPENCLAW_PORT${NC}"
    echo -e "  Backend Port:     ${GREEN}$BACKEND_PORT${NC}"
    echo ""
    echo -e "${BLUE}OpenClaw API Key:${NC}"
    echo -e "  ${GREEN}$OPENCLAW_API_KEY${NC}"
    echo ""
    echo -e "${BLUE}Connection Commands:${NC}"
    echo -e "  SSH:  ${GREEN}ssh $DEPLOY_USER@$TAILSCALE_IP${NC}"
    echo -e "  RDP:  ${GREEN}Connect to $TAILSCALE_IP:3389${NC} (Windows App on Mac)"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Add your API keys to ${GREEN}/home/$DEPLOY_USER/apps/openclaw/.env${NC}"
    echo -e "     - ANTHROPIC_API_KEY"
    echo -e "     - OPENAI_API_KEY"
    echo ""
    echo -e "  2. Clone OmniDial repo:"
    echo -e "     ${GREEN}cd /home/$DEPLOY_USER/apps${NC}"
    echo -e "     ${GREEN}git clone https://github.com/mortonstreet/omnidial.git${NC}"
    echo ""
    echo -e "  3. Configure backend .env and start:"
    echo -e "     ${GREEN}cd omnidial && pnpm install && pnpm build${NC}"
    echo -e "     ${GREEN}sudo systemctl enable omnidial-backend${NC}"
    echo -e "     ${GREEN}sudo systemctl start omnidial-backend${NC}"
    echo ""
    echo -e "${BLUE}Service Commands:${NC}"
    echo -e "  OpenClaw logs:    ${GREEN}docker compose -f /home/$DEPLOY_USER/apps/openclaw/docker-compose.yml logs -f${NC}"
    echo -e "  Backend logs:     ${GREEN}journalctl -u omnidial-backend -f${NC}"
    echo -e "  xRDP status:      ${GREEN}systemctl status xrdp${NC}"
    echo ""
    echo -e "${YELLOW}Log file: $LOG_FILE${NC}"
    echo ""
}

# ============================================
# Main Execution
# ============================================
main() {
    log_info "Starting OmniDial VPS setup..."
    echo ""

    setup_system
    setup_user
    setup_tailscale
    setup_docker
    setup_nodejs
    setup_postgresql
    setup_xrdp
    setup_chrome
    setup_openclaw
    setup_firewall
    setup_backend_service

    print_summary
}

# Run main function
main "$@"
