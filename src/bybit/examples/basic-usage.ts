/**
 * Basic usage example for Bybit P2P module
 */

import { P2PClient, P2PConfig } from '../index';

async function basicExample() {
  // 1. Create P2P client configuration
  const config: P2PConfig = {
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret',
    testnet: true, // Use testnet for testing
    debugMode: true,
  };

  // 2. Create P2P client
  const client = new P2PClient(config);

  // 3. Setup event listeners
  client.on('connected', () => {
    console.log('Connected to P2P service');
  });

  client.on('disconnected', () => {
    console.log('Disconnected from P2P service');
  });

  client.on('error', (error) => {
    console.error('P2P Error:', error);
  });

  client.on('p2pEvent', (event) => {
    console.log('P2P Event:', event);
  });

  client.on('orderUpdate', (order) => {
    console.log('Order Update:', order);
  });

  client.on('chatMessage', (message) => {
    console.log('New Chat Message:', message);
  });

  try {
    // 4. Connect to P2P service
    await client.connect();

    // 5. Get account info
    const accountInfo = await client.getAccountInfo();
    console.log('Account Info:', accountInfo);

    // 6. Get active advertisements
    const ads = await client.getActiveAdvertisements({
      asset: 'USDT',
      fiatCurrency: 'USD',
      side: 'BUY',
    });
    console.log('Active Ads:', ads);

    // 7. Get my advertisements
    const myAds = await client.getMyAdvertisements();
    console.log('My Ads:', myAds);

    // 8. Create a new advertisement
    const newAd = await client.createAdvertisement({
      side: 'SELL',
      asset: 'USDT',
      fiatCurrency: 'USD',
      priceType: 'FIXED',
      price: '1.02',
      quantity: '1000',
      minOrderAmount: '10',
      maxOrderAmount: '500',
      paymentIds: ['payment-method-id'],
      remarks: 'Fast trade, instant release',
      autoReply: 'Thank you for trading!',
    });
    console.log('Created Ad:', newAd);

    // 9. Get pending orders
    const pendingOrders = await client.getPendingOrders();
    console.log('Pending Orders:', pendingOrders);

    // 10. Start order polling (WebSocket simulation)
    client.startOrderPolling(5000); // Poll every 5 seconds

    // 11. Handle a specific order
    if (pendingOrders.list.length > 0) {
      const order = pendingOrders.list[0];
      
      // Get order details
      const orderDetails = await client.getOrderDetails(order.orderId);
      console.log('Order Details:', orderDetails);

      // Get chat messages
      const messages = await client.getChatMessages(order.orderId);
      console.log('Chat Messages:', messages);

      // Send a message
      const sentMessage = await client.sendChatMessage({
        orderId: order.orderId,
        message: 'Hello, I am ready to complete this trade.',
        messageType: 'TEXT',
      });
      console.log('Sent Message:', sentMessage);

      // Start chat polling for this order
      client.startChatPolling(order.orderId, 3000);

      // Mark order as paid (if buyer)
      if (order.side === 'BUY') {
        await client.markOrderAsPaid(order.orderId);
        console.log('Order marked as paid');
      }

      // Release assets (if seller)
      if (order.side === 'SELL' && order.status === 'PAID') {
        await client.releaseAssets(order.orderId);
        console.log('Assets released');
      }
    }

    // 12. Get payment methods
    const paymentMethods = await client.getPaymentMethods();
    console.log('Payment Methods:', paymentMethods);

    // Keep the connection alive for 1 minute
    setTimeout(() => {
      client.disconnect();
      console.log('Disconnected after 1 minute');
    }, 60000);

  } catch (error) {
    console.error('Error:', error);
    client.disconnect();
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}