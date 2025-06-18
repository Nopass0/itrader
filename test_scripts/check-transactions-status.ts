#!/usr/bin/env bun

/**
 * Check status of all transactions and their orders
 */

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";

async function main() {
  console.log("🔍 Checking Transactions and Orders Status\n");

  try {
    // Get all transactions
    const transactions = await db.prisma.transaction.findMany({
      include: {
        advertisement: true,
        payout: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`📊 Total transactions: ${transactions.length}\n`);

    // Group by status
    const byStatus: Record<string, typeof transactions> = {};
    for (const tx of transactions) {
      if (!byStatus[tx.status]) {
        byStatus[tx.status] = [];
      }
      byStatus[tx.status].push(tx);
    }

    // Show summary
    console.log("📈 Transactions by status:");
    for (const [status, txs] of Object.entries(byStatus)) {
      console.log(`  - ${status}: ${txs.length}`);
    }
    console.log();

    // Show transactions without orderId
    const withoutOrder = transactions.filter(tx => !tx.orderId);
    if (withoutOrder.length > 0) {
      console.log(`⚠️  Transactions without orderId: ${withoutOrder.length}`);
      for (const tx of withoutOrder) {
        console.log(`  - ${tx.id}`);
        console.log(`    Status: ${tx.status}`);
        console.log(`    Advertisement: ${tx.advertisementId}`);
        console.log(`    Bybit Ad ID: ${tx.advertisement?.bybitAdId || "N/A"}`);
        console.log(`    Created: ${tx.createdAt.toISOString()}`);
      }
      console.log();
    }

    // Initialize Bybit manager to check orders
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // Get all orders from Bybit
    console.log("🔍 Fetching orders from Bybit...");
    const allOrders = await bybitManager.getAllActiveOrders();
    console.log(`📦 Found ${allOrders.length} orders from Bybit\n`);

    // Group orders by status
    const ordersByStatus: Record<number, typeof allOrders> = {};
    for (const order of allOrders) {
      if (!ordersByStatus[order.status]) {
        ordersByStatus[order.status] = [];
      }
      ordersByStatus[order.status].push(order);
    }

    console.log("📈 Orders by status:");
    for (const [status, orders] of Object.entries(ordersByStatus)) {
      const statusName = getOrderStatusName(parseInt(status));
      console.log(`  - ${status} (${statusName}): ${orders.length}`);
    }
    console.log();

    // Match orders with transactions
    console.log("🔗 Matching orders with transactions:");
    for (const order of allOrders) {
      // Find transaction by orderId
      const txByOrderId = transactions.find(tx => tx.orderId === order.id);
      
      if (txByOrderId) {
        console.log(`✅ Order ${order.id} is linked to transaction ${txByOrderId.id}`);
      } else {
        console.log(`❌ Order ${order.id} has NO linked transaction`);
        console.log(`   Status: ${order.status} (${getOrderStatusName(order.status)})`);
        console.log(`   Item ID: ${order.itemId || "N/A"}`);
        
        // Try to find by itemId
        if (order.itemId) {
          const ad = await db.prisma.advertisement.findUnique({
            where: { bybitAdId: order.itemId },
            include: { transaction: true }
          });
          
          if (ad) {
            console.log(`   📎 Found advertisement for itemId ${order.itemId}`);
            if (ad.transaction) {
              console.log(`   🔗 Has transaction ${ad.transaction.id} but orderId not set!`);
            }
          }
        }
      }
    }

    await db.disconnect();
    console.log("\n✅ Check complete!");

  } catch (error) {
    console.error("❌ Error:", error);
    await db.disconnect();
    process.exit(1);
  }
}

function getOrderStatusName(status: number): string {
  const statusMap: Record<number, string> = {
    5: "Pending",
    10: "Payment Processing",
    20: "Waiting for Coin Transfer",
    30: "Appealing",
    40: "Completed",
    50: "Cancelled",
  };
  return statusMap[status] || "Unknown";
}

main();