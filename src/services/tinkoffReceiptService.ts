import { PrismaClient } from "../../generated/prisma";
import { GmailClient } from "../gmail";
import { TinkoffReceiptParser } from "../ocr/receiptParser";
import { ChatAutomationService } from "./chatAutomation";
import { BybitP2PManagerService } from "./bybitP2PManager";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { createLogger } from "../logger";

const logger = createLogger("TinkoffReceiptService");

export class TinkoffReceiptService {
  private prisma: PrismaClient;
  private gmailClient: GmailClient;
  private parser: TinkoffReceiptParser;
  private chatService: ChatAutomationService;
  private bybitManager: BybitP2PManagerService;
  private pdfStoragePath: string = "data/pdf";
  private processingTransactions: Set<string> = new Set();

  constructor(
    gmailClient: GmailClient,
    chatService: ChatAutomationService,
    bybitManager: BybitP2PManagerService,
  ) {
    this.prisma = new PrismaClient();
    this.gmailClient = gmailClient;
    this.parser = new TinkoffReceiptParser();
    this.chatService = chatService;
    this.bybitManager = bybitManager;

    logger.info("🚀 TinkoffReceiptService initialized", {
      hasChatService: !!chatService,
      hasBybitManager: !!bybitManager,
      hasGmailClient: !!gmailClient,
      pdfStoragePath: this.pdfStoragePath,
    });
  }

