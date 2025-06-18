#!/usr/bin/env bun

/**
 * Check status of receipt loading services
 */

import { PrismaClient } from "./generated/prisma";
import { createLogger } from "./src/logger";

const logger = createLogger("CheckServicesStatus");
const prisma = new PrismaClient();

async function checkServicesStatus() {
  try {
    logger.info("🔍 Checking services status");
    
    // Check Gmail accounts
    const gmailAccounts = await prisma.gmailAccount.findMany();
    logger.info("📧 Gmail accounts", {
      total: gmailAccounts.length,
      active: gmailAccounts.filter(a => a.isActive).length,
      emails: gmailAccounts.map(a => ({ email: a.email, isActive: a.isActive }))
    });
    
    // Check Gate accounts
    const gateAccounts = await prisma.gateAccount.findMany();
    logger.info("🏦 Gate accounts", {
      total: gateAccounts.length,
      active: gateAccounts.filter(a => a.isActive).length,
      accounts: gateAccounts.map(a => ({ email: a.email, accountId: a.accountId, isActive: a.isActive }))
    });
    
    // Check receipts
    const totalReceipts = await prisma.receipt.count();
    const processedReceipts = await prisma.receipt.count({ where: { isProcessed: true } });
    const unprocessedReceipts = await prisma.receipt.count({ where: { isProcessed: false } });
    const todayReceipts = await prisma.receipt.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });
    
    logger.info("📄 Receipts", {
      total: totalReceipts,
      processed: processedReceipts,
      unprocessed: unprocessedReceipts,
      today: todayReceipts
    });
    
    // Check pending payouts
    const pendingPayouts = await prisma.payout.findMany({
      where: { status: 5 },
      include: { transaction: true }
    });
    
    logger.info("💰 Pending payouts", {
      count: pendingPayouts.length,
      payouts: pendingPayouts.map(p => ({
        id: p.id,
        amount: p.amountTrader?.["643"] || p.amount,
        wallet: p.wallet || p.recipientCard,
        hasTransaction: !!p.transaction,
        createdAt: p.createdAt
      }))
    });
    
    // Check recent system logs
    const recentLogs = await prisma.systemLog.findMany({
      where: {
        service: { in: ["ReceiptProcessor", "TinkoffReceiptService"] },
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    
    logger.info("📝 Recent service logs", {
      count: recentLogs.length,
      logs: recentLogs.map(l => ({
        service: l.service,
        level: l.level,
        message: l.message,
        timestamp: l.timestamp
      }))
    });
    
    logger.info("\n📊 Services status check complete");
    
  } catch (error) {
    logger.error("Error checking status", error as Error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServicesStatus()
  .then(() => {
    console.log("\n✅ Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Check failed:", error);
    process.exit(1);
  });