# Gmail Receipt Processor Service

## Overview

The Gmail Receipt Processor is an automated service that:
- Monitors all active Gmail accounts for Tinkoff receipt emails
- Downloads and parses PDF receipts
- Matches receipts with pending payouts
- Automatically approves matched payouts on Gate.io
- Manages the complete transaction lifecycle

## Architecture

```
Gmail Accounts → Email Search → PDF Download → Parse Receipt → Match Payout → Auto-Approve → Complete Transaction
     ↓               ↓              ↓              ↓             ↓              ↓              ↓
  Database      Tinkoff Only    Store PDF    Extract Data   Find Match    Gate API      Update Status
```

## Key Components

### 1. GmailReceiptProcessor (`GmailReceiptProcessor.ts`)

Main service class that orchestrates the entire process:

```typescript
const processor = new GmailReceiptProcessor(
  gmailManager,    // Manages Gmail API connections
  gateManager,     // Manages Gate.io accounts
  bybitManager,    // Manages Bybit P2P operations
  chatService,     // Sends Telegram notifications
  config           // Configuration options
);
```

### 2. TinkoffPDFParser (`TinkoffPDFParser.ts`)

Enhanced PDF parser with additional features:
- Extended receipt data extraction
- Confidence scoring
- Batch processing support
- Validation and error handling

```typescript
const parser = new TinkoffPDFParser();
const result = await parser.parseFromBufferExtended(pdfBuffer);
// Returns: { receipt, metadata, rawText, error? }
```

## Configuration

```typescript
interface GmailReceiptProcessorConfig {
  checkInterval?: number;      // How often to check (default: 5 minutes)
  pdfStoragePath?: string;     // PDF storage location (default: "data/pdf")
  maxEmailsPerCheck?: number;  // Max emails per check (default: 50)
  daysToLookBack?: number;     // History to search (default: 7 days)
}
```

## Receipt Matching Algorithm

The service matches receipts with payouts using:

1. **Amount Matching**: Allows up to 100 RUB difference for commission
2. **Wallet Matching**: 
   - Phone numbers: Normalizes and compares last 10 digits
   - Card numbers: Compares last 4 digits
3. **Date Validation**: Receipt must be created after payout
4. **Status Check**: Only matches pending payouts (status 5)

## Auto-Approval Process

When a receipt matches a payout:

1. **Update Database**:
   - Mark receipt as processed
   - Link receipt to payout
   - Update transaction status

2. **Approve on Gate**:
   - Upload PDF receipt
   - Call Gate API to approve
   - Update payout status

3. **Complete Transaction**:
   - Send Telegram notification
   - Delete Bybit advertisement
   - Mark transaction as completed

## Events

The processor emits the following events:

```typescript
processor.on('processingComplete', (result) => {
  // Processing cycle finished
  // result: { totalEmails, processedEmails, newReceipts, matchedReceipts, approvedPayouts, errors }
});

processor.on('receiptMatched', (data) => {
  // Receipt matched with payout
  // data: { receiptId, payoutId, amount }
});

processor.on('payoutApproved', (data) => {
  // Payout approved on Gate
  // data: { payoutId, gatePayoutId }
});

processor.on('error', (error) => {
  // Processing error occurred
});
```

## Database Schema

### Receipt Table
- `emailId`: Unique Gmail message ID
- `amount`: Transaction amount
- `recipientPhone`: Phone number (if applicable)
- `recipientCard`: Card number (if applicable)
- `payoutId`: Linked payout ID
- `isProcessed`: Processing status
- `parsedData`: Full parsed receipt data

## Error Handling

The service includes comprehensive error handling:

1. **Email Processing**: Continues with next email on failure
2. **PDF Parsing**: Stores receipt even if parsing fails
3. **Matching**: Logs mismatches for debugging
4. **API Calls**: Retries and fallback mechanisms

## Security

1. **Email Verification**: Only processes emails from `noreply@tinkoff.ru`
2. **PDF Storage**: Uses hashed filenames
3. **Amount Validation**: Strict matching criteria
4. **Transaction Safety**: Prevents double processing

## Performance

- Processes multiple Gmail accounts in parallel
- Caches processed email IDs
- Configurable batch sizes
- Efficient database queries with proper indexing

## Monitoring

Monitor the service through:

1. **Logs**: All operations logged with context
2. **Database**: Check Receipt and Payout tables
3. **Events**: Real-time processing updates
4. **Metrics**: Processing stats in each cycle

## Usage Example

```typescript
// Initialize service
const processor = new GmailReceiptProcessor(
  gmailManager,
  gateManager,
  bybitManager,
  chatService,
  {
    checkInterval: 5 * 60 * 1000, // 5 minutes
    maxEmailsPerCheck: 50,
  }
);

// Start processing
await processor.start();

// Monitor events
processor.on('processingComplete', (result) => {
  console.log(`Processed ${result.processedEmails} emails, matched ${result.matchedReceipts} receipts`);
});

// Stop when needed
processor.stop();
```

## Troubleshooting

### Common Issues

1. **"No Gmail accounts found"**
   - Ensure Gmail accounts are added to database
   - Check account `isActive` status

2. **"PDF parsing failed"**
   - Verify PDF is from Tinkoff
   - Check PDF isn't corrupted
   - Review parser logs

3. **"No matching payout"**
   - Verify payout status is 5
   - Check amount matches (within 100 RUB)
   - Confirm wallet/card details match

4. **"Gate approval failed"**
   - Check Gate API credentials
   - Verify payout exists on Gate
   - Review Gate API response

### Debug Mode

Enable detailed logging:

```typescript
// Set log level to debug
process.env.LOG_LEVEL = 'debug';

// Or listen to debug events
processor.on('debug', console.log);
```

## Future Enhancements

1. **Multi-Bank Support**: Add parsers for other banks
2. **Real-time Processing**: Gmail push notifications
3. **ML Matching**: Machine learning for better matching
4. **Bulk Operations**: Process multiple receipts in one Gate API call
5. **Analytics**: Receipt processing statistics and trends