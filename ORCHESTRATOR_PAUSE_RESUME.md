# Orchestrator Pause/Resume Implementation

## Overview
Implemented pause/resume functionality for the orchestrator that can be controlled via Socket.IO API.

## Changes Made

### 1. Configuration File (config.toml)
- Added `start_paused` field to control whether orchestrator starts paused
- Located at `/config.toml`
- Set to `false` by default

### 2. Configuration Loader (/src/utils/config.ts)
- Created configuration loader utility
- Loads TOML config with fallback to defaults
- Exports `loadConfig()` and `getConfig()` functions

### 3. Updated app.ts
- Import configuration loader
- Check `config.orchestrator.start_paused` on startup
- Set orchestrator instance in controller for Socket.IO access

### 4. Socket.IO Endpoints
Added two new endpoints in WebSocket server:
- `orchestrator:pause` - Pauses the orchestrator
- `orchestrator:resume` - Resumes the orchestrator

Both require authentication (admins and operators only).

### 5. Orchestrator Controller Methods
- `pause()` - Pauses orchestrator and broadcasts event
- `resume()` - Resumes orchestrator and broadcasts event
- `setOrchestrator()` - Sets the orchestrator instance

### 6. Orchestrator Class Updates
Added helper methods:
- `getStatus()` - Returns running/paused state
- `getRunningTasks()` - Returns currently running tasks
- `getScheduledTasks()` - Returns scheduled/idle tasks
- `reload()` - Placeholder for configuration reload

### 7. Database Migration
- Ran `bun run db:push` to sync database schema
- Fixed missing AuthToken table error

### 8. Type Imports
- Fixed all TypeScript type imports to use `import type`
- Ensures proper type-only imports for interfaces

### 9. Health Endpoint
- Added HTTP health check endpoint at `/health`
- No authentication required
- Returns JSON with status, timestamp, version, and service name

## Usage

### Starting Paused
Edit `config.toml` and set:
```toml
[orchestrator]
start_paused = true
```

### Socket.IO API

#### Pause Orchestrator
```javascript
socket.emit('orchestrator:pause', (response) => {
  if (response.success) {
    console.log('Orchestrator paused');
  }
});
```

#### Resume Orchestrator
```javascript
socket.emit('orchestrator:resume', (response) => {
  if (response.success) {
    console.log('Orchestrator resumed');
  }
});
```

#### Get Status
```javascript
socket.emit('orchestrator:getStatus', (response) => {
  console.log('Status:', response.data);
  // { isRunning: boolean, status: 'running'|'paused', ... }
});
```

### Health Check
```bash
curl http://localhost:3001/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "service": "itrader-websocket"
}
```

## Events Broadcast

When paused/resumed, the server broadcasts events to all connected clients:
- `orchestrator:paused` - With pausedBy userId and timestamp
- `orchestrator:resumed` - With resumedBy userId and timestamp

## Test Scripts

- `test-orchestrator-pause.ts` - Tests pause/resume functionality
- `test-health-endpoint.ts` - Tests health endpoint