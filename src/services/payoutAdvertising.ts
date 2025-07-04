import { db } from "../db";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { createLogger } from "../logger";
import { cuid } from "../utils/cuid";

const logger = createLogger("PayoutAdvertising");

/**
 * Centralized service for creating advertisements for payouts.
 * Ensures one-to-one relationship: payout -> advertisement -> transaction -> order
 */
export class PayoutAdvertisingService {
  private creatingAds = new Set<string>(); // Mutex to prevent duplicate ad creation

  constructor(private bybitManager: BybitP2PManagerService) {}

  /**
   * Creates an advertisement for a payout and the associated transaction.
   * This is the ONLY place where advertisements and transactions should be created.
   * 
   * @param payoutId - The payout ID to create advertisement for
   * @returns The created transaction, or existing one if already created
   */
  async createAdForPayout(payoutId: string) {
    logger.info("Creating advertisement for payout", { payoutId });

    // Prevent concurrent creation for the same payout
    if (this.creatingAds.has(payoutId)) {
      logger.warn("Already creating ad for this payout, skipping", { payoutId });
      return null;
    }

    this.creatingAds.add(payoutId);
    
    try {
      // 1. Check if transaction already exists for this payout
    const existingTransaction = await db.prisma.transaction.findUnique({
      where: { payoutId },
      include: { 
        advertisement: true,
        payout: true 
      }
    });

    if (existingTransaction) {
      logger.info("Transaction already exists for payout", {
        payoutId,
        transactionId: existingTransaction.id,
        advertisementId: existingTransaction.advertisementId
      });
      return existingTransaction;
    }

    // 1.5 Double-check if an active advertisement exists for this payout
    const existingAd = await db.prisma.advertisement.findFirst({
      where: {
        transaction: {
          payoutId: payoutId
        },
        isActive: true
      }
    });

    if (existingAd) {
      logger.warn("Active advertisement already exists for payout", {
        payoutId,
        advertisementId: existingAd.id
      });
      throw new Error(`Active advertisement already exists for payout ${payoutId}`);
    }

    // 2. Get payout details
    const payout = await db.prisma.payout.findUnique({
      where: { id: payoutId }
    });

    if (!payout) {
      throw new Error(`Payout not found: ${payoutId}`);
    }

    const amount = payout.amountTrader["643"] || 0;
    if (amount <= 0) {
      throw new Error(`Invalid payout amount: ${amount}`);
    }

    // 3. Check if blacklisted
    if (await db.isBlacklisted(payout.wallet)) {
      logger.warn("Wallet is blacklisted", { 
        payoutId, 
        wallet: payout.wallet 
      });
      throw new Error(`Wallet ${payout.wallet} is blacklisted`);
    }

    // 4. Determine payment method
    const paymentMethod = Math.random() > 0.5 ? "SBP" : "Tinkoff";
    logger.info("Selected payment method", { paymentMethod });

    try {
      // 5. Create advertisement on Bybit
      const bybitResult = await this.bybitManager.createAdvertisementWithAutoAccount(
        payoutId,
        amount.toString(),
        "RUB",
        paymentMethod
      );

      // Check if we're waiting for accounts to free up
      if (bybitResult.advertisementId === "WAITING" && bybitResult.bybitAccountId === "WAITING") {
        logger.info("All accounts are full, waiting for free slots", { payoutId });
        return null; // Will retry on next iteration
      }

      // 6. Advertisement already created in bybitManager, just get it
      const advertisement = await db.prisma.advertisement.findUnique({
        where: { id: bybitResult.dbAdvertisementId }
      });

      if (!advertisement) {
        throw new Error(`Advertisement not found after creation: ${bybitResult.dbAdvertisementId}`);
      }

      logger.info("Advertisement already created with payout link", {
        advertisementId: advertisement.id,
        bybitAdId: advertisement.bybitAdId,
        payoutId: advertisement.payoutId
      });

      // 7. Create transaction (orderId will be added when order is created)
      const transaction = await db.prisma.transaction.create({
        data: {
          id: cuid(),
          payoutId,
          advertisementId: advertisement.id,
          amount: amount, // Add amount from payout.amountTrader["643"]
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          advertisement: true,
          payout: true
        }
      });

      logger.info("Created transaction", {
        transactionId: transaction.id,
        payoutId,
        advertisementId: advertisement.id,
        amount
      });

      return transaction;

    } catch (error) {
      logger.error("Failed to create advertisement", error as Error, { payoutId });
      throw error;
    }
    } finally {
      this.creatingAds.delete(payoutId);
    }
  }

