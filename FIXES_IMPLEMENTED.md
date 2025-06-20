# Fixes Summary - June 20, 2025

## Issues Fixed

### 1. Receipt Parser Improvements
- Fixed V2 parser to handle decimal amounts with comma separator (e.g., "2,50" → 2.5)
- Added support for `recipientCard` field extraction
- Maintained 100% parsing success rate on all test receipts
- Updated all 11 receipts in the database with improved parsing

### 2. Chat Message Duplication Prevention
- Added database-level check for `chatStep > 0` before starting automation
- Improved mutex checks in `startAutomation` to prevent concurrent calls
- Updated payment message detection to include new format checks

### 3. Advertisement Duplication Prevention
- Added mutex (`creatingAds` Set) to prevent concurrent ad creation for same payout
- Added double-check for existing active advertisements before creating new ones
- Improved error handling for duplicate ad scenarios

### 4. Payment Details Format
- Code is already updated to send payment details as 5 separate messages:
  1. Bank name
  2. Account number
  3. Amount with "Сумма: X RUB"
  4. Email address
  5. Instructions
- **Note:** The old format messages in the database indicate the service needs to be restarted to use the new code

## Code Changes

1. **src/ocr/receiptParserV2.ts**
   - Updated `extractAmount` and `extractTotal` to handle comma decimal separator
   - Added `recipientCard` field extraction in `extractSequentialFields`

2. **src/services/chatAutomation.ts**
   - Added database check for `chatStep > 0` in `startAutomation`
   - Updated payment message detection to include new format markers

3. **src/services/payoutAdvertising.ts**
   - Added `creatingAds` Set as mutex for ad creation
   - Added check for existing active advertisements before creation
   - Proper cleanup in finally block

## Remaining Issues

1. **Service Restart Required**
   - The main application appears to not be running or is running with old code
   - Messages are still being sent in the old format despite code changes
   - Need to restart the service to apply the new payment message format

2. **Message Duplication Root Cause**
   - Multiple services/tasks are calling `startAutomation` for the same transaction
   - While mutex helps, the root cause is multiple task instances running simultaneously
   - Consider consolidating chat automation triggers to a single task

## Next Steps

1. Restart the main application service to apply code changes
2. Monitor for duplicate messages after restart
3. Verify new 5-message payment format is being used
4. Check that ad deletion on Bybit API is working correctly when orders are linked