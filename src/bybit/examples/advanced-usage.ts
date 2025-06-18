/**
 * Advanced usage example for Bybit P2P module
 * Demonstrates automation, error handling, and advanced features
 */

import { P2PManager, P2PConfig, P2PEvent, OrderStatus } from '../index';

class P2PAutomation {
  private manager: P2PManager;
  private config: {
    autoRelease: boolean;
    autoReply: boolean;
    maxOrdersPerAccount: number;
    priceAdjustmentInterval: number;
  };

  constructor(manager: P2PManager) {
    this.manager = manager;
    this.config = {
      autoRelease: true,
      autoReply: true,
      maxOrdersPerAccount: 5,
      priceAdjustmentInterval: 60000, // 1 minute
    };

    this.setupEventHandlers();
  }

  /**
   * Setup automated event handlers
   */
  private setupEventHandlers(): void {
    // Handle P2P events
    this.manager.on('p2pEvent', async (event: P2PEvent) => {
      switch (event.type) {
        case 'ORDER_CREATED':
          await this.handleNewOrder(event);
          break;
        case 'ORDER_PAID':
          await this.handleOrderPaid(event);
          break;
        case 'MESSAGE_RECEIVED':
          await this.handleMessage(event);
          break;
      }
    });

    // Handle order updates
    this.manager.on('orderUpdate', async ({ accountId, order }) => {
      console.log(`[${accountId}] Order ${order.orderId} status: ${order.status}`);
      
      // Auto-release logic
      if (this.config.autoRelease && order.status === 'PAID' && order.side === 'SELL') {
        await this.autoReleaseOrder(accountId, order);
      }
    });

    // Handle chat messages
    this.manager.on('chatMessage', async ({ accountId, message }) => {
      if (this.config.autoReply && !message.isRead) {
        await this.autoReplyMessage(accountId, message);
      }
    });
  }

  /**
   * Handle new order creation
   */
  private async handleNewOrder(event: P2PEvent): Promise<void> {
    const { accountId, data } = event;
    console.log(`[${accountId}] New order created:`, data);

    // Send welcome message
    if (this.config.autoReply) {
      await this.manager.sendChatMessage(
        {
          orderId: data.orderId,
          message: 'Welcome! I will process your order shortly. Please follow the payment instructions.',
          messageType: 'TEXT',
        },
        accountId
      );
    }
  }

