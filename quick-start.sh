#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}iTrader Quick Start${NC}"
echo "===================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file from example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}Please edit .env file with your configuration${NC}"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    bun install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Check if database exists
if [ ! -f "prisma/database.db" ]; then
    echo -e "${YELLOW}Creating database...${NC}"
    bunx prisma generate
    bunx prisma db push
fi

# Build frontend if in production
if [ "$1" == "production" ]; then
    echo -e "${YELLOW}Building frontend...${NC}"
    cd frontend && npm run build && cd ..
fi

# Get external IP
EXTERNAL_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "")

# Start services
echo -e "${GREEN}Starting services...${NC}"

if [ "$1" == "production" ]; then
    # Production mode - start both services
    echo -e "${BLUE}Starting in PRODUCTION mode${NC}"
    
    # Start backend
    NODE_ENV=production WEBSOCKET_PORT=3002 bun run src/app.ts &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 5
    
    # Start frontend
    cd frontend && NODE_ENV=production npm run start &
    FRONTEND_PID=$!
    cd ..
    
else
    # Development mode
    echo -e "${BLUE}Starting in DEVELOPMENT mode${NC}"
    
    # Check if concurrently is installed
    if ! command -v concurrently &> /dev/null; then
        echo -e "${YELLOW}Installing concurrently...${NC}"
        npm install -g concurrently
    fi
    
    # Start both services with concurrently
    WEBSOCKET_PORT=3002 concurrently \
        --names "backend,frontend" \
        --prefix-colors "blue,green" \
        "bun run src/app.ts" \
        "cd frontend && npm run dev"
fi

# Show access info
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}🚀 iTrader Started!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "${BLUE}Local Access:${NC}"
echo "  Panel: http://localhost:3000"
echo "  API: http://localhost:3002"

if [ -n "$EXTERNAL_IP" ]; then
    echo ""
    echo -e "${BLUE}External Access:${NC}"
    echo "  Panel: http://$EXTERNAL_IP:3000"
    echo "  API: http://$EXTERNAL_IP:3002"
fi

echo -e "${GREEN}============================================================${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Wait for processes
if [ "$1" == "production" ]; then
    wait $BACKEND_PID $FRONTEND_PID
fi