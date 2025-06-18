#!/bin/bash

echo "Stopping existing processes..."

# Kill existing backend processes
pkill -f "bun.*app.ts" 2>/dev/null || true
pkill -f "bun.*start-dev.ts" 2>/dev/null || true

# Kill existing frontend processes
pkill -f "next dev" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

echo "Starting development server..."
cd /home/user/projects/itrader_project
bun run start-dev.ts