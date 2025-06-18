# Order Linking Solution

## Problem
Orders created on Bybit P2P platform were not being linked to their corresponding transactions in our database because:
1. The ORDER_CREATED event is not always triggered when orders are created through Bybit's website/app
2. Order polling was running but not actively linking discovered orders to transactions
3. The itemId field in orders corresponds to the bybitAdId in our advertisements table

## Solution Implemented

### 1. **OrderLinkingService** (`src/services/orderLinkingService.ts`)
A dedicated service that:
- Runs periodically (every 30 seconds by default)
- Fetches all active orders from Bybit
- Matches orders to advertisements using itemId → bybitAdId
- Links unlinked orders to their transactions
- Starts chat polling for newly linked orders
- Monitors orphaned transactions

### 2. **Integration with BybitP2PManagerService**
- OrderLinkingService is automatically started when BybitP2PManagerService initializes
- Runs alongside the existing order polling mechanism
- Provides a safety net for any missed ORDER_CREATED events

### 3. **Manual Linking Scripts**
Created utility scripts for debugging and manual intervention:
- `test_scripts/debug-order-linking.ts` - Debug current state
- `test_scripts/check-active-order-details.ts` - Check specific order details
- `test_scripts/fix-order-linking.ts` - Manually link a specific order
- `test_scripts/test-order-linking-service.ts` - Test the automated service

## How It Works

1. **Order Creation Flow**:
   ```
   Payout → Advertisement (with bybitAdId) → Transaction → Order (linked via itemId)
   ```

2. **Linking Process**:
   - Order has `itemId` field
   - Advertisement has `bybitAdId` field
   - When `order.itemId === advertisement.bybitAdId`, they are linked
   - Transaction is updated with the orderId

3. **Automated Recovery**:
   - Every 30 seconds, the service checks for unlinked orders
   - Automatically links any found matches
   - Starts chat polling for newly linked orders

## Usage

The OrderLinkingService starts automatically when the main service initializes. No manual intervention needed.

To manually check/fix linking:
```bash
# Check current state
bun run test_scripts/debug-order-linking.ts

# Fix specific order
bun run test_scripts/fix-order-linking.ts

# Monitor the service
bun run test_scripts/test-order-linking-service.ts
```

## Key Fields Reference

- **Order**: 
  - `id`: Order ID (e.g., "1935036461250138112")
  - `itemId`: Advertisement ID (e.g., "1935036056297000960")
  
- **Advertisement**:
  - `bybitAdId`: Bybit's advertisement ID (matches order.itemId)
  - `id`: Internal database ID
  
- **Transaction**:
  - `orderId`: Linked order ID (populated by OrderLinkingService)
  - `advertisementId`: Links to advertisement
  - `payoutId`: Links to original payout

## Monitoring

The service logs all linking activities:
- Successfully linked orders
- Orders already linked
- Missing advertisements
- Orphaned transactions

Check logs with service name "OrderLinkingService" for detailed information.