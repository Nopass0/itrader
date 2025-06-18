# Itrader Quick Start Guide

## Prerequisites

- Bun runtime installed
- Google Cloud account for Gmail API
- Gate.io account with panel access
- Bybit account with P2P trading enabled

## Installation

1. Install dependencies:
   ```
   bun install
   ```

2. Setup database:
   ```
   bun run setup
   ```

## Gmail OAuth Setup (Fix for "Invalid authorization code")

### Method 1: Using the new setup script (Recommended)

1. Get Google OAuth2 credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Gmail API
   - Create OAuth 2.0 Client ID (select "Desktop app")
   - Download credentials JSON

2. Place credentials:
   - Save as `data/gmail-credentials.json`

3. Run setup:
   ```
   bun run setup:gmail
   ```
   Or use the batch file:
   ```
   run.bat
   ```
   Then select option 3

4. Follow the prompts:
   - Open the URL in your browser
   - Sign in and authorize
   - Copy the ENTIRE redirect URL or just the code
   - Paste when prompted

### Method 2: Manual setup with CLI

1. Start CLI:
   ```
   bun run cli
   ```

2. Select "Manage Gmail account" → "Setup account"

### Common OAuth Issues and Fixes

**"Invalid authorization code" error:**
- Each code can only be used ONCE
- Codes expire after a few minutes
- Make sure to copy the code correctly
- If you see a URL like `http://localhost/?code=4/0AX4...&scope=...`, copy either:
  - The entire URL (the script will extract the code)
  - Just the code part between `code=` and `&scope`

**"Access blocked" error:**
- Add your email as a test user in Google Cloud Console
- Or publish the app (requires verification)

**No refresh token received:**
- This happens if you've authorized before
- Revoke access at https://myaccount.google.com/permissions
- Then try setup again

## Running the Application

### Option 1: Using run.bat (Windows)
```
run.bat
```
- Select 1 for CLI (configure accounts)
- Select 2 to run the application

### Option 2: Direct commands
```
# Run CLI
bun run cli

# Run application
bun run start

# Run in dev mode (auto-restart)
bun run dev
```

## Application Not Starting? (Exit immediately fix)

If the application exits immediately after starting:

1. Check if all required accounts are configured:
   ```
   bun run cli
   ```
   - Ensure at least one Gate account is added
   - Ensure at least one Bybit account is added
   - Gmail is optional but recommended

2. Check for errors in initialization:
   - Look for error messages in the console
   - Common issues:
     - Database not initialized: Run `bun run setup`
     - Missing credentials files
     - Invalid API keys

3. Run in debug mode:
   ```
   bun run src/app.ts
   ```
   This will show more detailed error messages

## Quick Setup Checklist

- [ ] Bun installed and working
- [ ] Database initialized (`bun run setup`)
- [ ] Gmail credentials downloaded and placed in `data/gmail-credentials.json`
- [ ] Gmail OAuth completed successfully
- [ ] At least one Gate.io account added
- [ ] At least one Bybit account added
- [ ] Selected operating mode (manual/automatic)

## Testing Your Setup

1. Test Gmail:
   ```
   bun run cli
   ```
   Select "Manage Gmail account" → "Test account"

2. Test Gate account:
   Select "Manage Gate accounts" → "Test account"

3. Test Bybit account:
   Select "Manage Bybit accounts" → "Test account"

## Need Help?

If you're still having issues:

1. Check the logs for specific error messages
2. Ensure all prerequisites are met
3. Try running each component separately to isolate the issue
4. Check that your API keys have the correct permissions