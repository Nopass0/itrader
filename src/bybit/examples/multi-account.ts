/**
 * Multi-account usage example for Bybit P2P module
 */

import { P2PManager, P2PConfig } from '../index';

async function multiAccountExample() {
  // 1. Create P2P manager
  const manager = new P2PManager();

  // 2. Setup manager event listeners
  manager.on('accountAdded', ({ accountId, isActive }) => {
    console.log(`Account ${accountId} added (active: ${isActive})`);
  });

  manager.on('accountConnected', ({ accountId }) => {
    console.log(`Account ${accountId} connected`);
  });

  manager.on('accountDisconnected', ({ accountId }) => {
    console.log(`Account ${accountId} disconnected`);
  });

  manager.on('accountError', ({ accountId, error }) => {
    console.error(`Account ${accountId} error:`, error);
  });

  manager.on('p2pEvent', (event) => {
    console.log(`P2P Event from ${event.accountId}:`, event);
  });

  manager.on('orderUpdate', ({ accountId, order }) => {
    console.log(`Order update from ${accountId}:`, order);
  });

  manager.on('chatMessage', ({ accountId, message }) => {
    console.log(`Chat message from ${accountId}:`, message);
  });

  try {
    // 3. Add multiple accounts
    const accounts = [
      {
        id: 'account1',
        config: {
          apiKey: 'api-key-1',
          apiSecret: 'api-secret-1',
          testnet: true,
          debugMode: false,
        },
      },
      {
        id: 'account2',
        config: {
          apiKey: 'api-key-2',
          apiSecret: 'api-secret-2',
          testnet: true,
          debugMode: false,
        },
      },
      {
        id: 'account3',
        config: {
          apiKey: 'api-key-3',
          apiSecret: 'api-secret-3',
          testnet: true,
          debugMode: false,
        },
      },
    ];

    // Add accounts
    for (const account of accounts) {
      await manager.addAccount(account.id, account.config as P2PConfig);
    }

    // 4. Get all accounts
    const allAccounts = manager.getAccounts();
    console.log('All accounts:', allAccounts);

    // 5. Switch active account
    manager.switchAccount('account2');
    console.log('Switched to account2');

    // 6. Get advertisements from all accounts
    const allAds = await manager.getActiveAdvertisements({
      asset: 'USDT',
      fiatCurrency: 'USD',
    });
    console.log('Ads from all accounts:', allAds.total);

    // 7. Get advertisements from specific account
    const account1Ads = await manager.getActiveAdvertisements(
      { asset: 'USDT' },
      'account1'
    );
    console.log('Ads from account1:', account1Ads.total);

    // 8. Create advertisement on specific account
    const newAd = await manager.createAdvertisement(
      {
        side: 'BUY',
        asset: 'USDT',
        fiatCurrency: 'EUR',
        priceType: 'FLOAT',
        floatRate: 0.01, // 1% above market
        quantity: '500',
        minOrderAmount: '50',
        maxOrderAmount: '500',
        paymentIds: ['payment-method-id'],
        remarks: 'Quick trade, experienced trader',
      },
      'account1'
    );
    console.log('Created ad on account1:', newAd.id);

    // 9. Get orders from all accounts
    const allOrders = await manager.getOrders();
    console.log('Orders from all accounts:', allOrders.total);

    // 10. Start order polling for all accounts
    manager.startOrderPollingAll(10000); // Poll every 10 seconds

    // 11. Handle orders by account
    for (const account of allAccounts) {
      if (!account.isActive) continue;

      const pendingOrders = await manager.getPendingOrders(1, 20, account.id);
      console.log(`Account ${account.id} has ${pendingOrders.total} pending orders`);

      // Process first order for each account
      if (pendingOrders.list.length > 0) {
        const order = pendingOrders.list[0];
        
        // Start chat polling for this order
        manager.startChatPolling(order.orderId, 3000, account.id);

        // Send automated message
        await manager.sendChatMessage(
          {
            orderId: order.orderId,
            message: `Auto-reply from ${account.id}: Processing your order...`,
            messageType: 'TEXT',
          },
          account.id
        );
      }
    }

    // 12. Manage advertisements across accounts
    const updatePromises = allAccounts
      .filter(acc => acc.isActive)
      .map(async (account) => {
        const myAds = await manager.getMyAdvertisements(account.id);
        
        // Update all online ads
        for (const ad of myAds.list) {
          if (ad.status === 'ONLINE') {
            await manager.updateAdvertisement(
              {
                itemId: ad.id,
                status: 'OFFLINE', // Take offline
              },
              account.id
            );
            console.log(`Took ad ${ad.id} offline on ${account.id}`);
          }
        }
      });

    await Promise.all(updatePromises);

    // 13. Get payment methods for all accounts
    for (const account of allAccounts) {
      if (!account.isActive) continue;
      
      const methods = await manager.getPaymentMethods(account.id);
      console.log(`Account ${account.id} has ${methods.length} payment methods`);
    }

    // 14. Monitor for 2 minutes
    setTimeout(() => {
      // Stop all polling
      manager.stopAllPolling();
      
      // Disconnect all accounts
      manager.disconnectAll();
      
      console.log('All accounts disconnected after 2 minutes');
    }, 120000);

  } catch (error) {
    console.error('Error:', error);
    manager.disconnectAll();
  }
}

// Run the example
if (require.main === module) {
  multiAccountExample().catch(console.error);
}