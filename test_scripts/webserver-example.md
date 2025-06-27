# WebSocket Server Examples

## Server Management

The WebSocket server automatically starts with the main application on port 3002 (or the port specified in `WEBSOCKET_PORT` environment variable).

## Account Management

### Create accounts:
```bash
# Create admin account
bun run manage-webserver-accounts.ts create admin admin

# Create operator account
bun run manage-webserver-accounts.ts create john operator

# Create viewer account
bun run manage-webserver-accounts.ts create viewer viewer

# List all accounts
bun run manage-webserver-accounts.ts list

# Reset password
bun run manage-webserver-accounts.ts reset john

# Change role
bun run manage-webserver-accounts.ts role john admin

# Toggle account (activate/deactivate)
bun run manage-webserver-accounts.ts toggle john
```

## Client Connection Example

### Using Socket.IO client (JavaScript/TypeScript):

```javascript
import { io } from 'socket.io-client';

// Connect to server
const socket = io('http://localhost:3002', {
  auth: {
    token: '' // Will get token after login
  }
});

// Login first
socket.emit('auth:login', {
  username: 'admin',
  password: 'your-password-here'
}, (response) => {
  if (response.success) {
    console.log('Logged in!', response.data);
    // Reconnect with token
    socket.auth.token = response.data.token;
    socket.disconnect();
    socket.connect();
  } else {
    console.error('Login failed:', response.error);
  }
});

// Once authenticated, use any endpoint
socket.on('connect', () => {
  console.log('Connected to server');
  
  // Get transactions
  socket.emit('transactions:list', {
    limit: 10,
    offset: 0,
    status: 'pending'
  }, (response) => {
    console.log('Transactions:', response);
  });
  
  // Get current exchange rate
  socket.emit('rates:get', {}, (response) => {
    console.log('Exchange rate:', response);
  });
  
  // Monitor orchestrator status
  socket.emit('orchestrator:getStatus', {}, (response) => {
    console.log('Orchestrator status:', response);
  });
});

// Listen for real-time updates
socket.on('transaction:updated', (data) => {
  console.log('Transaction updated:', data);
});

socket.on('rate:changed', (data) => {
  console.log('Exchange rate changed:', data);
});

socket.on('chat:message', (data) => {
  console.log('New chat message:', data);
});
```

### Using curl for testing:

```bash
# This won't work directly with Socket.IO, but you can use a WebSocket testing tool
# or the Socket.IO client library in any language
```

## Available Events

### Authentication
- `auth:login` - Login with username/password
- `auth:logout` - Logout

### Accounts Management
- `accounts:create` - Create new account (admin only)
- `accounts:update` - Update account (admin only)
- `accounts:delete` - Delete account (admin only)
- `accounts:list` - List all accounts
- `accounts:resetPassword` - Reset password (admin only)
- `accounts:getCurrentUser` - Get current user info
- `accounts:changePassword` - Change own password

### Transactions
- `transactions:list` - List transactions with filters
- `transactions:get` - Get transaction details
- `transactions:updateStatus` - Update transaction status
- `transactions:addCustomStatus` - Add custom status (admin only)
- `transactions:listStatuses` - List all statuses
- `transactions:getStatistics` - Get transaction statistics

### Payouts
- `payouts:list` - List payouts
- `payouts:get` - Get payout details
- `payouts:create` - Create new payout
- `payouts:updateStatus` - Update payout status
- `payouts:linkToTransaction` - Link payout to transaction
- `payouts:cancel` - Cancel payout (admin only)
- `payouts:retry` - Retry failed payout
- `payouts:getStatistics` - Get payout statistics
- `payouts:export` - Export payouts data

### Advertisements
- `advertisements:list` - List advertisements
- `advertisements:get` - Get advertisement details
- `advertisements:create` - Create advertisement
- `advertisements:update` - Update advertisement
- `advertisements:toggle` - Enable/disable advertisement
- `advertisements:delete` - Delete advertisement (admin only)
- `advertisements:bulkUpdatePrices` - Bulk update prices (admin only)
- `advertisements:getStatistics` - Get advertisement statistics
- `advertisements:clone` - Clone advertisement

### Exchange Rates
- `rates:get` - Get current rate and settings
- `rates:setConstant` - Set constant rate
- `rates:toggleMode` - Toggle between constant/automatic
- `rates:history` - Get rate history
- `rates:setMarkup` - Set markup percentage (admin only)
- `rates:forceUpdate` - Force rate update
- `rates:getStatistics` - Get rate statistics

### Chats
- `chats:list` - List active chats
- `chats:getMessages` - Get chat messages
- `chats:sendMessage` - Send message
- `chats:markAsRead` - Mark messages as read
- `chats:getUnread` - Get unread messages
- `chats:syncMessages` - Sync messages from Bybit
- `chats:getStatistics` - Get chat statistics
- `chats:export` - Export chat history

### Templates
- `templates:list` - List chat templates
- `templates:get` - Get template details
- `templates:create` - Create template
- `templates:update` - Update template
- `templates:delete` - Delete template (admin only)
- `templates:listGroups` - List template groups
- `templates:createGroup` - Create group (admin only)
- `templates:findMatch` - Find matching template
- `templates:test` - Test template
- `templates:bulkImport` - Bulk import templates (admin only)
- `templates:export` - Export templates

### Orchestrator
- `orchestrator:getStatus` - Get orchestrator status
- `orchestrator:start` - Start orchestrator
- `orchestrator:stop` - Stop orchestrator
- `orchestrator:restart` - Restart orchestrator (admin only)
- `orchestrator:getConfig` - Get automation config
- `orchestrator:updateConfig` - Update config (admin only)
- `orchestrator:getLogs` - Get automation logs
- `orchestrator:clearLogs` - Clear logs (admin only)
- `orchestrator:runTask` - Run specific task
- `orchestrator:getStatistics` - Get automation statistics
- `orchestrator:test` - Test automation features

## Real-time Events (Server -> Client)

- `transaction:updated` - Transaction was updated
- `transaction:created` - New transaction created
- `payout:created` - New payout created
- `payout:updated` - Payout was updated
- `payout:cancelled` - Payout was cancelled
- `advertisement:created` - New advertisement created
- `advertisement:updated` - Advertisement was updated
- `advertisement:toggled` - Advertisement enabled/disabled
- `advertisement:deleted` - Advertisement was deleted
- `rate:changed` - Exchange rate changed
- `chat:message` - New chat message
- `orchestrator:started` - Orchestrator started
- `orchestrator:stopped` - Orchestrator stopped

## Role Permissions

### Admin
- Full access to all endpoints
- Can create/delete/modify accounts
- Can change system configuration
- Can delete data
- Can set exchange rate markup

### Operator
- Can view all data
- Can create/update transactions, payouts, advertisements
- Can send chat messages
- Can start/stop orchestrator
- Cannot delete data or change system config

### Viewer
- Read-only access to all data
- Cannot create, update, or delete anything
- Cannot send chat messages
- Cannot control orchestrator