  /**
   * Handle order payment
   */
  private async handleOrderPaid(event: P2PEvent): Promise<void> {
    const { accountId, data } = event;
    console.log(`[${accountId}] Order ${data.orderId} marked as paid`);

    // Verify payment and auto-release if configured
    if (this.config.autoRelease) {
      // In real implementation, you would verify payment here
      setTimeout(() => {
        this.autoReleaseOrder(accountId, data);
      }, 5000); // Wait 5 seconds before release
    }
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(event: P2PEvent): Promise<void> {
    const { accountId, data: message } = event;
    
    // Parse message for commands
    const lowerMessage = message.content.toLowerCase();
    
    if (lowerMessage.includes('status')) {
      await this.sendOrderStatus(accountId, message.orderId);
    } else if (lowerMessage.includes('help')) {
      await this.sendHelpMessage(accountId, message.orderId);
    }
  }

  /**
   * Auto-release order
   */
  private async autoReleaseOrder(accountId: string, order: any): Promise<void> {
    try {
      console.log(`[${accountId}] Auto-releasing order ${order.orderId}`);
      await this.manager.releaseAssets(order.orderId, accountId);
      
      // Send confirmation message
      await this.manager.sendChatMessage(
        {
          orderId: order.orderId,
          message: 'Assets have been released. Thank you for trading!',
          messageType: 'TEXT',
        },
        accountId
      );
    } catch (error) {
      console.error(`[${accountId}] Failed to auto-release order:`, error);
    }
  }

  /**
   * Auto-reply to messages
   */
  private async autoReplyMessage(accountId: string, message: any): Promise<void> {
    // Don't reply to our own messages
    if (message.senderId === accountId) return;

    const replies = [
      'Thank you for your message. I am processing your request.',
      'Please wait a moment while I handle your order.',
      'I will respond to you shortly.',
    ];

    const randomReply = replies[Math.floor(Math.random() * replies.length)];

    await this.manager.sendChatMessage(
      {
        orderId: message.orderId,
        message: randomReply,
        messageType: 'TEXT',
      },
      accountId
    );
  }

  /**
   * Send order status
   */
  private async sendOrderStatus(accountId: string, orderId: string): Promise<void> {
    try {
      const order = await this.manager.getOrderDetails(orderId, accountId);
      await this.manager.sendChatMessage(
        {
          orderId,
          message: `Order Status: ${order.status}\nAmount: ${order.quantity} ${order.asset}\nTotal: ${order.totalAmount} ${order.fiatCurrency}`,
          messageType: 'TEXT',
        },
        accountId
      );
    } catch (error) {
      console.error(`Failed to send order status:`, error);
    }
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(accountId: string, orderId: string): Promise<void> {
    const helpText = `Available commands:
- "status" - Get order status
- "help" - Show this message
- "payment" - Get payment details

For urgent matters, please contact support.`;

    await this.manager.sendChatMessage(
      {
        orderId,
        message: helpText,
        messageType: 'TEXT',
      },
      accountId
    );
  }

  /**
   * Start price adjustment automation
   */
  startPriceAdjustment(): void {
    setInterval(async () => {
      const accounts = this.manager.getAccounts();
      
      for (const account of accounts) {
        if (!account.isActive) continue;
        
        try {
          await this.adjustPricesForAccount(account.id);
        } catch (error) {
          console.error(`Failed to adjust prices for ${account.id}:`, error);
        }
      }
    }, this.config.priceAdjustmentInterval);
  }

  /**
   * Adjust prices for account based on market
   */
  private async adjustPricesForAccount(accountId: string): Promise<void> {
    const myAds = await this.manager.getMyAdvertisements(accountId);
    
    for (const ad of myAds.list) {
      if (ad.status !== 'ONLINE') continue;
      
      // Get market prices
      const marketAds = await this.manager.getActiveAdvertisements(
        {
          asset: ad.asset,
          fiatCurrency: ad.fiatCurrency,
          side: ad.side === 'BUY' ? 'SELL' : 'BUY',
        },
        accountId
      );
      
      if (marketAds.list.length === 0) continue;
      
      // Calculate competitive price
      const prices = marketAds.list.map(a => parseFloat(a.price));
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      
      let newPrice: number;
      if (ad.side === 'BUY') {
        newPrice = avgPrice * 0.99; // 1% below market for buy
      } else {
        newPrice = avgPrice * 1.01; // 1% above market for sell
      }
      
      // Update if significant difference
      if (Math.abs(parseFloat(ad.price) - newPrice) > 0.001) {
        await this.manager.updateAdvertisement(
          {
            itemId: ad.id,
            price: newPrice.toFixed(2),
          },
          accountId
        );
        console.log(`[${accountId}] Updated ad ${ad.id} price to ${newPrice.toFixed(2)}`);
      }
    }
  }

  /**
   * Monitor account health
   */
  async monitorAccounts(): Promise<void> {
    const accounts = this.manager.getAccounts();
    
    for (const account of accounts) {
      if (!account.isActive) {
        console.warn(`Account ${account.id} is inactive`);
        continue;
      }
      
      // Check pending orders
      const pendingOrders = await this.manager.getPendingOrders(1, 100, account.id);
      if (pendingOrders.total > this.config.maxOrdersPerAccount) {
        console.warn(`[${account.id}] Too many pending orders: ${pendingOrders.total}`);
        
        // Pause advertisements
        const myAds = await this.manager.getMyAdvertisements(account.id);
        for (const ad of myAds.list) {
          if (ad.status === 'ONLINE') {
            await this.manager.updateAdvertisement(
              { itemId: ad.id, status: 'OFFLINE' },
              account.id
            );
          }
        }
      }
    }
  }
}

// Example usage
async function runAdvancedExample() {
  const manager = new P2PManager();
  
  // Add accounts
  const accounts = [
    { id: 'trader1', apiKey: 'key1', apiSecret: 'secret1' },
    { id: 'trader2', apiKey: 'key2', apiSecret: 'secret2' },
  ];
  
  for (const acc of accounts) {
    await manager.addAccount(acc.id, {
      apiKey: acc.apiKey,
      apiSecret: acc.apiSecret,
      testnet: true,
    });
  }
  
  // Create automation instance
  const automation = new P2PAutomation(manager);
  
  // Start automated features
  manager.startOrderPollingAll(5000);
  automation.startPriceAdjustment();
  
  // Monitor accounts every minute
  setInterval(() => {
    automation.monitorAccounts();
  }, 60000);
  
  console.log('P2P automation started. Press Ctrl+C to stop.');
}

// Run if called directly
if (require.main === module) {
  runAdvancedExample().catch(console.error);
}