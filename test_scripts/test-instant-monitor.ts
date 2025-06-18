import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { InstantOrderMonitorService } from "./src/services/instantOrderMonitor";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function testInstantMonitor() {
  try {
    console.log("=== Testing Instant Order Monitor ===\n");

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    // Create and start instant monitor
    const instantMonitor = new InstantOrderMonitorService(bybitManager, chatService);
    
    console.log("Starting Instant Order Monitor...");
    await instantMonitor.start();
    
    console.log("\nMonitor is running. Press Ctrl+C to stop.");
    console.log("It will check for orders every second.\n");
    
    // Keep alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error("Failed:", error);
  }
}

testInstantMonitor().catch(console.error);