import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function diagnoseChatAutomation() {
  try {
    console.log("=== Chat Automation Diagnostics ===\n");

    // 1. Check time sync
    console.log("1. Checking time sync...");
    if (!TimeSync.isSynchronized()) {
      console.log("   Time not synchronized, syncing...");
      await TimeSync.forceSync();
    }
    console.log(`   ✅ Time synchronized: ${TimeSync.isSynchronized()}`);

    // 2. Initialize services
    console.log("\n2. Initializing services...");
    const bybitManager = new BybitP2PManagerService();
    
    try {
      await bybitManager.initialize();
      console.log("   ✅ BybitP2PManager initialized");
    } catch (error: any) {
      console.error("   ❌ Failed to initialize BybitP2PManager:", error.message);
      if (error.code === "10010") {
        console.log("\n   ⚠️  IP address mismatch. Please check:");
        console.log("      - Your Bybit API key is configured for your current IP");
        console.log("      - Or disable IP restriction in Bybit API settings");
      }
      return;
    }

    const chatService = new ChatAutomationService(bybitManager);
    console.log("   ✅ ChatAutomationService initialized");

    // 3. Check accounts
    console.log("\n3. Checking Bybit accounts...");
    const accounts = await db.getActiveBybitAccounts();
    console.log(`   Found ${accounts.length} accounts`);
    
    for (const account of accounts) {
      console.log(`\n   Account: ${account.accountId}`);
      const client = bybitManager.getClient(account.accountId);
      
      if (!client) {
        console.log("   ❌ No client instance");
        continue;
      }
      
      console.log("   ✅ Client instance exists");
      
      // Test API access
      try {
        const httpClient = (client as any).httpClient;
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 1,
        });
        
        if (response.ret_code === 0) {
          console.log("   ✅ API access OK");
          console.log(`   Orders count: ${response.result?.count || 0}`);
        } else {
          console.log(`   ❌ API error: ${response.ret_msg}`);
        }
      } catch (error: any) {
        console.log(`   ❌ API call failed: ${error.message}`);
      }
    }

    // 4. Check database state
    console.log("\n4. Checking database state...");
    
    const ads = await db.prisma.advertisement.findMany();
    console.log(`   Advertisements: ${ads.length}`);
    
    const transactions = await db.prisma.transaction.findMany({
      include: { chatMessages: true },
    });
    console.log(`   Transactions: ${transactions.length}`);
    
    const activeTransactions = transactions.filter(t => 
      ["pending", "chat_started", "waiting_payment"].includes(t.status)
    );
    console.log(`   Active transactions: ${activeTransactions.length}`);
    
    const transactionsWithOrders = transactions.filter(t => t.orderId);
    console.log(`   Transactions with orders: ${transactionsWithOrders.length}`);

    // 5. Check chat automation readiness
    console.log("\n5. Checking chat automation readiness...");
    
    if (activeTransactions.length === 0) {
      console.log("   ⚠️  No active transactions to process");
    } else {
      for (const tx of activeTransactions) {
        console.log(`\n   Transaction ${tx.id}:`);
        console.log(`   - Status: ${tx.status}`);
        console.log(`   - Order ID: ${tx.orderId || "None"}`);
        console.log(`   - Chat step: ${tx.chatStep}`);
        console.log(`   - Messages: ${tx.chatMessages.length}`);
        
        if (!tx.orderId) {
          console.log("   ⚠️  No order ID - waiting for buyer");
        } else if (tx.chatStep === 0) {
          console.log("   📝 Ready for automation start");
        }
      }
    }

    // 6. Test message processing
    console.log("\n6. Testing message processing...");
    const unprocessedMessages = await db.getUnprocessedChatMessages();
    console.log(`   Unprocessed messages: ${unprocessedMessages.length}`);
    
    if (unprocessedMessages.length > 0) {
      console.log("   Processing messages...");
      await chatService.processUnprocessedMessages();
      console.log("   ✅ Messages processed");
    }

    // 7. Summary
    console.log("\n=== Summary ===");
    const issues = [];
    
    if (accounts.length === 0) {
      issues.push("No Bybit accounts configured");
    }
    
    if (ads.length === 0) {
      issues.push("No advertisements created");
    }
    
    if (activeTransactions.length === 0) {
      issues.push("No active transactions");
    }
    
    if (transactionsWithOrders.length === 0) {
      issues.push("No transactions with orders (no buyers yet)");
    }
    
    if (issues.length === 0) {
      console.log("✅ Chat automation is ready to work!");
      console.log("\nNext steps:");
      console.log("1. Ensure your Bybit API key has correct IP whitelist");
      console.log("2. Create advertisements using the orchestrator");
      console.log("3. Wait for buyers to create orders");
      console.log("4. Chat automation will start automatically");
    } else {
      console.log("❌ Issues found:");
      issues.forEach(issue => console.log(`   - ${issue}`));
      
      console.log("\nTo fix:");
      if (issues.includes("No Bybit accounts configured")) {
        console.log("1. Add Bybit accounts with valid API keys");
      }
      if (issues.includes("No advertisements created")) {
        console.log("2. Create advertisements (ads will be created when Gate payouts are accepted)");
      }
      if (issues.includes("No transactions with orders (no buyers yet)")) {
        console.log("3. Wait for buyers to respond to your advertisements");
      }
    }

  } catch (error) {
    console.error("\nDiagnostics failed:", error);
  } finally {
    await db.disconnect();
  }
}

diagnoseChatAutomation().catch(console.error);