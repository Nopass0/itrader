#!/usr/bin/env node
import { db } from "./src/db";
import { createLogger } from "./src/logger";

const logger = createLogger("DebugOrchestrator");

async function debugOrchestratorTasks() {
  console.log("🔍 Debug Orchestrator Tasks");
  console.log("========================");
  console.log(`Time: ${new Date().toISOString()}\n`);

  try {
    // 1. Check recent system logs for orchestrator activity
    console.log("📋 Recent System Logs (last 50):");
    console.log("--------------------------------");
    
    const recentLogs = await db.prisma.systemLog.findMany({
      where: {
        isSystem: true,
        service: {
          in: ["Orchestrator", "ChatProcessor", "ChatAutomation", "Main"]
        }
      },
      orderBy: { timestamp: "desc" },
      take: 50
    });

    if (recentLogs.length === 0) {
      console.log("❌ No system logs found for Orchestrator/ChatProcessor");
    } else {
      // Group logs by service
      const logsByService = recentLogs.reduce((acc, log) => {
        if (!acc[log.service]) acc[log.service] = [];
        acc[log.service].push(log);
        return acc;
      }, {} as Record<string, typeof recentLogs>);

      for (const [service, logs] of Object.entries(logsByService)) {
        console.log(`\n📁 ${service} (${logs.length} logs):`);
        
        // Show last 5 logs for each service
        for (const log of logs.slice(0, 5)) {
          const time = new Date(log.timestamp).toLocaleTimeString();
          console.log(`  [${time}] ${log.level}: ${log.message}`);
          if (log.data) {
            console.log(`    Data: ${JSON.stringify(log.data, null, 2).split('\n').join('\n    ')}`);
          }
        }
      }
    }

    // 2. Check for chat_processor specific logs
    console.log("\n\n🤖 Chat Processor Activity:");
    console.log("---------------------------");
    
    const chatProcessorLogs = await db.prisma.systemLog.findMany({
      where: {
        OR: [
          { service: "ChatProcessor" },
          { module: "chat_processor" },
          { message: { contains: "chat_processor" } },
          { message: { contains: "ChatProcessor" } }
        ]
      },
      orderBy: { timestamp: "desc" },
      take: 20
    });

    if (chatProcessorLogs.length === 0) {
      console.log("❌ No chat processor logs found at all!");
      console.log("   This suggests the task might not be running.");
    } else {
      console.log(`✅ Found ${chatProcessorLogs.length} chat processor logs`);
      
      // Show timing analysis
      const now = Date.now();
      const latestLog = chatProcessorLogs[0];
      const timeSinceLastLog = now - new Date(latestLog.timestamp).getTime();
      console.log(`\n⏰ Latest log was ${Math.round(timeSinceLastLog / 1000)}s ago`);
      
      if (timeSinceLastLog > 10000) { // More than 10 seconds
        console.log("   ⚠️  WARNING: Chat processor should run every 1-2 seconds!");
      }
      
      // Show recent activity
      console.log("\nRecent activity:");
      for (const log of chatProcessorLogs.slice(0, 5)) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        console.log(`  [${time}] ${log.message}`);
      }
    }

    // 3. Check for unprocessed messages
    console.log("\n\n💬 Unprocessed Messages:");
    console.log("-----------------------");
    
    const unprocessedMessages = await db.prisma.chatMessage.findMany({
      where: {
        isProcessed: false
      },
      include: {
        transaction: {
          include: {
            advertisement: true,
            payout: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    if (unprocessedMessages.length === 0) {
      console.log("✅ No unprocessed messages found");
    } else {
      console.log(`⚠️  Found ${unprocessedMessages.length} unprocessed messages!`);
      
      for (const msg of unprocessedMessages) {
        const timeSince = Date.now() - new Date(msg.createdAt).getTime();
        console.log(`\n  Message ID: ${msg.id}`);
        console.log(`  Transaction: ${msg.transactionId}`);
        console.log(`  Sender: ${msg.sender}`);
        console.log(`  Transaction Status: ${msg.transaction?.status || 'N/A'}`);
        console.log(`  Created: ${Math.round(timeSince / 1000)}s ago`);
        console.log(`  Content: "${msg.content.substring(0, 50)}..."`);
      }
    }

    // 4. Check active transactions
    console.log("\n\n🔄 Active Transactions:");
    console.log("----------------------");
    
    const activeTransactions = await db.prisma.transaction.findMany({
      where: {
        status: { in: ["chat_started", "waiting_payment", "processing"] }
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    console.log(`Found ${activeTransactions.length} active transactions`);
    
    for (const tx of activeTransactions) {
      const lastMessage = tx.chatMessages[0];
      const timeSinceLastMessage = lastMessage 
        ? Date.now() - new Date(lastMessage.createdAt).getTime()
        : null;
      
      console.log(`\n  Transaction ${tx.id}:`);
      console.log(`    Status: ${tx.status}`);
      console.log(`    Order ID: ${tx.orderId || "N/A"}`);
      console.log(`    Chat Step: ${tx.chatStep}`);
      
      if (lastMessage) {
        console.log(`    Last message: ${Math.round(timeSinceLastMessage! / 1000)}s ago`);
      } else {
        console.log(`    No messages yet`);
      }
    }

    // 5. Check orchestrator state file
    console.log("\n\n📁 Orchestrator State:");
    console.log("---------------------");
    
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const stateFile = path.join(process.cwd(), "orchestrator-state.json");
      
      const stateExists = await fs.access(stateFile).then(() => true).catch(() => false);
      
      if (stateExists) {
        const state = JSON.parse(await fs.readFile(stateFile, "utf-8"));
        console.log(`  Paused: ${state.isPaused}`);
        console.log(`  Started: ${state.startTime ? new Date(state.startTime).toLocaleString() : "N/A"}`);
        console.log(`  Tasks: ${state.tasks?.length || 0}`);
        
        // Find chat_processor task
        const chatProcessorTask = state.tasks?.find((t: any) => t.id === "chat_processor");
        if (chatProcessorTask) {
          console.log(`\n  Chat Processor Task:`);
          console.log(`    Status: ${chatProcessorTask.status}`);
          console.log(`    Enabled: ${chatProcessorTask.enabled}`);
          console.log(`    Execution Count: ${chatProcessorTask.executionCount}`);
          console.log(`    Last Execution: ${chatProcessorTask.lastExecutionTime ? new Date(chatProcessorTask.lastExecutionTime).toLocaleString() : "Never"}`);
          console.log(`    Next Execution: ${chatProcessorTask.nextExecutionTime ? new Date(chatProcessorTask.nextExecutionTime).toLocaleString() : "N/A"}`);
        } else {
          console.log("  ❌ chat_processor task not found in state!");
        }
      } else {
        console.log("  ❌ No orchestrator state file found");
      }
    } catch (error) {
      console.log(`  ❌ Error reading state: ${error.message}`);
    }

    // 6. Summary and recommendations
    console.log("\n\n📊 Summary:");
    console.log("-----------");
    
    const issues = [];
    
    if (chatProcessorLogs.length === 0) {
      issues.push("No chat processor logs found - task might not be running");
    } else if (chatProcessorLogs[0] && Date.now() - new Date(chatProcessorLogs[0].timestamp).getTime() > 10000) {
      issues.push("Chat processor hasn't run recently (should run every 1s)");
    }
    
    if (unprocessedMessages.length > 0) {
      issues.push(`${unprocessedMessages.length} unprocessed messages found`);
    }
    
    if (issues.length === 0) {
      console.log("✅ Everything appears to be working correctly!");
    } else {
      console.log("❌ Issues found:");
      for (const issue of issues) {
        console.log(`  - ${issue}`);
      }
      
      console.log("\n💡 Recommendations:");
      console.log("  1. Check if the orchestrator is running: look for 'Orchestrator started' in logs");
      console.log("  2. Check if the app crashed after initialization");
      console.log("  3. Look for any error logs that might indicate why chat_processor stopped");
      console.log("  4. Try restarting the application");
    }

  } catch (error) {
    console.error("Error during debug:", error);
    logger.error("Debug script error", error as Error);
  } finally {
    await db.disconnect();
  }
}

// Run the debug script
debugOrchestratorTasks().catch(console.error);