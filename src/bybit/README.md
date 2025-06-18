# Bybit P2P Module

Comprehensive WebSocket-like module for Bybit P2P functionality with multi-account support.

## Features

- ✅ Complete P2P API integration
- ✅ Multi-account management
- ✅ Real-time updates via polling (WebSocket simulation)
- ✅ Advertisement management (create, update, delete)
- ✅ Order processing (create, pay, release, cancel)
- ✅ Chat functionality (send messages, upload files)
- ✅ Payment method management
- ✅ Event-driven architecture
- ✅ TypeScript support with full type definitions

## Installation

```bash
npm install axios
# or
yarn add axios
```

## Quick Start

```typescript
import { P2PClient, P2PConfig } from './bybit';

// Configure client
const config: P2PConfig = {
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  testnet: true,
  debugMode: true,
};

// Create and connect client
const client = new P2PClient(config);
await client.connect();

// Get active advertisements
const ads = await client.getActiveAdvertisements({
  asset: 'USDT',
  fiatCurrency: 'USD',
});
```

## API Documentation

### P2PClient

Main client for single account P2P operations.

#### Constructor

```typescript
const client = new P2PClient(config: P2PConfig);
```

#### Configuration Options

```typescript
interface P2PConfig {
  apiKey: string;        // API key from Bybit
  apiSecret: string;     // API secret from Bybit
  testnet?: boolean;     // Use testnet (default: false)
  recvWindow?: number;   // Request timeout window (default: 5000)
  debugMode?: boolean;   // Enable debug logging (default: false)
}
```

#### Methods

##### Connection Management

```typescript
// Connect to P2P service
await client.connect(): Promise<void>

// Disconnect from P2P service
client.disconnect(): void

// Check connection status
client.isConnected(): boolean
```

##### Account Information

```typescript
// Get account information
await client.getAccountInfo(): Promise<any>
```

##### Advertisement Management

```typescript
// Get active advertisements with filters
await client.getActiveAdvertisements(filter?: AdvertisementFilter): Promise<PaginatedResponse<P2PAdvertisement>>

// Get my advertisements
await client.getMyAdvertisements(): Promise<PaginatedResponse<P2PAdvertisement>>  // Note: Returns all ads, no pagination

// Get advertisement details
await client.getAdvertisementDetails(itemId: string): Promise<P2PAdvertisement>

// Create new advertisement
await client.createAdvertisement(params: CreateAdvertisementParams): Promise<P2PAdvertisement>

// Update advertisement
await client.updateAdvertisement(params: UpdateAdvertisementParams): Promise<P2PAdvertisement>

// Delete advertisement
await client.deleteAdvertisement(itemId: string): Promise<void>
```

##### Order Management

```typescript
// Get all orders with filters
await client.getOrders(filter?: OrderFilter, page?: number, pageSize?: number): Promise<PaginatedResponse<P2POrder>>

// Get pending orders
await client.getPendingOrders(page?: number, pageSize?: number): Promise<PaginatedResponse<P2POrder>>

// Get order details
await client.getOrderDetails(orderId: string): Promise<P2POrder>

// Mark order as paid (buyer)
await client.markOrderAsPaid(orderId: string): Promise<void>

// Release assets (seller)
await client.releaseAssets(orderId: string): Promise<void>

// Cancel order
await client.cancelOrder(orderId: string, reason?: string): Promise<void>
```

##### Chat Management

```typescript
// Get chat messages for order
await client.getChatMessages(orderId: string, page?: number, pageSize?: number): Promise<PaginatedResponse<ChatMessage>>

// Send chat message
await client.sendChatMessage(params: SendMessageParams): Promise<ChatMessage>

// Upload file to chat
await client.uploadFile(orderId: string, fileData: Buffer, fileName: string): Promise<FileInfo>
```

##### Payment Methods

```typescript
// Get my payment methods
await client.getPaymentMethods(): Promise<PaymentMethod[]>

// Add payment method
await client.addPaymentMethod(paymentMethod: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod>

// Update payment method
await client.updatePaymentMethod(paymentMethod: PaymentMethod): Promise<PaymentMethod>

// Delete payment method
await client.deletePaymentMethod(paymentId: string): Promise<void>
```

