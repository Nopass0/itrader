#!/usr/bin/env bun

/**
 * Check Gmail for Tinkoff receipts
 */

import { PrismaClient } from "./generated/prisma";
import { GmailManager } from "./src/gmail";
import { createLogger } from "./src/logger";
import * as fs from "fs/promises";
import * as path from "path";

const logger = createLogger("CheckGmailReceipts");
const prisma = new PrismaClient();

async function checkGmailReceipts() {
  try {
    logger.info("🔍 Checking Gmail for Tinkoff receipts");
    
    // Get Gmail account
    const gmailAccount = await prisma.gmailAccount.findFirst({
      where: { isActive: true }
    });
    
    if (!gmailAccount) {
      logger.error("❌ No active Gmail account found");
      return;
    }
    
    logger.info("✅ Found Gmail account", { email: gmailAccount.email });
    
    // Load credentials and create manager
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    
    const gmailManager = new GmailManager({
      tokensDir: "./data/gmail-tokens",
      credentials: credentialsContent,
    });
    await gmailManager.initialize();
    
    // Add account
    const tokens = {
      refresh_token: gmailAccount.refreshToken,
      access_token: "",
      token_type: "Bearer",
      expiry_date: 0,
      scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    };
    
    await gmailManager.addAccountWithTokens(tokens);
    const gmailClient = gmailManager.getClient(gmailAccount.email);
    
    // Search for emails from beginning of today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    logger.info("📧 Searching for emails", {
      from: "noreply@tinkoff.ru",
      after: startOfDay.toISOString(),
      hasAttachment: true
    });
    
    // Try both search methods
    logger.info("\n1️⃣ Using getEmails method:");
    try {
      const result1 = await gmailClient.getEmails({
        from: "noreply@tinkoff.ru",
        after: startOfDay,
        hasAttachment: true,
      });
      const messages1 = result1.messages || [];
      logger.info("Found emails", { count: messages1.length });
      
      if (messages1.length > 0) {
        for (const msg of messages1.slice(0, 5)) {
          logger.info("Email", { id: msg.id, threadId: msg.threadId });
        }
      }
    } catch (error) {
      logger.error("Error with getEmails", error as Error);
    }
    
    logger.info("\n2️⃣ Using getEmailsFromSender method:");
    try {
      const result2 = await gmailClient.getEmailsFromSender("noreply@tinkoff.ru", {
        after: startOfDay,
        maxResults: 50,
      });
      const messages2 = Array.isArray(result2) ? result2 : result2.messages;
      logger.info("Found emails", { count: messages2?.length || 0 });
      
      if (messages2 && messages2.length > 0) {
        for (const msg of messages2.slice(0, 5)) {
          logger.info("Email", { id: msg.id });
        }
      }
    } catch (error) {
      logger.error("Error with getEmailsFromSender", error as Error);
    }
    
    // Check existing receipts in database
    logger.info("\n📊 Checking existing receipts in database:");
    const existingReceipts = await prisma.receipt.findMany({
      where: {
        createdAt: {
          gte: startOfDay
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    logger.info("Receipts in database today", { count: existingReceipts.length });
    
    // Check which emails are already processed
    const processedEmailIds = new Set(existingReceipts.map(r => r.emailId));
    logger.info("Processed email IDs", { count: processedEmailIds.size });
    
    // Check for specific period
    logger.info("\n🕐 Checking for emails in last 2 hours:");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    try {
      const result3 = await gmailClient.getEmailsFromSender("noreply@tinkoff.ru", {
        after: twoHoursAgo,
        maxResults: 50,
      });
      const messages3 = Array.isArray(result3) ? result3 : result3.messages;
      logger.info("Found emails in last 2 hours", { count: messages3?.length || 0 });
    } catch (error) {
      logger.error("Error checking last 2 hours", error as Error);
    }
    
    logger.info("\n✅ Gmail check completed");
    
  } catch (error) {
    logger.error("❌ Error checking Gmail", error as Error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGmailReceipts()
  .then(() => {
    console.log("\n✅ Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Check failed:", error);
    process.exit(1);
  });