  /**
   * Links an order to an existing transaction based on advertisement's bybitAdId (itemId)
   * 
   * @param itemId - The Bybit advertisement ID (itemId from ORDER_CREATED event)
   * @param orderId - The Bybit order ID
   * @param orderPrice - The order price to verify against advertisement
   */
  async linkOrderToTransaction(itemId: string, orderId: string, orderPrice?: number) {
    logger.info("Linking order to transaction", { itemId, orderId });

    // 1. Find advertisement by bybitAdId
    const advertisement = await db.prisma.advertisement.findUnique({
      where: { bybitAdId: itemId },
      include: { 
        payout: true,
        transaction: true 
      }
    });

    if (!advertisement) {
      logger.error("Advertisement not found", { itemId });
      throw new Error(`Advertisement not found for itemId: ${itemId}`);
    }

    // 2. Check price if provided
    if (orderPrice !== undefined && advertisement.price) {
      const adPrice = parseFloat(advertisement.price);
      if (Math.abs(orderPrice - adPrice) > 0.01) {
        logger.warn("Price mismatch between order and advertisement", {
          orderPrice,
          adPrice,
          itemId,
          orderId
        });
        // You can decide to throw error or handle it differently
        // throw new Error(`Price mismatch: order ${orderPrice} vs ad ${adPrice}`);
      }
    }

    // 3. Get or create transaction
    let transaction = advertisement.transaction;
    
    if (!transaction) {
      // This shouldn't happen if createAdForPayout is used correctly
      logger.warn("Transaction not found for advertisement, creating one", {
        advertisementId: advertisement.id,
        payoutId: advertisement.payoutId
      });
      
      transaction = await db.prisma.transaction.create({
        data: {
          id: cuid(),
          payoutId: advertisement.payoutId,
          advertisementId: advertisement.id,
          status: "chat_started",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // 4. Update transaction with orderId
    const updatedTransaction = await db.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        orderId,
        status: "chat_started",
        updatedAt: new Date()
      },
      include: {
        advertisement: true,
        payout: true
      }
    });

    logger.info("Successfully linked order to transaction", {
      transactionId: updatedTransaction.id,
      payoutId: updatedTransaction.payoutId,
      orderId,
      itemId
    });

    // 5. Delete advertisement from Bybit after successful linking
    try {
      logger.info("Deleting advertisement from Bybit", {
        itemId,
        advertisementId: advertisement.id
      });

      // Get the bybit account for this advertisement
      const bybitAccount = await db.prisma.bybitAccount.findUnique({
        where: { id: advertisement.bybitAccountId }
      });

      if (!bybitAccount) {
        logger.error("Bybit account not found for advertisement", {
          bybitAccountId: advertisement.bybitAccountId
        });
      } else {
        const client = this.bybitManager.getClient(bybitAccount.accountId);
        if (client) {
          await client.cancelAdvertisement(itemId);
          logger.info("✅ Advertisement deleted from Bybit", { itemId });

          // Update advertisement status in database
          await db.prisma.advertisement.update({
            where: { id: advertisement.id },
            data: {
              isActive: false,
              updatedAt: new Date()
            }
          });
          logger.info("Advertisement marked as inactive in database");
        } else {
          logger.error("No client found for bybit account", {
            accountId: bybitAccount.accountId
          });
        }
      }
    } catch (error) {
      logger.error("Failed to delete advertisement from Bybit", error, {
        itemId,
        orderId
      });
      // Don't throw error here - order linking was successful
    }

    return updatedTransaction;
  }
}