##### Real-time Updates (Polling)

```typescript
// Start polling for order updates
client.startOrderPolling(intervalMs?: number): void

// Start polling for chat messages
client.startChatPolling(orderId: string, intervalMs?: number): void

// Stop specific polling
client.stopPolling(key: string): void
```

#### Events

```typescript
// Connection events
client.on('connected', () => {})
client.on('disconnected', () => {})
client.on('error', (error: Error) => {})

// P2P events
client.on('p2pEvent', (event: P2PEvent) => {})
client.on('orderUpdate', (order: P2POrder) => {})
client.on('chatMessage', (message: ChatMessage) => {})
```

### P2PManager

Manager for handling multiple P2P accounts.

#### Constructor

```typescript
const manager = new P2PManager();
```

#### Methods

##### Account Management

```typescript
// Add new account
await manager.addAccount(accountId: string, config: P2PConfig): Promise<void>

// Remove account
manager.removeAccount(accountId: string): void

// Switch active account
manager.switchAccount(accountId: string): void

// Get all accounts
manager.getAccounts(): P2PAccount[]

// Get active account
manager.getActiveAccount(): P2PAccount | null

// Connect all accounts
await manager.connectAll(): Promise<void>

// Disconnect all accounts
manager.disconnectAll(): void
```

##### Multi-Account Operations

All P2PClient methods are available with optional `accountId` parameter:

```typescript
// Examples:
await manager.getActiveAdvertisements(filter?, accountId?)
await manager.createAdvertisement(params, accountId?)
await manager.getOrders(filter?, page?, pageSize?, accountId?)
await manager.sendChatMessage(params, accountId?)
```

If `accountId` is not provided, operations use the active account or aggregate results from all accounts.

#### Events

```typescript
// Account events
manager.on('accountAdded', ({ accountId, isActive }) => {})
manager.on('accountRemoved', ({ accountId }) => {})
manager.on('accountSwitched', ({ accountId }) => {})
manager.on('accountConnected', ({ accountId }) => {})
manager.on('accountDisconnected', ({ accountId }) => {})
manager.on('accountError', ({ accountId, error }) => {})

// P2P events (includes accountId)
manager.on('p2pEvent', (event) => {})
manager.on('orderUpdate', ({ accountId, order }) => {})
manager.on('chatMessage', ({ accountId, message }) => {})
```

## Type Definitions

### Core Types

```typescript
// Advertisement
interface P2PAdvertisement {
  id: string;
  side: 'BUY' | 'SELL';
  asset: string;
  fiatCurrency: string;
  price: string;
  quantity: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  paymentMethods: PaymentMethod[];
  remarks?: string;
  status: 'ONLINE' | 'OFFLINE' | 'DELETED';
  createTime: number;
  updateTime: number;
}

// Order
interface P2POrder {
  orderId: string;
  itemId: string;
  side: 'BUY' | 'SELL';
  asset: string;
  fiatCurrency: string;
  price: string;
  quantity: string;
  totalAmount: string;
  status: OrderStatus;
  createTime: number;
  updateTime: number;
  paymentInfo?: PaymentInfo;
  counterparty: CounterpartyInfo;
}

// Chat Message
interface ChatMessage {
  messageId: string;
  orderId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE';
  timestamp: number;
  isRead: boolean;
  fileInfo?: FileInfo;
}

// Payment Method
interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  account: string;
  accountName: string;
  bankName?: string;
  qrCode?: string;
  isEnabled: boolean;
}
```

### Filter Types

```typescript
interface AdvertisementFilter {
  asset?: string;
  fiatCurrency?: string;
  side?: 'BUY' | 'SELL';
  paymentMethod?: string;
  minPrice?: string;
  maxPrice?: string;
  status?: 'ONLINE' | 'OFFLINE';
}

interface OrderFilter {
  status?: OrderStatus | OrderStatus[];
  asset?: string;
  fiatCurrency?: string;
  side?: 'BUY' | 'SELL';
  startTime?: number;
  endTime?: number;
}
```