  async checkAndProcessReceipts() {
    logger.info("🔍 ========= CHECKING RECEIPTS =========", {
      timestamp: new Date().toISOString(),
      localTime: new Date().toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
      }),
    });
    console.log("[TinkoffReceiptService] Starting checkAndProcessReceipts");

    try {
      // Get today's date
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      logger.info("📧 Searching for Tinkoff emails", {
        from: "noreply@tinkoff.ru",
        after: startOfDay.toISOString(),
        hasAttachment: true,
      });
      console.log(
        "[TinkoffReceiptService] Searching for emails from noreply@tinkoff.ru",
      );

      let result;
      let messages = [];

      try {
        console.log("[TinkoffReceiptService] Calling gmailClient.getEmails...");
        result = await this.gmailClient.getEmails({
          from: "noreply@tinkoff.ru",
          after: startOfDay,
          hasAttachment: true,
        });
        console.log("[TinkoffReceiptService] Got result from getEmails");
        messages = result.messages || [];
      } catch (gmailError) {
        logger.error("❌ Error searching Gmail", gmailError as Error);
        console.error("[TinkoffReceiptService] Gmail error:", gmailError);
        throw gmailError;
      }

      logger.info("📨 Gmail search complete", {
        totalFound: messages.length,
        messageIds: messages.map((m) => m.id),
      });
      console.log(`[TinkoffReceiptService] Found ${messages.length} emails`);

      if (messages.length === 0) {
        logger.info("💭 No new Tinkoff receipts found today");
        console.log("[TinkoffReceiptService] No emails found");
        return;
      }

      // Process all messages
      logger.info("📝 Processing messages", { count: messages.length });

      let processedCount = 0;
      let newReceiptsCount = 0;

      for (const message of messages) {
        const result = await this.processMessage(message.id);
        if (result) {
          processedCount++;
          if (result.isNew) newReceiptsCount++;
        }
      }

      logger.info("✅ Receipt check complete", {
        totalMessages: messages.length,
        processedCount,
        newReceiptsCount,
        timestamp: new Date().toISOString(),
      });
      console.log(
        `[TinkoffReceiptService] Completed: processed ${processedCount}, new ${newReceiptsCount}`,
      );

      logger.info("✅ ==========================================");
    } catch (error) {
      logger.error("❌ Error checking receipts", error as Error);
      console.error(
        "[TinkoffReceiptService] Error in checkAndProcessReceipts:",
        error,
      );
      throw error; // Re-throw to see in main app
    }
  }

  private async processMessage(
    messageId: string,
  ): Promise<{ isNew: boolean } | null> {
    try {
      logger.info("📄 Processing message", { messageId });

      // Check if already processed
      const existingReceipt = await this.prisma.receipt.findUnique({
        where: { emailId: messageId },
      });

      if (existingReceipt) {
        logger.info("⏭️ Email already processed", {
          messageId,
          receiptId: existingReceipt.id,
          hasPayoutId: !!existingReceipt.payoutId,
        });

        // If receipt exists but has no payout, try to match it
        if (!existingReceipt.payoutId) {
          await this.tryMatchReceipt(existingReceipt);
        }
        return { isNew: false };
      }

      // Get message details
      logger.info("🔍 Fetching message details", { messageId });
      const messageDetails = await this.gmailClient.getMessage(messageId);
      const subject =
        messageDetails.payload?.headers?.find((h) => h.name === "Subject")
          ?.value || "No subject";
      const from =
        messageDetails.payload?.headers?.find((h) => h.name === "From")
          ?.value || "";
      const date =
        messageDetails.payload?.headers?.find((h) => h.name === "Date")
          ?.value || "";

      logger.info("📧 Email details", {
        messageId,
        subject,
        from,
        date,
      });

      // Find PDF attachment
      logger.info("🔎 Looking for PDF attachments", { messageId });
      const attachments = await this.gmailClient.getAttachments(messageId);

      logger.info("📎 Attachments found", {
        count: attachments.length,
        filenames: attachments.map((a) => a.filename),
      });

      const pdfAttachment = attachments.find((att) =>
        att.filename?.toLowerCase().endsWith(".pdf"),
      );

      if (!pdfAttachment || !pdfAttachment.data) {
        logger.warn("⚠️ No PDF attachment found", {
          messageId,
          attachmentCount: attachments.length,
        });
        return null;
      }

      logger.info("📄 PDF attachment found", {
        filename: pdfAttachment.filename,
        size: pdfAttachment.size,
      });

      // Download PDF
      const pdfBuffer = Buffer.from(pdfAttachment.data, "base64");
      const fileHash = crypto.createHash("md5").update(pdfBuffer).digest("hex");

      // Save PDF
      await fs.mkdir(this.pdfStoragePath, { recursive: true });
      const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}_Receipt.pdf`;
      const filePath = path.join(this.pdfStoragePath, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      // Parse receipt
      logger.info("🤖 Parsing PDF receipt", {
        messageId,
        bufferSize: pdfBuffer.length,
      });

      let parsedReceipt;
      let parseError = null;
      try {
        parsedReceipt = await this.parser.parseFromBuffer(pdfBuffer);

        if (parsedReceipt) {
          logger.info("✅ Receipt parsed successfully", {
            amount: parsedReceipt.amount,
            sender: parsedReceipt.sender,
            transferType: parsedReceipt.transferType,
            datetime: parsedReceipt.datetime,
          });
        }
      } catch (error) {
        parseError = error instanceof Error ? error.message : "Unknown error";
        logger.error("❌ Failed to parse receipt", error as Error, {
          messageId,
          filePath,
        });
      }

      // Save receipt to database
      const receipt = await this.prisma.receipt.create({
        data: {
          emailId: messageId,
          emailFrom: from,
          emailSubject: subject,
          attachmentName: pdfAttachment.filename,
          filePath: filePath,
          fileHash: fileHash,
          amount: parsedReceipt?.amount || 0,
          bank: "Tinkoff",
          reference: parsedReceipt
            ? `${parsedReceipt.sender} -> ${
                "recipientName" in parsedReceipt
                  ? parsedReceipt.recipientName
                  : "recipientPhone" in parsedReceipt
                    ? parsedReceipt.recipientPhone
                    : parsedReceipt.recipientCard
              }`
            : null,
          transferType: parsedReceipt?.transferType || null,
          status: parsedReceipt ? "SUCCESS" : "FAILED",
          senderName: parsedReceipt?.sender || null,
          recipientName:
            parsedReceipt && "recipientName" in parsedReceipt
              ? parsedReceipt.recipientName
              : null,
          recipientPhone:
            parsedReceipt && "recipientPhone" in parsedReceipt
              ? parsedReceipt.recipientPhone
              : null,
          recipientCard:
            parsedReceipt && "recipientCard" in parsedReceipt
              ? parsedReceipt.recipientCard
              : null,
          recipientBank:
            parsedReceipt && "recipientBank" in parsedReceipt
              ? parsedReceipt.recipientBank
              : null,
          commission: parsedReceipt?.commission || null,
          transactionDate: parsedReceipt?.datetime || new Date(),
          parsedData: parsedReceipt || { error: parseError },
          rawText: this.parser.lastExtractedText || null,
          isProcessed: false,
        },
      });

      if (parsedReceipt) {
        logger.info("🎯 Receipt saved and parsed", {
          receiptId: receipt.id,
          amount: parsedReceipt.amount,
          sender: parsedReceipt.sender,
        });

        // Try to match with payouts
        await this.tryMatchReceipt(receipt);
      } else {
        logger.warn("⚠️ Receipt saved but parsing failed", {
          receiptId: receipt.id,
          parseError,
        });
      }

      return { isNew: true };
    } catch (error) {
      logger.error("❌ Error processing message", error as Error, {
        messageId,
      });
      return null;
    }
  }

  private async tryMatchReceipt(receipt: any) {
    if (receipt.status !== "SUCCESS" || receipt.amount <= 0) {
      logger.info("⏭️ Skipping receipt matching", {
        receiptId: receipt.id,
        status: receipt.status,
        amount: receipt.amount,
        reason: receipt.status !== "SUCCESS" ? "Not successful" : "Zero amount",
      });
      return;
    }

    logger.info("🔍 Attempting to match receipt with payouts", {
      receiptId: receipt.id,
      amount: receipt.amount,
      recipientPhone: receipt.recipientPhone,
      recipientCard: receipt.recipientCard,
      transactionDate: receipt.transactionDate,
    });

    // Get pending payouts with status 5
    const pendingPayouts = await this.prisma.payout.findMany({
      where: {
        status: 5,
        transactionId: { not: null },
      },
      include: {
        transaction: {
          include: {
            advertisement: true,
          },
        },
      },
    });

    logger.info("💰 Found pending payouts to check", {
      count: pendingPayouts.length,
      payoutIds: pendingPayouts.map((p) => p.id),
    });

    for (const payout of pendingPayouts) {
      // Skip if transaction already has receipt
      if (payout.transaction?.receiptReceivedAt) {
        continue;
      }

      const payoutAmount = payout.amountTrader?.["643"] || payout.amount || 0;

      // Check amount match (allow small difference for commission)
      const amountDiff = Math.abs(payoutAmount - receipt.amount);
      if (amountDiff > 100) {
        // Allow up to 100 RUB difference
        continue;
      }

      // Check wallet/card match
      let walletMatch = false;

      if (receipt.recipientPhone && payout.wallet) {
        // Normalize phone numbers for comparison
        const receiptPhone = receipt.recipientPhone.replace(/\D/g, "");
        const payoutPhone = payout.wallet.replace(/\D/g, "");
        walletMatch =
          receiptPhone.includes(payoutPhone) ||
          payoutPhone.includes(receiptPhone);
      } else if (receipt.recipientCard && payout.recipientCard) {
        // Check last 4 digits match
        const receiptLast4 = receipt.recipientCard.match(/\d{4}$/)?.[0];
        const payoutLast4 = payout.recipientCard.match(/\d{4}$/)?.[0];
        walletMatch = receiptLast4 === payoutLast4;
      }

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
        payoutAmount: payoutAmount,
        amountDiff,
        walletMatch: {
          type: receipt.recipientPhone ? "phone" : "card",
          receipt: receipt.recipientPhone || receipt.recipientCard,
          payout: payout.wallet || payout.recipientCard,
        },
      });

      // Update receipt
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

      // Send message to chat
      if (payout.transaction.orderId) {
        logger.info("📨 Sending telegram link to order", {
          orderId: payout.transaction.orderId,
        });

        try {
          // Find bybit account for this transaction
          const bybitAccount = await this.prisma.bybitAccount.findUnique({
            where: { id: payout.transaction.advertisement.bybitAccountId },
          });

          if (bybitAccount) {
            const client = this.bybitManager.getClient(bybitAccount.accountId);
            if (client) {
              await this.chatService.sendMessageDirect(
                client,
                payout.transaction.orderId,
                "В течении двух минут отпущу средства. Переходи в закрытый чат https://t.me/+8LzQMBnsrAphOGMy\n\nВсегда есть большой объем ЮСДТ по хорошему курсу, работаем оперативно.",
              );
              logger.info("✅ Sent telegram link");
            }
          }
        } catch (error) {
          logger.error("Failed to send message", {
            error,
            orderId: payout.transaction.orderId,
          });
        }
      }

      // Delete advertisement
      if (payout.transaction.advertisement.bybitAdId) {
        logger.info("🗑️  Deleting advertisement", {
          bybitAdId: payout.transaction.advertisement.bybitAdId,
        });

        try {
          const bybitAccount = await this.prisma.bybitAccount.findUnique({
            where: { id: payout.transaction.advertisement.bybitAccountId },
          });

          if (bybitAccount) {
            const client = this.bybitManager.getClient(bybitAccount.accountId);
            if (client) {
              await client.deleteAdvertisement(
                payout.transaction.advertisement.bybitAdId,
              );
              logger.info("✅ Advertisement deleted");

              // Update advertisement status
              await this.prisma.advertisement.update({
                where: { id: payout.transaction.advertisement.id },
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
          logger.error("Failed to delete advertisement", {
            error,
            bybitAdId: payout.transaction.advertisement.bybitAdId,
          });
        }
      }

      // Only match one receipt per payout
      break;
    }
  }

  async releaseCompletedFunds() {
    logger.info("💰 ========= CHECKING FUNDS TO RELEASE =========", {
      timestamp: new Date().toISOString(),
      localTime: new Date().toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
      }),
    });

    try {
      // Find transactions where receipt was received more than 2 minutes ago
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      logger.info("🕒 Looking for transactions ready for release", {
        twoMinutesAgo: twoMinutesAgo.toISOString(),
        criteria: {
          receiptReceivedAt: "not null and <= 2 minutes ago",
          status: "receipt_received",
          orderId: "not null",
        },
      });

      const transactionsToRelease = await this.prisma.transaction.findMany({
        where: {
          receiptReceivedAt: { not: null, lte: twoMinutesAgo },
          status: "receipt_received",
          orderId: { not: null },
          completedAt: null, // Ensure not already completed
        },
        include: {
          advertisement: {
            include: {
              bybitAccount: true,
            },
          },
        },
      });

      logger.info("📋 Transactions ready for fund release", {
        count: transactionsToRelease.length,
        transactionIds: transactionsToRelease.map((t) => t.id),
        orderIds: transactionsToRelease.map((t) => t.orderId),
      });

      if (transactionsToRelease.length === 0) {
        logger.info("💭 No transactions ready for fund release");
        return;
      }

      for (const transaction of transactionsToRelease) {
        // Check if already processing
        if (this.processingTransactions.has(transaction.id)) {
          logger.info("⏭️ Transaction already being processed, skipping", {
            transactionId: transaction.id,
          });
          continue;
        }

        // Mark as processing
        this.processingTransactions.add(transaction.id);

        logger.info("🔄 Processing transaction for fund release", {
          transactionId: transaction.id,
          orderId: transaction.orderId,
          receiptReceivedAt: transaction.receiptReceivedAt?.toISOString(),
          minutesSinceReceipt: transaction.receiptReceivedAt
            ? Math.floor(
                (Date.now() - transaction.receiptReceivedAt.getTime()) / 60000,
              )
            : 0,
          advertisementId: transaction.advertisement.id,
          bybitAdId: transaction.advertisement.bybitAdId,
        });

        try {
          // Get bybit account from included relation
          const bybitAccount = transaction.advertisement.bybitAccount;

          if (!bybitAccount) {
            logger.error("❌ No bybit account found for transaction", {
              transactionId: transaction.id,
              advertisementId: transaction.advertisement.id,
              bybitAccountId: transaction.advertisement.bybitAccountId,
            });
            continue;
          }

          const client = this.bybitManager.getClient(bybitAccount.accountId);
          if (!client) {
            logger.error("No client found for account", {
              accountId: bybitAccount.accountId,
            });
            continue;
          }

          // Release funds
          logger.info("🚀 Attempting to release funds", {
            orderId: transaction.orderId,
            accountId: bybitAccount.accountId,
            transactionId: transaction.id,
          });

          await client.releaseAssets(transaction.orderId);

          logger.info("💸 Funds release API call successful", {
            orderId: transaction.orderId,
          });

          // Update transaction status
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "completed",
              completedAt: new Date(),
            },
          });

          logger.info("✅ Transaction completed successfully", {
            transactionId: transaction.id,
            orderId: transaction.orderId,
            completedAt: new Date().toISOString(),
            totalProcessingTime: transaction.receiptReceivedAt
              ? `${Math.floor((Date.now() - transaction.receiptReceivedAt.getTime()) / 1000)} seconds`
              : "unknown",
          });
        } catch (error) {
          logger.error(
            "❌ Failed to release funds for transaction",
            error as Error,
            {
              transactionId: transaction.id,
              orderId: transaction.orderId,
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            },
          );

          // Update transaction with error
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "failed",
              failureReason: `Fund release failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          });
        }
      }

      logger.info("✅ Fund release check complete", {
        processedCount: transactionsToRelease.length,
        timestamp: new Date().toISOString(),
      });

      logger.info("✅ ==========================================");
    } catch (error) {
      logger.error("❌ Error in fund release process", error as Error);
    }
  }
}
