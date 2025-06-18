# iTrader Server Management

## Overview
The server management scripts provide a unified interface for managing the iTrader system, including:
- Development and production server management
- System account management (admin/operators)
- Trading account management (Gate.io, Bybit, Gmail)
- Database migrations
- Server status monitoring

## Usage

### Linux/macOS
```bash
./server.sh
```

### Windows
```batch
server.bat
```

## Main Menu Options

### 1. Start Development Server (with hot reload)
- Starts both backend (port 3001) and frontend (port 3000)
- Enables hot reload for rapid development
- Automatically opens browser to http://localhost:3000
- Shows color-coded logs for backend and frontend

### 2. Start Production Server
- Starts the main automation server
- Requires at least one admin account to be created
- Runs the orchestrator with all tasks enabled

### 3. Stop Server
- Gracefully stops all running server processes
- Cleans up backend and frontend processes

### 4. Server Status
- Shows current server running status
- Lists active processes
- Displays database status and size

### 5. CLI - Manage Trading Accounts
- Access the trading account management CLI
- Configure Gate.io accounts
- Configure Bybit accounts
- Configure Gmail integration
- Manage automation settings

### 6. Manage System Accounts

#### Create/Reset Admin Account
- Creates or updates the main admin account
- Admin accounts have full system access
- Can manage all aspects of the system

#### Create Operator Account
- Creates operator accounts for daily operations
- Operators can manage trading but not system settings

#### List All Accounts
- Shows all system accounts
- Displays username, role, status, and last login

#### Reset Account Password
- Reset password for any account
- Requires password confirmation

#### Delete Account
- Remove system accounts
- Requires confirmation

### 7. Run Database Migrations
- Applies any pending database schema changes
- Required after updates that modify the database structure

### 8. Exit
- Exits the management interface
- Prompts to stop server if running

## Account Roles

### Admin
- Full system access
- Can manage all accounts
- Can access all settings
- Can view all data

### Operator
- Can manage trading operations
- Can view trading data
- Cannot modify system settings
- Cannot manage other accounts

### Viewer (future)
- Read-only access
- Can view data but not modify

## First Time Setup

1. Run the server management script
2. Create an admin account (option 6 → 1)
3. Run database migrations (option 7)
4. Start development server (option 1) or production server (option 2)
5. Access the web interface at http://localhost:3000

## Security Notes

- Admin passwords must be at least 6 characters
- All passwords are securely hashed using bcrypt
- Session tokens expire after 24 hours
- Failed login attempts are logged

## Troubleshooting

### Server won't start
- Check if another process is using ports 3000 or 3001
- Ensure all dependencies are installed (`bun install`)
- Check for database migration issues

### Cannot create accounts
- Ensure database exists and migrations are run
- Check file permissions on database file

### Development server crashes
- Check console output for specific errors
- Try stopping and restarting the server
- Clear node_modules and reinstall if needed

## Environment Variables

The server respects these environment variables:
- `WEBSOCKET_PORT` - WebSocket server port (default: 3001)
- `MODE` - Set to "auto" for automatic mode
- `DATABASE_URL` - Database connection string