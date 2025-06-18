#!/usr/bin/env bun

/**
 * Load all receipts from today
 */

import { PrismaClient } from "./generated/prisma";
import { GmailManager } from "./src/gmail";
import { TinkoffReceiptParser } from "./src/ocr/receiptParser";
import { createLogger } from "./src/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

const logger = createLogger("LoadAllReceipts");
const prisma = new PrismaClient();

async function loadAllReceiptsToday() {
  try {
    logger.info("🔍 Loading all receipts from today");
    
    // Get Gmail account
    const gmailAccount = await prisma.gmailAccount.findFirst({
      where: { isActive: true }
    });
    
    if (!gmailAccount) {
      logger.error("❌ No active Gmail account found");
      return;
    }
    
    // Create Gmail client
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    
    const gmailManager = new GmailManager({
      tokensDir: "./data/gmail-tokens",
      credentials: credentialsContent,
    });
    await gmailManager.initialize();
    
    await gmailManager.addAccountWithTokens({
      refresh_token: gmailAccount.refreshToken,
      access_token: "",
      token_type: "Bearer",
      expiry_date: 0,
      scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    });
    
    const gmailClient = gmailManager.getClient(gmailAccount.email);
    logger.info("✅ Gmail client ready");
    
    // Search for ALL emails from today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    logger.info("📧 Searching for ALL Tinkoff emails from today", {
      from: "noreply@tinkoff.ru",
      after: startOfDay.toISOString()
    });
    
    const searchResult = await gmailClient.getEmailsFromSender("noreply@tinkoff.ru", {
      after: startOfDay,
      maxResults: 100, // Get more emails
    });
    
    const messages = Array.isArray(searchResult) ? searchResult : searchResult.messages;
    
    if (!messages || messages.length === 0) {
      logger.info("❌ No emails from Tinkoff found today");
      return;
    }
    
    logger.info(`✅ Found ${messages.length} emails from Tinkoff today`);
    
    // Check existing receipts
    const existingReceipts = await prisma.receipt.findMany({
      select: { emailId: true }
    });
    const processedEmailIds = new Set(existingReceipts.map(r => r.emailId));
    logger.info(`📊 Already have ${processedEmailIds.size} receipts in database`);
    
    let newReceiptsCount = 0;
    let processedCount = 0;
    
    // Process each email
    for (const message of messages) {
      processedCount++;
      
      if (processedEmailIds.has(message.id)) {
        logger.info(`⏭️  Email ${message.id} already processed (${processedCount}/${messages.length})`);
        continue;
      }
      
      logger.info(`\n📄 Processing email ${message.id} (${processedCount}/${messages.length})...`);
      
      try {
        // Get full message
        const fullMessage = await gmailClient.getMessage(message.id);
        if (!fullMessage) {
          logger.warn("Could not fetch full message");
          continue;
        }
        
        // Get attachments
        const attachments = await gmailClient.getAttachments(message.id);
        const pdfAttachments = attachments.filter(att => 
          att.filename?.toLowerCase().endsWith('.pdf')
        );
        
        if (pdfAttachments.length === 0) {
          logger.info("No PDF attachments found");
          continue;
        }
        
        logger.info(`Found ${pdfAttachments.length} PDF attachments`);
        
        // Process each PDF
        for (const attachment of pdfAttachments) {
          if (!attachment.data) {
            logger.warn("No data in attachment");
            continue;
          }
          
          logger.info(`📎 Processing ${attachment.filename}...`);
          
          // Create PDF buffer
          const pdfBuffer = Buffer.from(attachment.data, 'base64');
          const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
          
          // Check if already processed by hash
          const existingByHash = await prisma.receipt.findUnique({
            where: { fileHash }
          });
          
          if (existingByHash) {
            logger.info("File already processed (duplicate hash)");
            continue;
          }
          
          // Save PDF
          const pdfDir = "data/pdf";
          await fs.mkdir(pdfDir, { recursive: true });
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `${timestamp}_${attachment.filename || 'receipt.pdf'}`;
          const filePath = path.join(pdfDir, fileName);
          
          await fs.writeFile(filePath, pdfBuffer);
          logger.info(`💾 Saved PDF to: ${filePath}`);
          
          // Parse receipt
          const parser = new TinkoffReceiptParser();
          let parsedReceipt;
          
          try {
            parsedReceipt = await parser.parseFromBuffer(pdfBuffer);
            if (parsedReceipt) {
              logger.info("✅ Receipt parsed successfully", {
                amount: parsedReceipt.amount,
                sender: parsedReceipt.sender,
                datetime: parsedReceipt.datetime
              });
            }
          } catch (parseError) {
            logger.error("Failed to parse receipt", parseError as Error);
          }
          
          // Save to database
          const receipt = await prisma.receipt.create({
            data: {
              emailId: message.id,
              emailFrom: fullMessage.from || 'noreply@tinkoff.ru',
              emailSubject: fullMessage.subject || '',
              attachmentName: attachment.filename || 'receipt.pdf',
              filePath,
              fileHash,
              amount: parsedReceipt?.amount || 0,
              bank: "Tinkoff",
              reference: parsedReceipt ? `${parsedReceipt.sender} -> ${
                'recipientName' in parsedReceipt ? parsedReceipt.recipientName :
                'recipientPhone' in parsedReceipt ? parsedReceipt.recipientPhone :
                parsedReceipt.recipientCard
              }` : null,
              transferType: parsedReceipt?.transferType || null,
              status: parsedReceipt ? "SUCCESS" : "FAILED",
              senderName: parsedReceipt?.sender || null,
              recipientName: parsedReceipt && 'recipientName' in parsedReceipt ? parsedReceipt.recipientName : null,
              recipientPhone: parsedReceipt && 'recipientPhone' in parsedReceipt ? parsedReceipt.recipientPhone : null,
              recipientCard: parsedReceipt && 'recipientCard' in parsedReceipt ? parsedReceipt.recipientCard : null,
              recipientBank: parsedReceipt && 'recipientBank' in parsedReceipt ? parsedReceipt.recipientBank : null,
              commission: parsedReceipt?.commission || null,
              transactionDate: parsedReceipt?.datetime || new Date(),
              parsedData: parsedReceipt || { error: "Parse failed" },
              rawText: parser.lastExtractedText || null,
              isProcessed: false
            }
          });
          
          logger.info(`✅ Receipt saved with ID: ${receipt.id}`);
          newReceiptsCount++;
        }
      } catch (error) {
        logger.error(`Error processing email ${message.id}`, error as Error);
      }
    }
    
    logger.info("\n📊 Summary:");
    logger.info(`Total emails found: ${messages.length}`);
    logger.info(`Already processed: ${messages.length - newReceiptsCount}`);
    logger.info(`New receipts saved: ${newReceiptsCount}`);
    
  } catch (error) {
    logger.error("❌ Error loading receipts", error as Error);
  } finally {
    await prisma.$disconnect();
  }
}

loadAllReceiptsToday()
  .then(() => {
    console.log("\n✅ Loading completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Loading failed:", error);
    process.exit(1);
  });