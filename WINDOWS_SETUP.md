# Itrader Windows Setup Guide

## Prerequisites

1. **Install Bun** (JavaScript runtime)
   ```powershell
   # Run in PowerShell as Administrator
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **Install Git** (if not already installed)
   - Download from: https://git-scm.com/download/win

## Quick Start

### Option 1: Using itrader.bat (Recommended)

1. Double-click `itrader.bat`
2. Select option `[4] First Time Setup`
3. After setup, select option `[1] Configure Accounts`
4. Add your accounts (Gate, Bybit, Gmail)
5. Start trading with option `[2]` or `[3]`

### Option 2: Using PowerShell

1. Open PowerShell in project directory
2. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File start.ps1
   ```

### Option 3: Manual Setup

1. Open Command Prompt or PowerShell
2. Navigate to project directory
3. Run setup:
   ```bash
   bun install
   bun run setup
   ```
4. Start CLI:
   ```bash
   bun run cli
   ```

## Available Starters

### 1. `itrader.bat` - Full Control Panel
- User-friendly menu system
- Automatic/Manual mode switching
- Log viewer
- First-time setup wizard

### 2. `start.bat` - Simple Starter
- Basic menu
- Quick access to CLI and bot

### 3. `start.ps1` - PowerShell Starter
- Modern PowerShell interface
- Built-in setup option
- Better error handling

## Running Modes

### Automatic Mode
- No user interaction required
- All actions executed automatically
- Suitable for production

### Manual Mode
- Confirms each action
- Safer for testing
- Good for learning the system

## Command Line Options

```bash
# Start CLI for account management
bun run cli

# Start bot in current mode
bun run start

# Development mode with auto-reload
bun run dev

# Database commands
bun run db:generate   # Generate Prisma client
bun run db:push      # Create/update database tables
```

## Troubleshooting

### "Bun is not installed"
1. Install Bun using PowerShell (as Administrator):
   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
2. Restart your terminal/command prompt
3. Verify: `bun --version`

### "Cannot run scripts" PowerShell Error
1. Open PowerShell as Administrator
2. Run:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Type `Y` to confirm

### Database Errors
1. Delete `data/database.db` if exists
2. Run setup again:
   ```bash
   bun run setup
   ```

### Permission Errors
1. Run Command Prompt/PowerShell as Administrator
2. Or install to a directory you own (not Program Files)

## Logs

### View Logs in Real-time
```bash
# In Command Prompt
bun run start > app.log 2>&1

# In PowerShell
bun run start 2>&1 | Tee-Object -FilePath app.log
```

### View Last 50 Lines
```powershell
Get-Content app.log -Tail 50
```

## Windows Defender / Antivirus

If Windows Defender blocks the app:
1. Add project folder to exclusions
2. Or temporarily disable real-time protection during setup

## Running as Windows Service (Advanced)

For 24/7 operation, you can use NSSM (Non-Sucking Service Manager):

1. Download NSSM: https://nssm.cc/download
2. Install service:
   ```cmd
   nssm install Itrader "C:\path\to\bun.exe" "run" "src/app.ts"
   ```
3. Start service:
   ```cmd
   nssm start Itrader
   ```

## Tips

1. **First Time Users**: Use `itrader.bat` - it's the most user-friendly
2. **Developers**: Use PowerShell with `start.ps1`
3. **Production**: Set up as Windows Service for reliability
4. **Testing**: Always use Manual mode first

## Support Files

- `itrader.bat` - Main control panel
- `start.bat` - Simple starter
- `start.ps1` - PowerShell starter
- `SETUP_GUIDE.md` - General setup guide
- `WINDOWS_SETUP.md` - This file