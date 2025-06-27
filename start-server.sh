#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to get external IP
get_external_ip() {
    # Try multiple services to get external IP
    for service in "https://api.ipify.org" "https://ifconfig.me" "https://icanhazip.com"; do
        IP=$(curl -s --max-time 5 $service)
        if [[ $IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo $IP
            return
        fi
    done
    echo ""
}

echo -e "${BLUE}Starting iTrader Server...${NC}"
echo "========================================"

# Check if running in production mode
if [ "$1" == "production" ] || [ "$MODE" == "production" ]; then
    echo -e "${YELLOW}Running in PRODUCTION mode${NC}"
    export NODE_ENV=production
    
    # Get external IP
    EXTERNAL_IP=$(get_external_ip)
    if [ -n "$EXTERNAL_IP" ]; then
        export EXTERNAL_IP=$EXTERNAL_IP
        echo -e "${GREEN}External IP detected: $EXTERNAL_IP${NC}"
    fi
    
    # Build frontend if needed
    if [ ! -d "frontend/.next" ]; then
        echo -e "${YELLOW}Building frontend...${NC}"
        cd frontend && npm run build && cd ..
    fi
    
    # Start services
    echo -e "${BLUE}Starting services...${NC}"
    
    # Start backend in background
    bun run src/app.ts &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 5
    
    # Start frontend
    cd frontend && npm run start &
    FRONTEND_PID=$!
    
    # Show URLs
    echo ""
    echo "========================================"
    echo -e "${GREEN}🚀 iTrader Server Started!${NC}"
    echo "========================================"
    echo -e "${BLUE}Local Access:${NC}"
    echo "  Panel: http://localhost:3000"
    echo "  API: http://localhost:3002"
    
    if [ -n "$EXTERNAL_IP" ]; then
        echo ""
        echo -e "${BLUE}External Access:${NC}"
        echo "  Panel: http://$EXTERNAL_IP:3000"
        echo "  API: http://$EXTERNAL_IP:3002"
    fi
    
    echo ""
    echo -e "${YELLOW}Important:${NC}"
    echo "- Make sure ports 3000 and 3002 are open in firewall"
    echo "- For production, use a reverse proxy (nginx) with SSL"
    echo "========================================"
    
    # Wait for both processes
    wait $BACKEND_PID $FRONTEND_PID
    
else
    echo -e "${GREEN}Running in DEVELOPMENT mode${NC}"
    
    # Start in development mode with auto-restart
    concurrently \
        --names "backend,frontend" \
        --prefix-colors "blue,green" \
        "bun run src/app.ts" \
        "cd frontend && npm run dev"
fi