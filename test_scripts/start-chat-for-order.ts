#!/usr/bin/env bun

/**
 * Start chat automation for active orders
 */

import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";

async function main() {
  console.log("🔍 Starting chat automation for active orders...\n");

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('=' .repeat(50));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        const httpClient = (client as any).httpClient;
        
        // Get all orders
        const ordersResult = await client.getOrdersSimplified({
          page: 1,
          size: 20,
        });
        
        console.log(`Found ${ordersResult.count} total orders`);
        
        if (ordersResult.items && ordersResult.items.length > 0) {
          // Filter active orders
          const activeOrders = ordersResult.items.filter(
            (order: any) => order.status === 10 || order.status === 20
          );
          
          console.log(`Active orders (status 10 or 20): ${activeOrders.length}`);
          
          for (const order of activeOrders) {
            console.log(`\n📦 Order: ${order.id}`);
            console.log(`   Status: ${order.status} (${order.status === 10 ? 'Payment in processing' : 'Waiting for coin transfer'})`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Counterparty: ${order.targetNickName}`);
            
            // Get chat messages
            const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
              orderId: order.id,
              size: 10, // Use number, not string
            });
            
            let messages = [];
            if (chatResponse.result && Array.isArray(chatResponse.result)) {
              messages = chatResponse.result;
            } else if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
              messages = chatResponse.result.result;
            }
            
            console.log(`\n   📨 Chat messages (${messages.length} total):`);
            
            // Check who sent messages
            const ourMessages = messages.filter((msg: any) => msg.userId === order.userId);
            const theirMessages = messages.filter((msg: any) => msg.userId !== order.userId);
            
            console.log(`   📊 Our messages: ${ourMessages.length}, Their messages: ${theirMessages.length}`);
            
            // Show last few messages
            for (let i = 0; i < Math.min(3, messages.length); i++) {
              const msg = messages[i];
              const sender = msg.userId === order.userId ? "US" : "THEM";
              console.log(`\n   [${sender}] ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`);
            }
            
            // If no messages from us and order is active (status 10), send initial message
            if (ourMessages.length === 0 && order.status === 10) {
              console.log('\n   🤖 No messages from us - sending initial message...');
              
              try {
                // Create or find transaction
                let transaction = await db.getTransactionByOrderId(order.id);
                
                if (!transaction) {
                  console.log('   Creating transaction...');
                  
                  // Find or create advertisement
                  const ads = await db.getAdvertisements();
                  let ad = ads.find(a => a.bybitAdId === order.itemId);
                  
                  if (!ad) {
                    ad = await db.createAdvertisement({
                      bybitAdId: order.itemId || `temp_${order.id}`,
                      bybitAccountId: account.accountId,
                      side: "SELL",
                      asset: "USDT",
                      fiatCurrency: "RUB",
                      price: order.price || "0",
                      quantity: order.notifyTokenQuantity || "0",
                      minOrderAmount: "100",
                      maxOrderAmount: order.amount || "10000",
                      paymentMethod: "Bank Transfer",
                      status: "ONLINE",
                    });
                    console.log(`   Created advertisement ${ad.id}`);
                  }
                  
                  // Get or create payout
                  const payouts = await db.prisma.payout.findFirst({
                    where: { status: 5 },
                  });
                  
                  let payoutId = payouts?.id;
                  if (!payoutId) {
                    const payout = await db.prisma.payout.create({
                      data: {
                        status: 5,
                        amount: parseFloat(order.amount || "0"),
                        wallet: "temp",
                        gateAccount: account.accountId,
                      },
                    });
                    payoutId = payout.id;
                  }
                  
                  transaction = await db.createTransaction({
                    payoutId: payoutId,
                    advertisementId: ad.id,
                    status: "chat_started",
                  });
                  
                  await db.updateTransaction(transaction.id, {
                    orderId: order.id,
                  });
                  
                  console.log(`   ✅ Created transaction ${transaction.id}`);
                }
                
                // Start chat automation
                console.log('   🚀 Starting chat automation...');
                await chatService.startAutomation(transaction.id);
                console.log('   ✅ Chat automation started!');
                
                // Wait a bit to see the result
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check messages again
                const newChatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
                  orderId: order.id,
                  size: 5,
                });
                
                let newMessages = [];
                if (newChatResponse.result && Array.isArray(newChatResponse.result)) {
                  newMessages = newChatResponse.result;
                } else if (newChatResponse.result?.result && Array.isArray(newChatResponse.result.result)) {
                  newMessages = newChatResponse.result.result;
                }
                
                if (newMessages.length > 0) {
                  const latestMsg = newMessages[0];
                  const sender = latestMsg.userId === order.userId ? "US" : "THEM";
                  console.log(`\n   Latest message [${sender}]: ${latestMsg.message.substring(0, 100)}...`);
                }
                
              } catch (error) {
                console.error(`   ❌ Failed to start automation:`, error);
              }
            } else if (ourMessages.length > 0) {
              console.log('   ✅ We already sent messages to this order');
            }
          }
        } else {
          console.log('\nNo orders found');
        }
        
      } catch (error) {
        console.error(`Error processing account ${account.accountId}:`, error);
      }
    }

    console.log('\n\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

main().catch(console.error);