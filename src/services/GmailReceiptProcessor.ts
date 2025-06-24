/**
 * Gmail Receipt Processor Service
 * Searches for Tinkoff receipt emails, parses PDFs, matches with payouts, and auto-approves on Gate
 */

import { EventEmitter } from "events";
import { PrismaClient } from "../../generated/prisma";
import { GmailManager } from "../gmail";
import { TinkoffReceiptParser, ParsedReceipt } from "../ocr/receiptParser";
import { GateAccountManager } from "../gate";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { ChatAutomationService } from "./chatAutomation";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { createLogger } from "../logger";

const logger = createLogger("GmailReceiptProcessor");

interface GmailReceiptProcessorConfig {
  checkInterval?: number; // Check interval in milliseconds (default: 5 minutes)
  pdfStoragePath?: string; // Path to store PDF files
  maxEmailsPerCheck?: number; // Max emails to process per check
  daysToLookBack?: number; // How many days to look back for emails
}

interface ProcessingResult {
  totalEmails: number;
  processedEmails: number;
  newReceipts: number;
  matchedReceipts: number;
  approvedPayouts: number;
  errors: Array<{ emailId: string; error: string }>;
}

export class GmailReceiptProcessor extends EventEmitter {
  private prisma: PrismaClient;
  private config: Required<GmailReceiptProcessorConfig>;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private isProcessing = false;
  private parser: TinkoffReceiptParser;
  private processingTransactions = new Set<string>();
  private io?: any; // WebSocket server instance

  constructor(
    private gmailManager: GmailManager,
    private gateManager: GateAccountManager,
    private bybitManager: BybitP2PManagerService,
    private chatService: ChatAutomationService,
    config: GmailReceiptProcessorConfig = {},
    io?: any,
  ) {
    super();

    this.prisma = new PrismaClient();
    this.io = io;
    this.parser = new TinkoffReceiptParser();

    this.config = {
      checkInterval: config.checkInterval || 5 * 60 * 1000, // 5 minutes
      pdfStoragePath: config.pdfStoragePath || "data/pdf",
      maxEmailsPerCheck: config.maxEmailsPerCheck || 50,
      daysToLookBack: config.daysToLookBack || 7,
    };

    logger.info("GmailReceiptProcessor initialized", {
      checkInterval: this.config.checkInterval,
      pdfStoragePath: this.config.pdfStoragePath,
      maxEmailsPerCheck: this.config.maxEmailsPerCheck,
      daysToLookBack: this.config.daysToLookBack,
    });
  }

  /**
   * Start the Gmail receipt processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Gmail receipt processor already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting Gmail receipt processor...");

    // Ensure PDF storage directory exists
    await this.ensureStorageDirectory();

    // Run initial check
    await this.processAllAccounts();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.processAllAccounts().catch((error) => {
        logger.error("Error in scheduled processing", error as Error);
      });
    }, this.config.checkInterval);

    logger.info("Gmail receipt processor started successfully", {
      checkIntervalMinutes: this.config.checkInterval / 60000,
    });
  }

  /**
   * Stop the processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    logger.info("Gmail receipt processor stopped");
  }

  /**
   * Process receipts from all active Gmail accounts
   */
  private async processAllAccounts(): Promise<void> {
    if (this.isProcessing) {
      logger.info("Already processing, skipping this cycle");
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    logger.info("========= STARTING GMAIL RECEIPT PROCESSING =========", {
      timestamp: new Date().toISOString(),
      localTime: new Date().toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
      }),
    });

