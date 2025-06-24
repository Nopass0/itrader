#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}iTrader Production Restart${NC}"
echo "=========================="

# Stop all services
echo -e "${YELLOW}Stopping all services...${NC}"
pkill -f "bun.*app.ts"
pkill -f "next"
sleep 2

# Get external IP
EXTERNAL_IP=$(curl -s https://api.ipify.org || echo "localhost")
echo -e "${GREEN}External IP: $EXTERNAL_IP${NC}"

# Update frontend configuration
echo -e "${YELLOW}Updating frontend configuration...${NC}"
cat > frontend/.env.production.local << EOF
NEXT_PUBLIC_WS_URL=http://$EXTERNAL_IP:3001
NEXT_PUBLIC_API_URL=http://$EXTERNAL_IP:3001
EOF

# Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd frontend
npm run build
cd ..

# Start backend
echo -e "${YELLOW}Starting backend...${NC}"
NODE_ENV=production WEBSOCKET_PORT=3001 bun run src/app.ts &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start frontend
echo -e "${YELLOW}Starting frontend...${NC}"
cd frontend
NODE_ENV=production npm run start &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}🚀 iTrader Production Server Started!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "${BLUE}Access URLs:${NC}"
echo "  Panel: http://$EXTERNAL_IP:3000"
echo "  API: http://$EXTERNAL_IP:3001"
echo ""
echo "  Local Panel: http://localhost:3000"
echo "  Local API: http://localhost:3001"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${YELLOW}PIDs:${NC}"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo -e "${YELLOW}To stop: pkill -f 'bun.*app.ts' && pkill -f 'next'${NC}"
echo ""