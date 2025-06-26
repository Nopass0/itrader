# Exchange Rate Manager - Automatic Mode

## Overview

The Exchange Rate Manager now supports an automatic mode that fetches USDT/RUB rates from Bybit P2P advertisements. This allows for dynamic pricing based on real market conditions.

## Features

### 1. Multiple Rate Sources
- Fetches rates from Bybit P2P-OTC API
- Configurable page number and advertisement index
- Supports multiple rules with different configurations

### 2. Time-Based Rules
- Define different rates for different times of day
- Supports overnight rules (e.g., 23:00 - 02:00)
- Priority-based rule selection

### 3. Price Adjustments
- Apply percentage markup/markdown to fetched prices
- Each rule can have its own adjustment percentage

### 4. Fallback Mechanism
- Configurable fallback rate when no rules match
- Automatic fallback on API errors
- Caches last successful rate

## Database Schema

### ExchangeRateConfig
```prisma
model ExchangeRateConfig {
  id              String   @id @default("default")
  mode            String   @default("constant") // "constant" or "automatic"
  constantRate    Float    @default(78)
  updateInterval  Int      @default(300000) // milliseconds
  fallbackRate    Float    @default(78)
  lastUpdate      DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### ExchangeRateRule
```prisma
model ExchangeRateRule {
  id              String   @id @default(cuid())
  name            String
  priority        Int      @default(0)
  timeStart       String?  // HH:MM format
  timeEnd         String?  // HH:MM format
  minAmount       Float?   // Not implemented yet
  maxAmount       Float?   // Not implemented yet
  pageNumber      Int      @default(1)
  adIndex         Int      @default(0) // 0-based
  priceAdjustment Float    @default(0) // percentage
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## WebSocket API

### Get Current Configuration
```javascript
socket.emit('rates:get', (response) => {
  // response.data = {
  //   mode: 'automatic',
  //   constantRate: 78,
  //   currentRate: 82.5,
  //   lastUpdate: '2024-01-01T12:00:00Z'
  // }
});
```

### Switch to Automatic Mode
```javascript
socket.emit('rates:toggleMode', (response) => {
  // Switches between 'constant' and 'automatic'
});
```

### Manage Rules
```javascript
// Get all rules
socket.emit('rates:getRules', (response) => {
  // response.data = array of rules
});

// Create a rule
socket.emit('rates:createRule', {
  name: 'Business Hours',
  priority: 100,
  timeStart: '09:00',
  timeEnd: '18:00',
  pageNumber: 1,
  adIndex: 0,
  priceAdjustment: 2.5, // 2.5% markup
  enabled: true
}, callback);

// Update a rule
socket.emit('rates:updateRule', {
  id: 'rule-id',
  updates: {
    priceAdjustment: 3.0
  }
}, callback);

// Delete a rule
socket.emit('rates:deleteRule', {
  id: 'rule-id'
}, callback);

// Test a rule without saving
socket.emit('rates:testRule', {
  name: 'Test Rule',
  pageNumber: 1,
  adIndex: 0,
  priceAdjustment: 2.0
}, (response) => {
  // response.data = {
  //   rate: 82.5,
  //   metadata: { baseRate: 80.88, adjustment: 2.0 }
  // }
});
```

### Get Bybit P2P Statistics
```javascript
socket.emit('rates:getBybitStatistics', {
  pageNumber: 1
}, (response) => {
  // response.data = {
  //   count: 20,
  //   minPrice: 79.5,
  //   maxPrice: 82.0,
  //   avgPrice: 80.75,
  //   median: 80.88,
  //   advertisements: [...]
  // }
});
```

### Update Configuration
```javascript
socket.emit('rates:updateConfig', {
  updateInterval: 600000, // 10 minutes
  fallbackRate: 79
}, callback);
```

## Example Rules Setup

### 1. Time-Based Pricing
```javascript
// Business hours (9 AM - 6 PM)
{
  name: 'Business Hours',
  priority: 100,
  timeStart: '09:00',
  timeEnd: '18:00',
  pageNumber: 1,
  adIndex: 0,      // Use cheapest ad
  priceAdjustment: 2.5
}

// Evening (6 PM - 11 PM)
{
  name: 'Evening Hours',
  priority: 90,
  timeStart: '18:00',
  timeEnd: '23:00',
  pageNumber: 1,
  adIndex: 1,      // Use second cheapest
  priceAdjustment: 3.0
}

// Night (11 PM - 9 AM)
{
  name: 'Night Hours',
  priority: 80,
  timeStart: '23:00',
  timeEnd: '09:00',
  pageNumber: 1,
  adIndex: 2,      // Use third option
  priceAdjustment: 4.0
}
```

### 2. Default Fallback
```javascript
// Always active, lowest priority
{
  name: 'Default Rate',
  priority: 50,
  pageNumber: 2,
  adIndex: 0,
  priceAdjustment: 2.0
}
```

## Implementation Details

### Rate Fetching Process
1. System checks enabled rules sorted by priority (highest first)
2. For each rule, checks if current time matches time window
3. Fetches the specified advertisement from Bybit P2P
4. Applies price adjustment percentage
5. Caches the result for quick access
6. Falls back to `fallbackRate` on any error

### Update Frequency
- Configurable via `updateInterval` (default: 5 minutes)
- Automatic updates only run in 'automatic' mode
- Manual updates can be triggered via `rates:forceUpdate`

### Error Handling
- API errors are logged but don't crash the system
- Falls back to last successful rate or configured fallback
- Each rule is tried independently

## Security Considerations

- Only admins can create/update/delete rules
- Only admins can update configuration
- Operators can test rules and view statistics
- All rate changes are logged in ExchangeRateHistory

## Testing

Use the example script to test automatic mode:
```bash
bun run src/services/exchangeRateExample.ts
```

This will:
1. Create sample rules
2. Test each rule
3. Show Bybit P2P statistics
4. Switch to automatic mode
5. Wait for automatic updates
6. Clean up test data