## Examples

### Basic Usage

```typescript
import { P2PClient } from './bybit';

const client = new P2PClient({
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  testnet: true,
});

await client.connect();

// Create advertisement
const ad = await client.createAdvertisement({
  side: 'SELL',
  asset: 'USDT',
  fiatCurrency: 'USD',
  priceType: 'FIXED',
  price: '1.02',
  quantity: '1000',
  minOrderAmount: '10',
  maxOrderAmount: '500',
  paymentIds: ['payment-id'],
  remarks: 'Fast trade',
});

// Handle orders
const orders = await client.getPendingOrders();
for (const order of orders.list) {
  // Send message
  await client.sendChatMessage({
    orderId: order.orderId,
    message: 'Processing your order',
    messageType: 'TEXT',
  });
  
  // Release assets if paid
  if (order.status === 'PAID') {
    await client.releaseAssets(order.orderId);
  }
}
```

### Multi-Account Usage

```typescript
import { P2PManager } from './bybit';

const manager = new P2PManager();

// Add multiple accounts
await manager.addAccount('account1', {
  apiKey: 'key1',
  apiSecret: 'secret1',
  testnet: true,
});

await manager.addAccount('account2', {
  apiKey: 'key2',
  apiSecret: 'secret2',
  testnet: true,
});

// Get orders from all accounts
const allOrders = await manager.getOrders();

// Create ad on specific account
await manager.createAdvertisement({
  side: 'BUY',
  asset: 'USDT',
  fiatCurrency: 'EUR',
  priceType: 'FLOAT',
  floatRate: 0.01,
  quantity: '500',
  minOrderAmount: '50',
  maxOrderAmount: '500',
  paymentIds: ['payment-id'],
}, 'account1');
```

### Event-Driven Automation

```typescript
import { P2PManager } from './bybit';

const manager = new P2PManager();

// Setup event handlers
manager.on('orderUpdate', async ({ accountId, order }) => {
  if (order.status === 'PAID' && order.side === 'SELL') {
    // Auto-release assets
    await manager.releaseAssets(order.orderId, accountId);
    
    // Send confirmation
    await manager.sendChatMessage({
      orderId: order.orderId,
      message: 'Assets released. Thank you!',
      messageType: 'TEXT',
    }, accountId);
  }
});

manager.on('chatMessage', async ({ accountId, message }) => {
  if (message.content.toLowerCase().includes('status')) {
    const order = await manager.getOrderDetails(message.orderId, accountId);
    await manager.sendChatMessage({
      orderId: message.orderId,
      message: `Order status: ${order.status}`,
      messageType: 'TEXT',
    }, accountId);
  }
});

// Start monitoring
manager.startOrderPollingAll(5000);
```

## Error Handling

```typescript
try {
  await client.createAdvertisement(params);
} catch (error) {
  if (error.code === '10001') {
    console.error('Invalid parameters');
  } else if (error.retCode === 10002) {
    console.error('Insufficient balance');
  } else {
    console.error('Unknown error:', error.message);
  }
}
```

## Best Practices

1. **Connection Management**
   - Always call `connect()` before using the client
   - Handle connection errors gracefully
   - Disconnect when done to clean up resources

2. **Rate Limiting**
   - Respect Bybit's rate limits
   - Use appropriate polling intervals
   - Batch requests when possible

3. **Error Handling**
   - Always wrap API calls in try-catch blocks
   - Check `retCode` in responses
   - Implement retry logic for network errors

4. **Security**
   - Never hardcode API credentials
   - Use environment variables
   - Enable 2FA on your Bybit account

5. **Multi-Account**
   - Use P2PManager for multiple accounts
   - Monitor account health
   - Implement account rotation for load balancing

## Limitations

- WebSocket functionality is simulated using polling
- File upload implementation depends on exact API requirements
- Some features may require additional API permissions

## Support

For issues or questions:
- Check Bybit API documentation
- Review error codes and messages
- Test with testnet first
- Contact Bybit support for API-specific issues