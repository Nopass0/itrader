# Gmail Receipt Processor Integration Guide

## Overview

The Gmail Receipt Processor automatically:
1. Searches for Tinkoff receipt emails in all active Gmail accounts
2. Downloads and parses PDF receipts
3. Saves receipt data to the database
4. Matches receipts with pending payouts
5. Auto-approves matched payouts on Gate.io

## Integration Steps

### 1. Add to App State

Add the Gmail Receipt Processor to your app state in `src/app.ts`:

```typescript
interface AppState {
  // ... existing fields ...
  gmailReceiptProcessor: GmailReceiptProcessor | null;
}
```

### 2. Initialize the Service

In the initialization section of `app.ts`, after Gmail is set up:

```typescript
// Initialize Gmail Receipt Processor
if (state.gmailManager && state.gateManager && state.bybitManager && state.chatAutomation) {
  try {
    state.gmailReceiptProcessor = new GmailReceiptProcessor(
      state.gmailManager,
      state.gateManager,
      state.bybitManager,
      state.chatAutomation,
      {
        checkInterval: 5 * 60 * 1000, // 5 minutes
        pdfStoragePath: "data/pdf/gmail",
        maxEmailsPerCheck: 50,
        daysToLookBack: 7,
      }
    );

    // Start the processor
    await state.gmailReceiptProcessor.start();
    logger.info("Gmail Receipt Processor started");
    console.log("[Init] ✅ Gmail Receipt Processor started");

  } catch (error) {
    logger.error("Failed to start Gmail Receipt Processor", error as Error);
    console.error("[Init] Failed to start Gmail Receipt Processor:", error);
  }
} else {
  logger.warn("Cannot start Gmail Receipt Processor - missing dependencies");
  console.log("[Init] ⚠️ Cannot start Gmail Receipt Processor - missing dependencies");
}
```

### 3. Add Event Listeners

Add event listeners to track the processor's activity:

```typescript
if (state.gmailReceiptProcessor) {
  state.gmailReceiptProcessor.on("processingComplete", (result) => {
    logger.info("Gmail receipt processing complete", result);
    
    // Send WebSocket notification if needed
    if (state.wsServer) {
      state.wsServer.broadcast("gmailReceipts:processingComplete", result);
    }
  });

  state.gmailReceiptProcessor.on("error", (error) => {
    logger.error("Gmail receipt processor error", error);
  });
}
```

### 4. Add to Shutdown Handler

Make sure to stop the processor on shutdown:

```typescript
process.on("SIGINT", async () => {
  logger.info("Shutting down services...");
  
  // Stop Gmail Receipt Processor
  if (state.gmailReceiptProcessor) {
    state.gmailReceiptProcessor.stop();
    logger.info("Gmail Receipt Processor stopped");
  }
  
  // ... stop other services ...
  
  process.exit(0);
});
```

## Configuration

The Gmail Receipt Processor accepts the following configuration options:

- `checkInterval`: How often to check for new emails (default: 5 minutes)
- `pdfStoragePath`: Where to store downloaded PDF files (default: "data/pdf")
- `maxEmailsPerCheck`: Maximum emails to process per check (default: 50)
- `daysToLookBack`: How many days back to search for emails (default: 7)

## Features

### Automatic Receipt Matching

The processor matches receipts with payouts based on:
- Amount (allows up to 100 RUB difference for commission)
- Phone number or card number
- Date (receipt must be after payout creation)

### Auto-Approval on Gate

When a receipt is matched with a payout:
1. The payout is automatically approved on Gate.io
2. The transaction status is updated to "completed"
3. A Telegram notification is sent to the buyer
4. The advertisement is deleted from Bybit

### Error Handling

The processor includes robust error handling:
- Continues processing other emails if one fails
- Logs all errors with context
- Emits error events for monitoring
- Prevents duplicate processing of emails

### Performance Optimization

- Processes all Gmail accounts in parallel
- Caches processed email IDs to avoid reprocessing
- Uses batch operations where possible
- Includes configurable limits to prevent overload

## Monitoring

Monitor the processor through:

1. **Logs**: All operations are logged with the "GmailReceiptProcessor" service name
2. **Events**: Listen to processor events for real-time updates
3. **Database**: Check the Receipt table for processed receipts
4. **WebSocket**: Send updates to connected clients

## Troubleshooting

### Common Issues

1. **No emails found**: Check that Gmail accounts are properly configured and have the required scopes
2. **PDF parsing fails**: Ensure the PDF is a valid Tinkoff receipt
3. **Matching fails**: Verify that payout data matches receipt data
4. **Auto-approval fails**: Check Gate.io API credentials and permissions

### Debug Mode

Enable debug logging by setting the log level:

```typescript
const processor = new GmailReceiptProcessor(/* ... */);
// Add detailed logging for debugging
processor.on("debug", (message) => {
  console.log("[DEBUG]", message);
});
```

## Security Considerations

1. **PDF Storage**: PDFs are stored with hashed filenames to prevent enumeration
2. **Email Access**: Only processes emails from verified Tinkoff sender
3. **Approval Limits**: Only approves payouts that match strict criteria
4. **Error Recovery**: Failed operations don't affect other processing

## Future Enhancements

Potential improvements:
1. Support for other banks' receipt formats
2. Machine learning for better receipt matching
3. Real-time email monitoring via Gmail push notifications
4. Automatic retry for failed approvals
5. Receipt archival and compression