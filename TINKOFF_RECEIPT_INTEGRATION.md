# Tinkoff Receipt Integration

## Overview
Integrated automatic Tinkoff receipt processing into the orchestrator with the following features:

## Features Implemented

### 1. Receipt Checking Task (Every 30 seconds)
- **Task ID**: `tinkoff_receipt_checker`
- Searches Gmail for Tinkoff emails (`from:no-reply@tinkoff.ru`) with PDF attachments
- Downloads and parses receipts using the improved TinkoffReceiptParser
- Saves receipts to database with full parsed data
- Handles parse failures gracefully

### 2. Receipt Matching with Payouts
- Matches receipts with payouts that have status 5 (accepted/in progress)
- Matching criteria:
  - Amount match (allows up to 100 RUB difference for commission)
  - Wallet/card match (phone numbers or last 4 digits of card)
  - Date validation (receipt must be after payout creation)
- Updates receipt with `payoutId` when match found
- Updates transaction with `receiptReceivedAt` timestamp

### 3. Automated Actions on Match
When a receipt matches a payout:
1. **Send Chat Message**: Sends telegram link to the order chat:
   ```
   Переходи в закрытый чат https://t.me/+nIB6kP22KmhlMmQy
   
   Всегда есть большой объем ЮСДТ по хорошему курсу, работаем оперативно.
   ```
2. **Delete Advertisement**: Removes the ad from Bybit using `/v5/p2p/item/cancel`
3. **Update Status**: Sets transaction status to `receipt_received`

### 4. Fund Release Task (Every 30 seconds)  
- **Task ID**: `fund_releaser`
- Checks for transactions where `receiptReceivedAt` is more than 2 minutes ago
- Releases funds using Bybit API: `/v5/p2p/order/finish`
- Updates transaction status to `completed`
- Handles errors and updates status to `failed` if release fails

## Database Changes
Added `receiptReceivedAt` field to Transaction model:
```prisma
model Transaction {
  // ... existing fields
  receiptReceivedAt DateTime?
  // ... other fields
}
```

## Service Architecture
Created `TinkoffReceiptService` with methods:
- `checkAndProcessReceipts()` - Main receipt checking logic
- `processMessage()` - Process individual email
- `tryMatchReceipt()` - Match receipt with pending payouts
- `releaseCompletedFunds()` - Release funds after 2-minute delay

## Integration Points
1. **Gmail API**: Fetches emails with attachments
2. **TinkoffReceiptParser**: Parses PDF receipts (supports names with 'ё' and concatenated text)
3. **Bybit P2P API**: 
   - Delete advertisements
   - Release order funds
4. **Chat Service**: Send messages to order chat

## Testing
Created `test-tinkoff-receipt-integration.ts` to verify:
- Pending payouts status
- Receipt database entries
- Transaction fund release status
- Gmail connection

## Usage
The integration runs automatically in the orchestrator:
1. Receipt checking every 30 seconds
2. Fund release checking every 30 seconds
3. All actions are automated - no manual intervention needed

## Important Notes
- Receipts are only processed once (tracked by emailId)
- Only receipts with status "Успешно" (Success) are processed
- Receipts with "В обработке" (In processing) are correctly rejected
- 2-minute delay before fund release provides safety buffer
- All matched receipts trigger immediate ad deletion to prevent duplicate orders