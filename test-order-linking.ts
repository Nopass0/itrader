import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { db } from "./src/db";
import { config } from "./src/config";

async function testOrderLinking() {
  console.log("Testing order linking...");
  
  // Database is already initialized
  
  // Initialize Bybit manager
  const bybitManager = new BybitP2PManagerService();
  await bybitManager.initialize();
  
  // Get account
  const accounts = await bybitManager.getActiveAccounts();
  if (accounts.length === 0) {
    console.log("No accounts found");
    return;
  }
  
  const account = accounts[0];
  console.log(`Using account: ${account.accountId}`);
  
  // Get client
  const client = bybitManager.getClient(account.accountId);
  const httpClient = (client as any).httpClient;
  
  // Get specific order details
  const orderId = "1935300744395399168";
  console.log(`\nGetting details for order ${orderId}...`);
  
  try {
    const orderInfo = await httpClient.post("/v5/p2p/order/info", {
      orderId: orderId
    });
    
    if (orderInfo.retCode === 0 && orderInfo.result) {
      const order = orderInfo.result;
      console.log("\nOrder details:");
      console.log(`- ID: ${order.id}`);
      console.log(`- Status: ${order.status}`);
      console.log(`- ItemId: ${order.itemId}`);
      console.log(`- Amount: ${order.amount} ${order.currencyId}`);
      console.log(`- Counterparty: ${order.targetNickName}`);
      
      if (order.itemId) {
        // Check if advertisement exists
        console.log(`\nChecking for advertisement with itemId: ${order.itemId}`);
        const advertisement = await db.getAdvertisementByBybitId(order.itemId);
        
        if (advertisement) {
          console.log(`\n✅ Found advertisement:`);
          console.log(`- ID: ${advertisement.id}`);
          console.log(`- PayoutId: ${advertisement.payoutId}`);
          console.log(`- AccountId: ${advertisement.bybitAccountId}`);
          
          // Check for transaction
          const transactions = await db.getActiveTransactions();
          const transaction = transactions.find(t => t.advertisementId === advertisement.id);
          
          if (transaction) {
            console.log(`\n✅ Found transaction:`);
            console.log(`- ID: ${transaction.id}`);
            console.log(`- OrderId: ${transaction.orderId}`);
            console.log(`- Status: ${transaction.status}`);
            
            if (!transaction.orderId) {
              console.log("\n🔗 Linking order to transaction...");
              await db.updateTransaction(transaction.id, {
                orderId: order.id,
                status: order.status === 10 ? "chat_started" : order.status === 20 ? "waiting_payment" : "processing"
              });
              console.log("✅ Order linked successfully!");
            } else {
              console.log("\n✅ Order already linked");
            }
          } else {
            console.log("\n❌ No transaction found for this advertisement");
          }
        } else {
          console.log(`\n❌ No advertisement found for itemId: ${order.itemId}`);
          
          // List all advertisements
          const allAds = await db.getAdvertisements();
          console.log(`\nAll advertisements in DB (${allAds.length}):`);
          allAds.forEach(ad => {
            console.log(`- bybitAdId: ${ad.bybitAdId}, id: ${ad.id}, payoutId: ${ad.payoutId}`);
          });
        }
      } else {
        console.log("\n❌ Order has no itemId");
      }
    } else {
      console.log("Failed to get order details:", orderInfo);
    }
  } catch (error) {
    console.error("Error:", error);
  }
  
  await db.prisma.$disconnect();
  process.exit(0);
}

testOrderLinking().catch(console.error);