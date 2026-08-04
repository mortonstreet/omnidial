#!/bin/bash
#
# OmniDial VPS Management Script
# Quick commands for managing services
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DEPLOY_USER="${DEPLOY_USER:-deploy}"
OPENCLAW_DIR="/home/$DEPLOY_USER/apps/openclaw"
BACKEND_DIR="/home/$DEPLOY_USER/apps/omnidial"

show_help() {
    echo -e "${BLUE}OmniDial VPS Management${NC}"
    echo ""
    echo "Usage: ./manage.sh <command>"
    echo ""
    echo "Commands:"
    echo "  status          Show status of all services"
    echo "  logs            Tail all service logs"
    echo ""
    echo "  openclaw-start  Start OpenClaw"
    echo "  openclaw-stop   Stop OpenClaw"
    echo "  openclaw-logs   Tail OpenClaw logs"
    echo "  openclaw-restart Restart OpenClaw"
    echo ""
    echo "  backend-start   Start backend"
    echo "  backend-stop    Stop backend"
    echo "  backend-logs    Tail backend logs"
    echo "  backend-restart Restart backend"
    echo "  backend-deploy  Pull latest and restart"
    echo ""
    echo "  xrdp-start      Start xRDP"
    echo "  xrdp-stop       Stop xRDP"
    echo "  xrdp-restart    Restart xRDP"
    echo ""
    echo "  tailscale-status Show Tailscale status"
    echo "  tailscale-ip     Show Tailscale IP"
    echo ""
    echo "  update          Update system packages"
    echo "  cleanup         Clean Docker/apt cache"
}

status() {
    echo -e "${BLUE}=== Service Status ===${NC}"
    echo ""

    echo -e "${GREEN}Tailscale:${NC}"
    tailscale status 2>/dev/null || echo "  Not connected"
    echo ""

    echo -e "${GREEN}OpenClaw:${NC}"
    if docker compose -f $OPENCLAW_DIR/docker-compose.yml ps 2>/dev/null | grep -q "Up"; then
        echo "  Running"
        docker compose -f $OPENCLAW_DIR/docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}"
    else
        echo "  Not running"
    fi
    echo ""

    echo -e "${GREEN}Backend:${NC}"
    systemctl is-active omnidial-backend 2>/dev/null || echo "  Not running"
    echo ""

    echo -e "${GREEN}xRDP:${NC}"
    systemctl is-active xrdp 2>/dev/null || echo "  Not running"
    echo ""

    echo -e "${GREEN}PostgreSQL:${NC}"
    systemctl is-active postgresql 2>/dev/null || echo "  Not running"
    echo ""
}

logs() {
    echo -e "${BLUE}Tailing all logs (Ctrl+C to stop)...${NC}"
    echo ""

    # Use multitail if available, otherwise just tail backend
    if command -v multitail &>/dev/null; then
        multitail -ci green -l "docker compose -f $OPENCLAW_DIR/docker-compose.yml logs -f" \
                  -ci blue -l "journalctl -u omnidial-backend -f"
    else
        echo "Install multitail for combined logs: sudo apt install multitail"
        echo "Showing backend logs only..."
        journalctl -u omnidial-backend -f
    fi
}

# OpenClaw commands
openclaw_start() {
    echo "Starting OpenClaw..."
    cd $OPENCLAW_DIR
    docker compose up -d
    echo -e "${GREEN}OpenClaw started${NC}"
}

openclaw_stop() {
    echo "Stopping OpenClaw..."
    cd $OPENCLAW_DIR
    docker compose down
    echo -e "${GREEN}OpenClaw stopped${NC}"
}

openclaw_logs() {
    cd $OPENCLAW_DIR
    docker compose logs -f
}

openclaw_restart() {
    echo "Restarting OpenClaw..."
    cd $OPENCLAW_DIR
    docker compose restart
    echo -e "${GREEN}OpenClaw restarted${NC}"
}

# Backend commands
backend_start() {
    echo "Starting backend..."
    sudo systemctl start omnidial-backend
    echo -e "${GREEN}Backend started${NC}"
}

backend_stop() {
    echo "Stopping backend..."
    sudo systemctl stop omnidial-backend
    echo -e "${GREEN}Backend stopped${NC}"
}

backend_logs() {
    journalctl -u omnidial-backend -f
}

backend_restart() {
    echo "Restarting backend..."
    sudo systemctl restart omnidial-backend
    echo -e "${GREEN}Backend restarted${NC}"
}

backend_deploy() {
    echo "Deploying latest backend..."
    cd $BACKEND_DIR

    git pull
    pnpm install
    pnpm build

    sudo systemctl restart omnidial-backend
    echo -e "${GREEN}Backend deployed and restarted${NC}"
}

# xRDP commands
xrdp_start() {
    echo "Starting xRDP..."
    sudo systemctl start xrdp
    echo -e "${GREEN}xRDP started${NC}"
}

xrdp_stop() {
    echo "Stopping xRDP..."
    sudo systemctl stop xrdp
    echo -e "${GREEN}xRDP stopped${NC}"
}

xrdp_restart() {
    echo "Restarting xRDP..."
    sudo systemctl restart xrdp
    echo -e "${GREEN}xRDP restarted${NC}"
}

# Tailscale commands
tailscale_status() {
    tailscale status
}

tailscale_ip() {
    echo -e "${GREEN}Tailscale IPv4:${NC} $(tailscale ip -4)"
    echo -e "${GREEN}Tailscale IPv6:${NC} $(tailscale ip -6)"
}

# Maintenance commands
update() {
    echo "Updating system packages..."
    sudo apt update && sudo apt upgrade -y
    echo -e "${GREEN}System updated${NC}"
}

cleanup() {
    echo "Cleaning up..."

    # Docker cleanup
    docker system prune -f

    # Apt cleanup
    sudo apt autoremove -y
    sudo apt autoclean

    # Journal cleanup (keep 7 days)
    sudo journalctl --vacuum-time=7d

    echo -e "${GREEN}Cleanup complete${NC}"
}

# Main
case "${1:-help}" in
    status)          status ;;
    logs)            logs ;;

    openclaw-start)  openclaw_start ;;
    openclaw-stop)   openclaw_stop ;;
    openclaw-logs)   openclaw_logs ;;
    openclaw-restart) openclaw_restart ;;

    backend-start)   backend_start ;;
    backend-stop)    backend_stop ;;
    backend-logs)    backend_logs ;;
    backend-restart) backend_restart ;;
    backend-deploy)  backend_deploy ;;

    xrdp-start)      xrdp_start ;;
    xrdp-stop)       xrdp_stop ;;
    xrdp-restart)    xrdp_restart ;;

    tailscale-status) tailscale_status ;;
    tailscale-ip)    tailscale_ip ;;

    update)          update ;;
    cleanup)         cleanup ;;

    help|--help|-h)  show_help ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
