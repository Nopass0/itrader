# Startup Script Fixes

## Issue
The `start-dev.sh` script was terminating immediately after showing "Cleaning up existing processes..."

## Root Cause
The script was killing itself because it included `'bun.*start-dev.ts'` in the list of processes to kill during cleanup. When pkill matched this pattern, it terminated the script itself.

## Solution
1. Removed `'bun.*start-dev.ts'` from the processes to kill list
2. Enhanced the shell script with informative messages
3. Used `exec` to replace the shell process with the bun process

## Fixed Files

### /start-dev.ts
```typescript
// Removed this line from processesToKill array:
// 'bun.*start-dev.ts'
```

### /start-dev.sh
```bash
#!/bin/bash

echo "🚀 Starting iTrader development environment..."
echo "📝 Backend (WebSocket API): http://localhost:3001"
echo "🎨 Frontend: http://localhost:3000"
echo "🔥 Hot reload enabled for both services"
echo ""

# Run the development script
exec bun run start-dev.ts
```

## How to Run
```bash
./start-dev.sh
```

The script will:
1. Clean up any existing processes
2. Start the backend on port 3001 (WebSocket API)
3. Start the frontend on port 3000
4. Open a browser to http://localhost:3000
5. Enable hot reload for both services

## Additional Fixes

### Database Migration
- Ran `bun run db:push` to sync Prisma schema
- Fixed missing AuthToken table error

### Type Imports
- Fixed all TypeScript imports to use `import type` for type-only imports
- Ensures proper tree-shaking and compilation

### Health Endpoint
- Added HTTP health check at `http://localhost:3001/health`
- No authentication required
- Returns JSON status

### Orchestrator Pause/Resume
- Implemented pause/resume via Socket.IO API
- Configurable via `config.toml`
- Only admins/operators can control