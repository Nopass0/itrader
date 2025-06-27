# Full System Test Guide

## 1. Start Development Server

```bash
# This will start both backend and frontend with hot reload
# Backend: http://localhost:3002 (WebSocket API)
# Frontend: http://localhost:3000
./start-dev.sh

# Or on Windows:
start-dev.bat
```

The browser will automatically open to http://localhost:3000

## 2. Create Admin Account

In a new terminal:

```bash
# Create admin account
bun run manage-webserver-accounts.ts create admin admin

# You'll get output like:
# Username: admin
# Password: <generated-password>
# Save this password!
```

## 3. Login to Frontend

1. Go to http://localhost:3000/login
2. Use the admin credentials from step 2
3. You'll be redirected to the panel

## 4. Test WebSocket API Features

### From the Panel:
- **Transactions Page** - View real-time P2P transactions
- **Accounts Page** - Manage Gate and Bybit accounts
- **Stats Page** - View system statistics

### Real-time Updates:
The system will show real-time updates for:
- New transactions
- Status changes
- Chat messages
- Exchange rate changes

## 5. Test API from Console

Open browser console (F12) and test:

```javascript
// The socket API is available globally in development
const api = window.__socketApi;

// Check connection
console.log('Connected:', api.isConnected());

// Get current user
const user = await api.accounts.getCurrentUser();
console.log('Current user:', user);

// Get transactions
const transactions = await api.transactions.list({ limit: 10 });
console.log('Transactions:', transactions);

// Get exchange rate
const rate = await api.rates.get();
console.log('Exchange rate:', rate);

// Get orchestrator status
const status = await api.orchestrator.getStatus();
console.log('Orchestrator status:', status);
```

## 6. Test Real-time Events

```javascript
// Subscribe to real-time events
api.on('transaction:created', (data) => {
  console.log('New transaction:', data);
});

api.on('rate:changed', (data) => {
  console.log('Rate changed:', data);
});

api.on('chat:message', (data) => {
  console.log('New chat message:', data);
});
```

## 7. Create Test Data

### Create a test operator account:
```bash
bun run manage-webserver-accounts.ts create operator operator
```

### From the API console:
```javascript
// Create a test payout
const payout = await api.payouts.create({
  gateAccountId: 'test-gate-account',
  amount: 1000,
  recipientCard: '1234567890123456',
  recipientName: 'Test User',
  description: 'Test payout'
});
console.log('Created payout:', payout);

// Create a test advertisement
const ad = await api.advertisements.create({
  bybitAccountId: 'test-bybit-account',
  type: 'sell',
  currency: 'USDT',
  fiat: 'RUB',
  price: 100.5,
  minAmount: 100,
  maxAmount: 10000,
  paymentMethods: ['SBP', 'Tinkoff']
});
console.log('Created advertisement:', ad);
```

## 8. Monitor System

### Check logs:
```javascript
const logs = await api.orchestrator.getLogs({ limit: 20 });
console.log('System logs:', logs);
```

### Check statistics:
```javascript
const stats = await api.transactions.getStatistics();
console.log('Transaction statistics:', stats);

const rateStats = await api.rates.getStatistics('day');
console.log('Rate statistics:', rateStats);
```

## 9. Stop Server

Press `Ctrl+C` in the terminal where you ran `./start-dev.sh`

## Troubleshooting

### Port conflicts:
- Backend runs on port 3002
- Frontend runs on port 3000
- Make sure these ports are free

### Connection issues:
- Check that both backend and frontend are running
- Check browser console for errors
- Verify WebSocket connection in Network tab (WS filter)

### Authentication issues:
- Clear browser localStorage
- Create a new account
- Check JWT_SECRET in .env file

### CORS issues:
- Make sure CORS_ORIGIN in .env matches your frontend URL
- Default is http://localhost:3000