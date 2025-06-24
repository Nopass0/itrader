/**
 * Chat Automation Service
 * Handles automated chat communication with counterparties
 */

import { db, type Transaction, type ChatMessage } from "../db";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { EventEmitter } from "events";
import { createLogger } from "../logger";

const logger = createLogger("ChatAutomation");

export class ChatAutomationService extends EventEmitter {
  private bybitManager: BybitP2PManagerService;
  private processingMessages: Set<string> = new Set();
  private startingAutomation: Set<string> = new Set();
  private sendingPaymentDetails: Set<string> = new Set();

  private initialQuestion = `Здравствуйте!

Для быстрого проведения сделки, пожалуйста, ответьте на следующие вопросы:

1. Оплата будет с Т банка?
2. Чек в формате PDF с официальной почты Т банка сможете отправить?

Просто напишите "Да" если согласны со всеми условиями, или "Нет" если что-то не подходит.`;

  private finalMessage = `Переходи в закрытый чат https://t.me/+nIB6kP22KmhlMmQy

Всегда есть большой объем ЮСДТ по хорошему курсу, работаем оперативно.`;

  constructor(bybitManager: BybitP2PManagerService) {
    super();
    this.bybitManager = bybitManager;
  }

  /**
   * Start automation for a transaction
   */
  async startAutomation(transactionId: string): Promise<void> {
    logger.info("🚀 Attempting to start automation for transaction", {
      transactionId,
      timestamp: new Date().toISOString(),
    });

    // Check if already starting automation for this transaction
    if (this.startingAutomation.has(transactionId)) {
      logger.info("Already starting automation for transaction, skipping", {
        transactionId,
      });
      return;
    }

    try {
      // Mark as starting automation
      this.startingAutomation.add(transactionId);
      logger.info("🔒 Locked automation start for transaction", {
        transactionId,
      });

      // Also check transaction status in database
      const transaction = await db.getTransactionWithDetails(transactionId);
      if (!transaction) {
        logger.error("Transaction not found", { transactionId });
        return;
      }

      if (transaction.chatStep > 0) {
        logger.info(
          "Transaction already has chat progress, skipping automation start",
          {
            transactionId,
            chatStep: transaction.chatStep,
          },
        );
        return;
      }

      // Check if we already sent messages
      const messages = await db.getChatMessages(transactionId);
      const ourMessages = messages.filter(
        (msg) => msg.sender === "me" || msg.sender === "seller",
      );

      logger.info("📋 Checking existing messages", {
        transactionId,
        totalMessages: messages.length,
        ourMessages: ourMessages.length,
        allSenders: messages.map((m) => m.sender),
        lastMessage: messages[messages.length - 1]?.content?.substring(0, 50),
      });

      if (ourMessages.length > 0) {
        logger.info("Already sent messages for transaction, skipping", {
          messageCount: ourMessages.length,
          transactionId,
        });
        return;
      }

      logger.info("📤 Sending initial message to transaction", {
        transactionId,
      });

      // Send initial question message
      logger.info("📤 Sending initial question message", {
        transactionId,
        messageLength: this.initialQuestion.length,
      });

      await this.sendMessage(transactionId, this.initialQuestion);

      logger.info("💾 Updating transaction chat step to 1", { transactionId });
      await db.updateTransaction(transactionId, { chatStep: 1 });

      logger.info("✅ Automation started successfully", {
        transactionId,
        chatStep: 1,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("❌ Error starting automation", error, { transactionId });
      throw error;
    } finally {
      // Remove from starting automation set
      this.startingAutomation.delete(transactionId);
      logger.info("🔓 Unlocked automation start for transaction", {
        transactionId,
      });
    }
  }

  /**
   * Process unprocessed chat messages
   */
  async processUnprocessedMessages(): Promise<void> {
    logger.info("🔍 Checking for unprocessed messages", {
      timestamp: new Date().toISOString(),
      caller: new Error().stack?.split("\n")[2]?.trim(), // Log who called this
    });
    const messages = await db.getUnprocessedChatMessages();

    if (messages.length > 0) {
      logger.info("📨 Found unprocessed messages", {
        count: messages.length,
        messageIds: messages.map((m) => m.id),
        transactions: [...new Set(messages.map((m) => m.transactionId))],
      });
    } else {
      logger.debug("✨ No unprocessed messages found"); // Changed to debug to reduce noise
    }

    for (const message of messages) {
      // Check if already processing this message
      if (this.processingMessages.has(message.id)) {
        logger.info("Already processing message, skipping", {
          messageId: message.id,
        });
        continue;
      }

      try {
        // Mark as processing
        this.processingMessages.add(message.id);

        logger.info("🔄 Processing message", {
          messageId: message.id,
          transactionId: message.transactionId,
          sender: message.sender,
          messageType: message.messageType,
          messagePreview: (
            message.content ||
            (message as any).message ||
            ""
          ).substring(0, 100),
          timestamp: message.createdAt,
        });

        await this.processMessage(message);

        // Mark as processed ONLY after successful processing
        await db.markChatMessageProcessed(message.id);
        logger.info("✅ Message processed successfully", {
          messageId: message.id,
        });
      } catch (error) {
        logger.error("❌ Error processing message", error, {
          messageId: message.id,
        });
        // Don't mark as processed if there was an error - will retry on next cycle
      } finally {
        // Remove from processing set
        this.processingMessages.delete(message.id);
      }
    }
  }

  /**
   * Process a single chat message
   */
  private async processMessage(
    message: ChatMessage & { transaction: Transaction },
  ): Promise<void> {
    logger.info("🎯 Processing individual message", {
      messageId: message.id,
      sender: message.sender,
      transactionId: message.transaction.id,
      transactionStatus: message.transaction.status,
      chatStep: message.transaction.chatStep,
    });

    // Skip if message is from us (me = our messages, us = counterparty)
    if (message.sender === "me") {
      logger.info("⏭️ Skipping our own message", { messageId: message.id });
      return;
    }

    const transaction = message.transaction;
    const currentStep = transaction.chatStep;

    logger.info("📊 Transaction state", {
      transactionId: transaction.id,
      currentStep,
      status: transaction.status,
      orderId: transaction.orderId,
    });

    // If we haven't started the conversation, send first message
    if (currentStep === 0) {
      logger.info("🚦 Chat step is 0, starting automation", {
        transactionId: transaction.id,
      });
      await this.startAutomation(transaction.id);
      return;
    }

    // Check response to our initial question
    if (currentStep === 1) {
      const messageText = message.content || (message as any).message || "";
      const answer = messageText.toLowerCase().trim();

      // Check for positive answer
      if (this.isPositiveAnswer(answer)) {
        logger.info("✅ Positive answer received", {
          transactionId: transaction.id,
          answer,
          messageId: message.id,
          originalContent: messageText,
        });

        // Check if payment details already sent (prevent duplicate sending)
        const latestTransaction = await db.getTransactionWithDetails(
          transaction.id,
        );
        if (latestTransaction && latestTransaction.chatStep === 999) {
          logger.info("🔒 Payment details already sent, skipping", {
            transactionId: transaction.id,
            chatStep: latestTransaction.chatStep,
          });
          return;
        }

        // Send payment details FIRST
        logger.info("💳 Preparing to send payment details", {
          transactionId: transaction.id,
        });
        await this.sendPaymentDetails(transaction.id);

        // Update transaction ONLY after successful sending
        const updateData = {
          status: "waiting_payment",
          chatStep: 999, // Mark as payment details sent
          paymentSentAt: new Date(),
        };

        logger.info("💾 Updating transaction after sending payment details", {
          transactionId: transaction.id,
          updateData,
        });

        await db.updateTransaction(transaction.id, updateData);

        logger.info("✅ Transaction successfully updated to waiting_payment", {
          transactionId: transaction.id,
          newChatStep: 999,
        });
      }
      // Check for negative answer
      else if (this.isNegativeAnswer(answer)) {
        logger.info("❌ Negative answer received", {
          transactionId: transaction.id,
          answer,
          messageId: message.id,
        });

        // Mark as stupid and forget about the order
        await db.updateTransaction(transaction.id, {
          status: "stupid",
          failureReason: `Negative response: ${message.content}`,
        });

        logger.info("🚫 Transaction marked as stupid", {
          transactionId: transaction.id,
          reason: "Negative response",
          response: answer,
        });

        // Delete advertisement after marking as stupid
        await this.deleteAdvertisementAndReleaseAssets(transaction.id);
      }
      // Any other answer - repeat the question
      else {
        logger.info("❓ Unclear answer received, repeating question", {
          transactionId: transaction.id,
          answer,
          messageId: message.id,
        });

        await this.sendMessage(transaction.id, this.initialQuestion);

        logger.info("🔁 Question repeated successfully", {
          transactionId: transaction.id,
        });
      }
    }
  }

  /**
   * Send payment details
   */
  private async sendPaymentDetails(transactionId: string): Promise<void> {
    logger.info("💸 Starting sendPaymentDetails", {
      transactionId,
      timestamp: new Date().toISOString(),
    });

    // Check if already sending payment details for this transaction
    if (this.sendingPaymentDetails.has(transactionId)) {
      logger.info(
        "🔒 Already sending payment details for transaction, skipping",
        { transactionId },
      );
      return;
    }

    try {
      // Mark as sending payment details
      this.sendingPaymentDetails.add(transactionId);

      const transaction = await db.getTransactionWithDetails(transactionId);
      if (!transaction) {
        logger.error("❌ Transaction not found", { transactionId });
        return;
      }

      logger.info("📄 Transaction details loaded", {
        transactionId,
        orderId: transaction.orderId,
        payoutId: transaction.payoutId,
        advertisementId: transaction.advertisementId,
        status: transaction.status,
      });

      // Check if we already sent payment details
      const messages = await db.getChatMessages(transactionId);
      const paymentMessages = messages.filter(
        (msg) =>
          msg.sender === "me" &&
          (msg.message?.includes("Реквизиты для оплаты") ||
            msg.content?.includes("Реквизиты для оплаты") ||
            msg.message?.includes("Сумма:") ||
            msg.content?.includes("Сумма:") ||
            msg.message?.includes("⚠️ ФИО не спрашивать") ||
            msg.content?.includes("⚠️ ФИО не спрашивать")),
      );

      logger.info("📋 Checking for existing payment messages", {
        totalMessages: messages.length,
        paymentMessages: paymentMessages.length,
      });

      if (paymentMessages.length > 0) {
        logger.info(
          "☑️ Payment details already sent for transaction, skipping",
          {
            transactionId,
            existingPaymentMessagesCount: paymentMessages.length,
          },
        );
        return;
      }

      // Get order details for amount
      const orderId = transaction.orderId;
      let orderAmount = 0;

      logger.info("🔎 Fetching order details", { orderId });

      if (orderId) {
        // Get the order from Bybit to get exact amount
        const bybitAccount = (transaction.advertisement as any).bybitAccount;
        logger.info("🏦 Bybit account info", {
          hasAccount: !!bybitAccount,
          accountId: bybitAccount?.accountId,
        });

        if (bybitAccount) {
          const client = this.bybitManager.getClient(bybitAccount.accountId);
          if (client) {
            try {
              logger.info("📡 Fetching order from Bybit API", { orderId });
              const order = await client.getOrderDetails(orderId);
              orderAmount = parseFloat(order.amount || "0");
              logger.info("✅ Order details fetched", {
                orderId,
                orderAmount,
                rawAmount: order.amount,
              });
            } catch (error) {
              logger.error("❌ Failed to get order details from Bybit", error, {
                orderId,
              });
            }
          } else {
            logger.warn("⚠️ No client found for Bybit account", {
              accountId: bybitAccount.accountId,
            });
          }
        }
      } else {
        logger.warn("⚠️ No orderId found for transaction", { transactionId });
      }

      logger.info("💰 Fetching payout details", {
        payoutId: transaction.payoutId,
      });

      let payout = await db.prisma.payout.findUnique({
        where: {
          id: transaction.payoutId || "",
        },
      });

      if (!payout) {
        logger.error("❌ No payout found for transaction", {
          transactionId,
          payoutId: transaction.payoutId,
        });

        // Try to find correct payout by matching order amount
        let correctPayout = null;
        if (orderAmount > 0) {
          const availablePayouts = await db.prisma.payout.findMany({
            where: {
              status: 5,
              transaction: null,
            },
          });

          for (const p of availablePayouts) {
            const amountData =
              typeof p.amountTrader === "string"
                ? JSON.parse(p.amountTrader)
                : p.amountTrader;
            const payoutAmount = amountData?.["643"] || 0;

            if (Math.abs(payoutAmount - orderAmount) < 1) {
              correctPayout = p;
              logger.info("🎯 Found matching payout by amount", {
                payoutId: p.id,
                gatePayoutId: p.gatePayoutId,
                orderAmount,
                payoutAmount,
              });
              break;
            }
          }
        }

        if (!correctPayout) {
          logger.error("❌ Could not find matching payout for order amount", {
            transactionId,
            orderAmount,
          });
          throw new Error("No matching payout found for this order");
        }

        // Update transaction with correct payout
        await db.prisma.transaction.update({
          where: { id: transactionId },
          data: { payoutId: correctPayout.id },
        });

        logger.info("✅ Updated transaction with correct payout", {
          transactionId,
          payoutId: correctPayout.id,
        });

        // Continue with the correct payout
        payout = correctPayout;
      }

      logger.info("🔢 Calculating payout amount", {
        hasAmountTrader: !!payout.amountTrader,
        hasTotalTrader: !!payout.totalTrader,
        hasAmount: !!payout.amount,
      });

      // Handle both amountTrader and totalTrader fields
      let amount = 0;
      if (payout.amountTrader) {
        const amountTrader =
          typeof payout.amountTrader === "string"
            ? JSON.parse(payout.amountTrader)
            : payout.amountTrader;
        amount = amountTrader["643"] || 0; // RUB amount
        logger.info("💵 Using amountTrader", {
          amountTrader,
          rubAmount: amount,
        });
      }

      const bankInfo = payout.bank
        ? typeof payout.bank === "string"
          ? JSON.parse(payout.bank)
          : payout.bank
        : null;

      // Use order amount if available, otherwise use payout amount
      const finalAmount = amount;

      logger.info("📊 Final amount calculation", {
        orderAmount,
        payoutAmount: amount,
        finalAmount,
        usingOrderAmount: orderAmount > 0,
      });

      // Get payment method from advertisement
      const paymentMethod = transaction.advertisement.paymentMethod || "";

      // Determine bank name
      let bankName =
        typeof payout.bank === "string"
          ? JSON.parse(payout.bank).label
          : payout.bank.label;

      const payout_ = await db.prisma.payout.findUnique({
        where: {
          id: transaction.payoutId || "",
        },
      });
      const wallet = payout_?.wallet;

      // Get first available MailSlurp email
      const { getMailSlurpService } = await import("./mailslurpService");

      let receiptEmail = "";

      try {
        const mailslurpService = await getMailSlurpService();
        const emails = mailslurpService.getEmailAddresses();

        if (emails.length > 0) {
          receiptEmail = emails[0]; // Just take the first email
          logger.info("Using first MailSlurp email", {
            receiptEmail,
            totalEmails: emails.length,
          });
        } else {
          logger.error("No MailSlurp emails available!");
          throw new Error("No MailSlurp emails configured");
        }
      } catch (error) {
        logger.error("Failed to get MailSlurp email", error);
        throw new Error("Failed to get receipt email");
      }

      // Update payout meta with assigned email
      if (transaction.payoutId) {
        const currentMeta = payout.meta || {};
        await db.prisma.payout.update({
          where: { id: transaction.payoutId },
          data: {
            meta: {
              ...(typeof currentMeta === "object" ? currentMeta : {}),
              receiptEmail,
            },
          },
        });
      }

      logger.info("Assigned receipt email for transaction", {
        transactionId,
        receiptEmail,
        amount: finalAmount,
        wallet,
        bankName,
      });

      // Split payment details into 5 separate messages
      const bankMessage = `СТРОГО на ${bankName} ${wallet || ""}`;
      const amountMessage = `Сумма: ${finalAmount} RUB`;
      const emailMessage = `${receiptEmail}`;
      const instructionsMessage = `⚠️ ФИО не спрашивать, реквизиты верные!

После оплаты отправьте чек в формате PDF на указанный email с официальной почты банка. После отправки чека, не забудьте прожать кнопку что оплатили, иначе средства будут утерены.`;

      logger.info("📤 Sending payment details in 5 separate messages", {
        transactionId,
        bankName,
        wallet,
        finalAmount,
        email: receiptEmail,
        paymentMethod: transaction.advertisement.paymentMethod,
      });

      // Send each message separately
      await this.sendMessage(transactionId, bankMessage);
      await this.sendMessage(transactionId, amountMessage);
      await this.sendMessage(transactionId, emailMessage);
      await this.sendMessage(transactionId, instructionsMessage);

      logger.info("✅ Payment details sent successfully", { transactionId });
    } catch (error) {
      logger.error("Error sending payment details", error, { transactionId });
      throw error;
    } finally {
      // Remove from sending payment details set
      this.sendingPaymentDetails.delete(transactionId);
    }
  }

  /**
   * Send final message after check verification
   */
  async sendFinalMessage(transactionId: string): Promise<void> {
    await this.sendMessage(transactionId, this.finalMessage);
  }

  /**
   * Send message directly using a client and order ID
   */
  async sendMessageDirect(
    client: any,
    orderId: string,
    message: string,
  ): Promise<void> {
    logger.info("📨 Sending direct message", {
      orderId,
      messageLength: message.length,
      preview: message.substring(0, 100),
    });

    try {
      const response = await client.sendChatMessage({
        orderId: orderId,
        message: message,
        messageType: "TEXT",
      });

      logger.info("✅ Direct message sent successfully", {
        orderId,
        msgUuid: response?.msgUuid,
      });
    } catch (error) {
      logger.error("❌ Failed to send direct message", error as Error, {
        orderId,
      });
      throw error;
    }
  }

  /**
   * Send message with proper parameters
   */
  async sendMessage(transactionId: string, message: string): Promise<void> {
    const transaction = await db.getTransactionWithDetails(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // If no orderId yet, try to find it by advertisement
    let orderId = transaction.orderId;
    if (!orderId && transaction.advertisement) {
      logger.info(
        "No orderId in transaction, searching for order by advertisement",
        {
          transactionId,
          advertisementId: transaction.advertisement.id,
          bybitAdId: transaction.advertisement.bybitAdId,
        },
      );

      // Get Bybit account
      const bybitAccount = (transaction.advertisement as any).bybitAccount;
      if (bybitAccount) {
        try {
          const client = this.bybitManager.getClient(bybitAccount.accountId);
          if (client) {
            // Get all active orders and find one matching our advertisement
            const ordersResult = await client.getOrdersSimplified({
              page: 1,
              size: 50,
              status: 10, // Payment in processing
            });

            if (ordersResult.items) {
              for (const order of ordersResult.items) {
                if (order.itemId === transaction.advertisement.bybitAdId) {
                  orderId = order.id;
                  logger.info("Found order by advertisement ID", {
                    orderId,
                    itemId: order.itemId,
                    bybitAdId: transaction.advertisement.bybitAdId,
                  });

                  // Update transaction with found orderId
                  await db.updateTransaction(transactionId, { orderId });
                  break;
                }
              }
            }
          }
        } catch (error) {
          logger.error("Error searching for order", error as Error);
        }
      }
    }

    if (!orderId) {
      throw new Error("Order ID not found for transaction");
    }

    logger.info("📨 Preparing to send message", {
      transactionId,
      orderId: orderId,
      advertisementId: transaction.advertisement?.id,
      bybitAccountId: (transaction.advertisement as any)?.bybitAccount
        ?.accountId,
      messageLength: message.length,
      messageType: "TEXT",
    });

    logger.info("📝 Message content", {
      preview: message.substring(0, 200),
      fullLength: message.length,
      hasNewlines: message.includes("\n"),
    });

    // Check if this is a test order
    if (orderId.startsWith("test_")) {
      logger.info("🧪 Test order detected - simulating message send");

      // Save message to database without actually sending to Bybit
      await db.createChatMessage({
        transactionId: transaction.id,
        messageId: `test_msg_${Date.now()}`,
        sender: "me",
        message: message,
        messageType: "TEXT",
        isProcessed: true,
      });

      logger.info("✅ Test message saved to database!");
      return;
    }

    const bybitAccount = (transaction.advertisement as any).bybitAccount;
    if (!bybitAccount) {
      throw new Error("Bybit account not found for advertisement");
    }

    const client = this.bybitManager.getClient(bybitAccount.accountId);
    if (!client) {
      throw new Error(`No client found for account ${bybitAccount.accountId}`);
    }

    try {
      // Send message using client method
      logger.info("🚀 Sending message via Bybit API", {
        orderId: orderId,
        accountId: bybitAccount.accountId,
      });

      const response = await client.sendChatMessage({
        orderId: orderId,
        message: message,
        messageType: "TEXT",
      });

      logger.info("✅ Message sent successfully via Bybit!", {
        response,
        msgUuid: response?.msgUuid,
      });

      // Save message to database
      const dbMessage = {
        transactionId: transaction.id,
        messageId: response?.msgUuid || `sent_${Date.now()}`,
        sender: "me",
        message: message,
        messageType: "TEXT",
        isProcessed: true,
      };

      logger.info("💾 Saving message to database", dbMessage);

      await db.createChatMessage(dbMessage);

      logger.info("✅ Message saved to database successfully");
    } catch (error) {
      logger.error("❌ Failed to send message", error);
      throw error;
    }
  }

  /**
   * Check if answer is positive
   */
  private isPositiveAnswer(answer: string): boolean {
    const positiveAnswers = [
      "да",
      "yes",
      "ок",
      "ok",
      "норм",
      "хорошо",
      "конечно",
      "разумеется",
      "согласен",
      "согласна",
      "подтверждаю",
      "подтвержаю",
    ];

    return positiveAnswers.some((positive) => answer.includes(positive));
  }

  /**
   * Check if answer is negative
   */
  private isNegativeAnswer(answer: string): boolean {
    const negativeAnswers = [
      "нет",
      "no",
      "не",
      "не подтверждаю",
      "отказываюсь",
      "не согласен",
      "не согласна",
      "отказ",
      "не могу",
      "не буду",
    ];

    return negativeAnswers.some((negative) => answer.includes(negative));
  }

  /**
   * Delete advertisement and release assets
   */
  private async deleteAdvertisementAndReleaseAssets(
    transactionId: string,
  ): Promise<void> {
    try {
      const transaction = await db.getTransactionWithDetails(transactionId);
      if (!transaction || !transaction.advertisement) return;

      const advertisement = transaction.advertisement as any;
      const bybitAdId = advertisement.bybitAdId;

      // Skip if it's a temporary advertisement
      if (bybitAdId?.startsWith("temp_")) {
        logger.info("Skipping deletion for temporary advertisement", {
          bybitAdId,
        });
        return;
      }

      // Get Bybit client
      const bybitAccount = advertisement.bybitAccount;
      if (!bybitAccount) {
        logger.error("No Bybit account found for advertisement");
        return;
      }

      const client = this.bybitManager.getClient(bybitAccount.accountId);
      if (!client) {
        logger.error("No client found for account", {
          accountId: bybitAccount.accountId,
        });
        return;
      }

      try {
        // Release assets if order exists
        if (transaction.orderId) {
          logger.info("Releasing assets for order...", {
            orderId: transaction.orderId,
          });
          await client.releaseAssets(transaction.orderId);
          logger.info("✅ Assets released for order", {
            orderId: transaction.orderId,
          });
        }

        // Delete advertisement from Bybit
        logger.info("Deleting advertisement...", { bybitAdId });
        await client.deleteAdvertisement(bybitAdId);
        logger.info("✅ Advertisement deleted from Bybit", { bybitAdId });

        // Mark advertisement as inactive in database
        await db.updateAdvertisement(advertisement.id, {
          isActive: false,
        });
        logger.info("✅ Advertisement marked as inactive in database");
      } catch (error) {
        logger.error("Error deleting advertisement", error);
      }
    } catch (error) {
      logger.error("Error in deleteAdvertisementAndReleaseAssets", error);
    }
  }
}
