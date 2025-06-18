# Orchestrator Toggle UI Implementation

## Overview
Added a pause/resume toggle switch for the orchestrator in the sidebar. This allows admins and operators to control the orchestrator directly from the UI.

## Features

### 1. Visual Toggle Switch
- Located in the sidebar below the status indicator
- Only visible to users with `admin` or `operator` roles
- Shows current orchestrator status with icons:
  - ▶️ Green play icon when running
  - ⏸️ Yellow pause icon when paused
  - 🔄 Loading spinner when toggling

### 2. Real-time Status Updates
- Automatically updates when orchestrator status changes
- Listens to WebSocket events:
  - `orchestrator:paused`
  - `orchestrator:resumed`
  - `orchestrator:started`
  - `orchestrator:stopped`
- Refreshes status every 30 seconds

### 3. Permission Control
- Only users with `admin` or `operator` role can see and use the toggle
- Regular traders won't see the orchestrator control
- Graceful error handling for unauthorized attempts

## Implementation Details

### New Files Created

1. **`/frontend/hooks/useOrchestrator.ts`**
   - Custom React hook for orchestrator management
   - Handles WebSocket communication
   - Manages status state and real-time updates
   - Provides pause, resume, and toggle functions

2. **`/frontend/components/ui/table.tsx`**
   - Added missing table component for logs page
   - Basic table implementation with shadcn/ui styling

### Modified Files

1. **`/frontend/components/panel/Sidebar.tsx`**
   - Added orchestrator toggle UI
   - Integrated with `useOrchestrator` hook
   - Added conditional rendering based on user permissions

2. **`/frontend/types/index.ts`**
   - Updated `User` interface to include `role` field
   - Added optional `avatar` field

## Usage

### For Admins/Operators
1. Log in with admin or operator credentials
2. Look for the "Оркестратор" (Orchestrator) card in the sidebar
3. Use the toggle switch to pause/resume the orchestrator
4. Status updates in real-time

### UI States
- **Running**: Green play icon, toggle is on
- **Paused**: Yellow pause icon, toggle is off
- **Loading**: Spinner icon, toggle is disabled
- **Error**: Shows in the status text

## Testing

Run the test script to verify functionality:
```bash
bun run test-orchestrator-toggle.ts
```

This will:
1. Connect to the WebSocket server
2. Login as admin
3. Get current orchestrator status
4. Toggle pause/resume
5. Verify status changes

## WebSocket Events

The UI responds to these events:
- `orchestrator:paused` - Updates UI to show paused state
- `orchestrator:resumed` - Updates UI to show running state
- `orchestrator:started` - Updates UI to show running state
- `orchestrator:stopped` - Updates UI to show stopped state

## Security

- Server-side permission checks ensure only authorized users can control the orchestrator
- WebSocket authentication required for all orchestrator control endpoints
- UI respects permissions and hides controls from unauthorized users