    try {
      // Get all active Gmail accounts
      const gmailAccounts = await this.prisma.gmailAccount.findMany({
        where: { isActive: true },
      });

      logger.info("Found active Gmail accounts", {
        count: gmailAccounts.length,
        accounts: gmailAccounts.map((a) => a.email),
      });

      const overallResult: ProcessingResult = {
        totalEmails: 0,
        processedEmails: 0,
        newReceipts: 0,
        matchedReceipts: 0,
        approvedPayouts: 0,
        errors: [],
      };

      // Process each account
      for (const account of gmailAccounts) {
        try {
          logger.info("Processing Gmail account", { email: account.email });

          const accountResult = await this.processAccount(account.email);

          // Merge results
          overallResult.totalEmails += accountResult.totalEmails;
          overallResult.processedEmails += accountResult.processedEmails;
          overallResult.newReceipts += accountResult.newReceipts;
          overallResult.matchedReceipts += accountResult.matchedReceipts;
          overallResult.approvedPayouts += accountResult.approvedPayouts;
          overallResult.errors.push(...accountResult.errors);

          // Update last sync time
          await this.prisma.gmailAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });
        } catch (error) {
          logger.error("Error processing Gmail account", error as Error, {
            email: account.email,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info("✅ Gmail receipt processing complete", {
        ...overallResult,
        processingTimeMs: processingTime,
        processingTimeSeconds: Math.round(processingTime / 1000),
      });

      // Emit processing complete event
      this.emit("processingComplete", overallResult);
    } catch (error) {
      logger.error("Fatal error in processAllAccounts", error as Error);
    } finally {
      this.isProcessing = false;
      logger.info("========= GMAIL RECEIPT PROCESSING FINISHED =========");
    }
  }

  /**
   * Process receipts from a single Gmail account
   */
  private async processAccount(email: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      totalEmails: 0,
      processedEmails: 0,
      newReceipts: 0,
      matchedReceipts: 0,
      approvedPayouts: 0,
      errors: [],
    };

    try {
      const gmailClient = this.gmailManager.getClient(email);
      if (!gmailClient) {
        logger.error("Gmail client not found", { email });
        return result;
      }

      // Search for Tinkoff receipt emails
      const searchDate = new Date();
      searchDate.setDate(searchDate.getDate() - this.config.daysToLookBack);

      logger.info("Searching for Tinkoff emails", {
        email,
        from: "noreply@tinkoff.ru",
        after: searchDate.toISOString(),
        hasAttachment: true,
      });

      const searchResult = await gmailClient.getEmails({
        from: "noreply@tinkoff.ru",
        after: searchDate,
        hasAttachment: true,
        maxResults: this.config.maxEmailsPerCheck,
      });

      const messages = searchResult.messages || [];
      result.totalEmails = messages.length;

      logger.info("Found Tinkoff emails", {
        email,
        count: messages.length,
      });

      // Process each message
      for (const message of messages) {
        try {
          const processResult = await this.processMessage(
            gmailClient,
            message.id,
          );

          if (processResult) {
            result.processedEmails++;
            if (processResult.isNew) {
              result.newReceipts++;
            }
            if (processResult.matched) {
              result.matchedReceipts++;
            }
            if (processResult.approved) {
              result.approvedPayouts++;
            }
          }
        } catch (error) {
          logger.error("Error processing message", error as Error, {
            messageId: message.id,
          });
          result.errors.push({
            emailId: message.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } catch (error) {
      logger.error("Error processing account", error as Error, { email });
    }

    return result;
  }

  /**
   * Process a single email message
   */
  private async processMessage(
    gmailClient: any,
    messageId: string,
  ): Promise<{ isNew: boolean; matched: boolean; approved: boolean } | null> {
    logger.info("Processing message", { messageId });

    // Check if already processed
    const existingReceipt = await this.prisma.receipt.findUnique({
      where: { emailId: messageId },
    });

    if (existingReceipt) {
      logger.info("Email already processed", {
        messageId,
        receiptId: existingReceipt.id,
      });

      // If receipt exists but has no payout, try to match it
      if (!existingReceipt.payoutId) {
        const matchResult =
          await this.tryMatchAndApproveReceipt(existingReceipt);
        return {
          isNew: false,
          matched: matchResult.matched,
          approved: matchResult.approved,
        };
      }

      return { isNew: false, matched: false, approved: false };
    }

    // Get message details
    const messageDetails = await gmailClient.getMessage(messageId);
    const subject =
      messageDetails.payload?.headers?.find((h: any) => h.name === "Subject")
        ?.value || "";
    const from =
      messageDetails.payload?.headers?.find((h: any) => h.name === "From")
        ?.value || "";
    const date =
      messageDetails.payload?.headers?.find((h: any) => h.name === "Date")
        ?.value || "";

    logger.info("Email details", {
      messageId,
      subject,
      from,
      date,
    });

    // Get attachments
    const attachments = await gmailClient.getAttachments(messageId);
    const pdfAttachment = attachments.find((att: any) =>
      att.filename?.toLowerCase().endsWith(".pdf"),
    );

    if (!pdfAttachment || !pdfAttachment.data) {
      logger.warn("No PDF attachment found", { messageId });
      return null;
    }

    // Process the receipt
    const pdfBuffer = Buffer.from(pdfAttachment.data, "base64");
    const receipt = await this.createReceiptFromPdf(
      messageId,
      from,
      subject,
      pdfAttachment.filename,
      pdfBuffer,
    );

    if (receipt) {
      const matchResult = await this.tryMatchAndApproveReceipt(receipt);
      return {
        isNew: true,
        matched: matchResult.matched,
        approved: matchResult.approved,
      };
    }

    return { isNew: true, matched: false, approved: false };
  }

  /**
   * Create receipt record from PDF
   */
  private async createReceiptFromPdf(
    emailId: string,
    emailFrom: string,
    emailSubject: string,
    attachmentName: string,
    pdfBuffer: Buffer,
  ): Promise<any> {
    try {
      // Calculate file hash
      const fileHash = crypto.createHash("md5").update(pdfBuffer).digest("hex");

      // Save PDF file
      const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}_${fileHash.substring(0, 8)}.pdf`;
      const filePath = path.join(this.config.pdfStoragePath, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      logger.info("Saved PDF file", { filePath, fileHash });

      // Parse receipt
      let parsedReceipt: ParsedReceipt | null = null;
      let parseError: string | null = null;
      let rawText: string | null = null;

      try {
        parsedReceipt = await this.parser.parseFromBuffer(pdfBuffer);
        rawText = this.parser.lastExtractedText;

        logger.info("Receipt parsed successfully", {
          amount: parsedReceipt.amount,
          sender: parsedReceipt.sender,
          transferType: parsedReceipt.transferType,
          datetime: parsedReceipt.datetime,
        });
      } catch (error) {
        parseError =
          error instanceof Error ? error.message : "Unknown parsing error";
        logger.error("Failed to parse receipt", error as Error);
      }

      // Create receipt record
      const receipt = await this.prisma.receipt.create({
        data: {
          emailId,
          emailFrom,
          emailSubject,
          attachmentName,
          filePath,
          fileHash,
          amount: parsedReceipt?.amount || 0,
          bank: "Tinkoff",
          reference: parsedReceipt ? this.buildReference(parsedReceipt) : null,
          transferType: parsedReceipt?.transferType || null,
          status: parsedReceipt ? "SUCCESS" : "FAILED",
          senderName: parsedReceipt?.sender || null,
          recipientName: this.getRecipientName(parsedReceipt),
          recipientPhone: this.getRecipientPhone(parsedReceipt),
          recipientCard: this.getRecipientCard(parsedReceipt),
          recipientBank: this.getRecipientBank(parsedReceipt),
          commission: parsedReceipt?.commission || null,
          transactionDate: parsedReceipt?.datetime || new Date(),
          parsedData: parsedReceipt || { error: parseError },
          rawText,
          isProcessed: false,
        },
      });

      logger.info("Receipt created", {
        receiptId: receipt.id,
        status: receipt.status,
        amount: receipt.amount,
      });

      // Emit WebSocket event for real-time updates
      if (this.io) {
        this.io.emit("receipts:new", {
          receipt: {
            id: receipt.id,
            amount: receipt.amount,
            senderName: receipt.senderName,
            recipientName: receipt.recipientName,
            recipientPhone: receipt.recipientPhone,
            recipientCard: receipt.recipientCard,
            transactionDate: receipt.transactionDate,
            status: receipt.status,
            fileHash: receipt.fileHash,
            bank: receipt.bank,
            reference: receipt.reference,
            createdAt: receipt.createdAt,
          },
        });
      }

      return receipt;
    } catch (error) {
      logger.error("Error creating receipt from PDF", error as Error);
      return null;
    }
  }

  /**
   * Try to match receipt with payout and approve on Gate
   */
  private async tryMatchAndApproveReceipt(
    receipt: any,
  ): Promise<{ matched: boolean; approved: boolean }> {
    if (receipt.status !== "SUCCESS" || receipt.amount <= 0) {
      logger.info("Skipping receipt matching", {
        receiptId: receipt.id,
        reason: receipt.status !== "SUCCESS" ? "Not successful" : "Zero amount",
      });
      return { matched: false, approved: false };
    }

    logger.info("Attempting to match receipt with payouts", {
      receiptId: receipt.id,
      amount: receipt.amount,
      recipientPhone: receipt.recipientPhone,
      recipientCard: receipt.recipientCard,
    });

    // Get pending payouts with status 5
    const pendingPayouts = await this.prisma.payout.findMany({
      where: {
        status: 5,
        transactionId: { not: null },
        receiptId: null, // Not yet matched with a receipt
      },
      include: {
        transaction: {
          include: {
            advertisement: true,
          },
        },
      },
    });

    logger.info("Found pending payouts", {
      count: pendingPayouts.length,
    });

    for (const payout of pendingPayouts) {
      // Skip if transaction already has receipt
      if (payout.transaction?.receiptReceivedAt) {
        continue;
      }

      // Check if amounts match (allow small difference for commission)
      const payoutAmount = payout.amountTrader?.["643"] || payout.amount || 0;
      const amountDiff = Math.abs(payoutAmount - receipt.amount);

      if (amountDiff > 100) {
        // Allow up to 100 RUB difference
        continue;
      }

      // Check wallet/card match
      const walletMatch = this.checkWalletMatch(payout, receipt);
      if (!walletMatch) {
        continue;
      }

      // Check date - receipt should be after payout creation
      if (receipt.transactionDate < payout.createdAt) {
        continue;
      }

      logger.info("🎉 RECEIPT MATCHED WITH PAYOUT!", {
        receiptId: receipt.id,
        payoutId: payout.id,
        transactionId: payout.transaction.id,
        amount: receipt.amount,
        payoutAmount,
        amountDiff,
      });

      // Update receipt with payout ID
      await this.prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          payoutId: payout.id,
          isProcessed: true,
        },
      });

      // Update transaction
      await this.prisma.transaction.update({
        where: { id: payout.transaction.id },
        data: {
          receiptReceivedAt: new Date(),
          status: "receipt_received",
        },
      });

      // Try to auto-approve on Gate
      const approved = await this.approvePayoutOnGate(payout, receipt);

      // Send telegram message if configured
      if (payout.transaction.orderId) {
        await this.sendTelegramNotification(payout.transaction);
      }

      // Emit WebSocket event for receipt matched
      if (this.io) {
        this.io.emit("receipts:matched", {
          receiptId: receipt.id,
          payoutId: payout.id,
          gateAccountId: payout.gateAccountId,
          gatePayoutId: payout.gatePayoutId,
          approved,
        });
      }

      return { matched: true, approved };
    }

    logger.info("No matching payout found for receipt", {
      receiptId: receipt.id,
    });

    return { matched: false, approved: false };
  }

  /**
   * Approve payout on Gate.io
   */
  private async approvePayoutOnGate(
    payout: any,
    receipt: any,
  ): Promise<boolean> {
    try {
      logger.info("Attempting to approve payout on Gate", {
        payoutId: payout.id,
        gatePayoutId: payout.gatePayoutId,
        receiptId: receipt.id,
      });

      // Get the first available Gate client
      const gateClients = this.gateManager.getAllClients();
      if (gateClients.length === 0) {
        logger.warn("No Gate clients available for auto-approval");
        return false;
      }

      const gateClient = gateClients[0];

      // Read the PDF file
      const pdfBuffer = await fs.readFile(receipt.filePath);

      // Approve the payout
      const approved = await gateClient.approvePayout(
        payout.gatePayoutId.toString(),
        pdfBuffer,
      );

      if (approved) {
        logger.info("✅ Payout approved on Gate successfully", {
          payoutId: payout.id,
          gatePayoutId: payout.gatePayoutId,
        });

        // Update payout status
        await this.prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 1, // Approved
            updatedAt: new Date(),
          },
        });

        // Update transaction status
        await this.prisma.transaction.update({
          where: { id: payout.transaction.id },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        });

        // Delete advertisement if needed
        await this.deleteAdvertisement(payout.transaction);

        return true;
      }

      logger.warn("Failed to approve payout on Gate", {
        payoutId: payout.id,
      });

      return false;
    } catch (error) {
      logger.error("Error approving payout on Gate", error as Error, {
        payoutId: payout.id,
      });
      return false;
    }
  }

  /**
   * Check if payout wallet matches receipt
   */
  private checkWalletMatch(payout: any, receipt: any): boolean {
    if (receipt.recipientPhone && payout.wallet) {
      // Normalize phone numbers for comparison
      const receiptPhone = receipt.recipientPhone.replace(/\D/g, "");
      const payoutPhone = payout.wallet.replace(/\D/g, "");
      return (
        receiptPhone.includes(payoutPhone) || payoutPhone.includes(receiptPhone)
      );
    } else if (receipt.recipientCard && payout.recipientCard) {
      // Check last 4 digits match
      const receiptLast4 = receipt.recipientCard.match(/\d{4}$/)?.[0];
      const payoutLast4 = payout.recipientCard.match(/\d{4}$/)?.[0];
      return receiptLast4 === payoutLast4;
    }
    return false;
  }

  /**
   * Send telegram notification
   */
  private async sendTelegramNotification(transaction: any): Promise<void> {
    try {
      logger.info("Sending telegram notification", {
        orderId: transaction.orderId,
      });

      const bybitAccount = await this.prisma.bybitAccount.findUnique({
        where: { id: transaction.advertisement.bybitAccountId },
      });

      if (bybitAccount) {
        const client = this.bybitManager.getClient(bybitAccount.accountId);
        if (client) {
          await this.chatService.sendMessageDirect(
            client,
            transaction.orderId,
            "В течении двух минут отпущу средства. Переходи в закрытый чат https://t.me/+8LzQMBnsrAphOGMy\n\nВсегда есть большой объем ЮСДТ по хорошему курсу, работаем оперативно.",
          );
          logger.info("✅ Telegram notification sent");
        }
      }
    } catch (error) {
      logger.error("Failed to send telegram notification", error as Error);
    }
  }

  /**
   * Delete advertisement after completion
   */
  private async deleteAdvertisement(transaction: any): Promise<void> {
    try {
      if (!transaction.advertisement.bybitAdId) {
        return;
      }

      logger.info("Deleting advertisement", {
        bybitAdId: transaction.advertisement.bybitAdId,
      });

      const bybitAccount = await this.prisma.bybitAccount.findUnique({
        where: { id: transaction.advertisement.bybitAccountId },
      });

      if (bybitAccount) {
        const client = this.bybitManager.getClient(bybitAccount.accountId);
        if (client) {
          await client.deleteAdvertisement(transaction.advertisement.bybitAdId);
          logger.info("✅ Advertisement deleted");

          // Update advertisement status
          await this.prisma.advertisement.update({
            where: { id: transaction.advertisement.id },
            data: { status: "DELETED" },
          });

          // Update bybit account active ads count
          await this.prisma.bybitAccount.update({
            where: { id: bybitAccount.id },
            data: { activeAdsCount: { decrement: 1 } },
          });
        }
      }
    } catch (error) {
      logger.error("Failed to delete advertisement", error as Error);
    }
  }

  /**
   * Ensure PDF storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    await fs.mkdir(this.config.pdfStoragePath, { recursive: true });
    logger.info("PDF storage directory ensured", {
      path: this.config.pdfStoragePath,
    });
  }

  // Helper methods for parsing receipt data
  private buildReference(receipt: ParsedReceipt): string {
    const recipient =
      "recipientName" in receipt
        ? receipt.recipientName
        : "recipientPhone" in receipt
          ? receipt.recipientPhone
          : "recipientCard" in receipt
            ? receipt.recipientCard
            : "Unknown";
    return `${receipt.sender} -> ${recipient}`;
  }

  private getRecipientName(receipt: ParsedReceipt | null): string | null {
    if (!receipt) return null;
    return "recipientName" in receipt ? receipt.recipientName : null;
  }

  private getRecipientPhone(receipt: ParsedReceipt | null): string | null {
    if (!receipt) return null;
    return "recipientPhone" in receipt ? receipt.recipientPhone : null;
  }

  private getRecipientCard(receipt: ParsedReceipt | null): string | null {
    if (!receipt) return null;
    return "recipientCard" in receipt ? receipt.recipientCard : null;
  }

  private getRecipientBank(receipt: ParsedReceipt | null): string | null {
    if (!receipt) return null;
    return "recipientBank" in receipt ? receipt.recipientBank : null;
  }
}
