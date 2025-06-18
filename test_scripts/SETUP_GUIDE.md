# Itrader Setup Guide

## Overview

Itrader is an automated P2P trading system that integrates Gate.io, Bybit P2P, and Gmail for seamless transaction processing.

## Features

- ✅ Automated payout acceptance from Gate.io (status 4)
- ✅ Automatic Bybit P2P advertisement creation
- ✅ Chat automation with counterparties
- ✅ PDF check verification via Gmail
- ✅ Automatic fund release after verification
- ✅ Multi-account support for all platforms
- ✅ Manual/Automatic mode switching
- ✅ Blacklist management

## Prerequisites

1. **Node.js** and **Bun** installed
2. **Gate.io** panel access (panel.gate.cx)
3. **Bybit** account with P2P API access
4. **Gmail** account for receiving checks
5. **SQLite** database (auto-created)

## Installation

1. Install dependencies:
```bash
bun install
```

2. Generate Prisma client:
```bash
bunx prisma generate
bunx prisma db push
```

3. Create data directories:
```bash
mkdir -p data/cookies data/temp
```

## Configuration

### Using CLI (Recommended)

1. Start the CLI:
```bash
./start.sh
# Or directly:
bun run src/app.ts --cli
```

2. Configure accounts through the menu:
   - Add Gate.io accounts (email/password)
   - Add Bybit accounts (API key/secret)
   - Setup Gmail OAuth
   - Switch between Manual/Automatic mode

### Manual Configuration

If you prefer to configure manually, you can add accounts directly to the database.

## Running the Application

### With Startup Script
```bash
./start.sh
```

### Direct Commands
```bash
# CLI mode
bun run src/app.ts --cli

# Run automation
bun run src/app.ts
```

## Operation Modes

### Manual Mode
- Every action requires user confirmation
- Safer for testing and initial setup
- Prompts for each:
  - Payout acceptance
  - Advertisement creation
  - Fund release

### Automatic Mode
- Runs without user intervention
- Suitable for production use
- All actions are logged

## Workflow

1. **Payout Acceptance**: Checks Gate.io for payouts with status 4
2. **Advertisement Creation**: Creates Bybit P2P ads for accepted payouts
3. **Chat Automation**: Handles counterparty communication:
   - Verifies payment method (Tinkoff Bank)
   - Confirms PDF check capability
   - Sends payment details
4. **Check Verification**: Monitors Gmail for Tinkoff checks
   - Verifies amount and recipient
   - Matches with pending transactions
5. **Fund Release**: Releases funds 2 minutes after check verification

## Chat Flow

The bot follows this conversation flow:

1. **Question 1**: "Оплата будет с Т банка?"
2. **Question 2**: "Чек в формате пдф с официальной почты Т банка сможете отправить?"
3. **Question 3**: "При СБП, если оплата будет на неверный банк, деньги потеряны."
4. **Payment Details**: Sends bank/card details and email for check
5. **Final Message**: Telegram invite after verification

## Security Notes

- API keys are stored in SQLite database
- Gate.io cookies are saved in `data/cookies/`
- Gmail uses OAuth2 for secure access
- Blacklist prevents repeat bad actors

## Troubleshooting

### Gate.io Issues
- Ensure cookies are valid (re-login if needed)
- Check rate limits (5 min between fetches)
- Verify account has access to payouts

### Bybit Issues
- Verify P2P API permissions are enabled
- Check account has payment methods configured
- Ensure not exceeding 2 active ads per account

### Gmail Issues
- Re-authorize OAuth if token expires
- Ensure emails from noreply@tinkoff.ru aren't filtered
- Check attachment download permissions

## Database Schema

The system uses SQLite with the following main tables:
- `Payout` - Gate.io payouts
- `BybitAdvertisement` - Created advertisements
- `Transaction` - Links payouts to advertisements
- `ChatMessage` - Conversation history
- `GateAccount`, `BybitAccount`, `GmailAccount` - Account credentials
- `BlacklistedTransaction` - Failed transactions
- `SystemSettings` - Application settings

## Logs

Application logs are output to console. For production use, consider redirecting to a file:
```bash
bun run src/app.ts > app.log 2>&1
```

## Support

For issues:
1. Check logs for error messages
2. Verify all accounts are properly configured
3. Ensure database migrations are up to date
4. Test each component individually through CLI