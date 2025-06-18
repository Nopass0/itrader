#!/bin/bash

echo "Cleaning up development processes..."

# Kill Node/Next.js processes
pkill -f "next-server" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true

# Kill Bun processes
pkill -f "bun.*app.ts" 2>/dev/null || true
pkill -f "bun.*start-dev.ts" 2>/dev/null || true
pkill -f "bun --hot" 2>/dev/null || true

# Kill any process using ports 3000 and 3001
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "Cleanup complete!"