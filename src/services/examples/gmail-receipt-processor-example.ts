/**
 * Example of using the Gmail Receipt Processor
 * This shows how to integrate the processor into your application
 */

import { GmailReceiptProcessor } from "../GmailReceiptProcessor";
import { GmailManager } from "../../gmail";
import { GateAccountManager } from "../../gate";
import { BybitP2PManagerService } from "../bybitP2PManager";
import { ChatAutomationService } from "../chatAutomation";
import { createLogger } from "../../logger";

const logger = createLogger("GmailReceiptProcessorExample");

async function setupGmailReceiptProcessor() {
  try {
    // Initialize dependencies
    const gmailManager = new GmailManager({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      redirectUri: process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/auth/gmail/callback",
    });

    const gateManager = new GateAccountManager();
    const bybitManager = new BybitP2PManagerService();
    const chatService = new ChatAutomationService(bybitManager);

    // Initialize Gmail accounts from database
    await gmailManager.initializeFromDatabase();

    // Create the Gmail Receipt Processor
    const processor = new GmailReceiptProcessor(
      gmailManager,
      gateManager,
      bybitManager,
      chatService,
      {
        checkInterval: 5 * 60 * 1000, // 5 minutes
        pdfStoragePath: "data/pdf/gmail",
        maxEmailsPerCheck: 50,
        daysToLookBack: 7,
      }
    );

    // Listen to events
    processor.on("processingComplete", (result) => {
      logger.info("Processing complete", result);
    });

    processor.on("receiptMatched", (data) => {
      logger.info("Receipt matched with payout", data);
    });

    processor.on("payoutApproved", (data) => {
      logger.info("Payout approved on Gate", data);
    });

    processor.on("error", (error) => {
      logger.error("Processor error", error);
    });

    // Start the processor
    await processor.start();

    logger.info("Gmail Receipt Processor started successfully");

    // Keep the process running
    process.on("SIGINT", () => {
      logger.info("Shutting down Gmail Receipt Processor...");
      processor.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error("Failed to setup Gmail Receipt Processor", error as Error);
    process.exit(1);
  }
}

// Run the example
if (import.meta.main) {
  setupGmailReceiptProcessor();
}