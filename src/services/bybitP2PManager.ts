/**
 * Bybit P2P Manager Service
 * Manages Bybit P2P accounts and operations
 */

import { P2PManager, P2PConfig } from "../bybit";
import { db, type BybitAccount } from "../db";
import { getExchangeRateManager } from "./exchangeRateManager";
import { createLogger } from "../logger";
import { PayoutAdvertisingService } from "./payoutAdvertising";
import { OrderLinkingService } from "./orderLinkingService";

const logger = createLogger("BybitP2PManager");

interface CreateAdvertisementResult {
  advertisementId: string;
  dbAdvertisementId: string;
  bybitAccountId: string;
  price: string;
  quantity: string;
}

export class BybitP2PManagerService {
  private manager: P2PManager;
  private initialized: boolean = false;
  private paymentMethodsCache: Map<string, Map<string, string>> = new Map(); // accountId -> Map<methodName, methodId>
  private paymentMethodsCacheTime: Map<string, number> = new Map(); // accountId -> timestamp
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache
  private payoutAdvertisingService: PayoutAdvertisingService;
  private orderLinkingService: OrderLinkingService;

  constructor() {
    this.manager = new P2PManager();
    this.payoutAdvertisingService = new PayoutAdvertisingService(this);
    this.orderLinkingService = new OrderLinkingService(this);
    this.setupEventHandlers();
  }

  /**
   * Initialize all Bybit accounts from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info("Initializing Bybit accounts...");

    const accounts = await db.getActiveBybitAccounts();
    logger.info("Found accounts to initialize", { count: accounts.length });

    for (const account of accounts) {
      try {
        await this.manager.addAccount(account.accountId, {
          apiKey: account.apiKey,
          apiSecret: account.apiSecret,
          testnet: false,
          debugMode: true, // Enable debug mode to see request details
          recvWindow: 50000, // Increase recv_window to 50 seconds to handle time sync issues
        });

        logger.info("Added account successfully", {
          accountId: account.accountId,
        });
      } catch (error) {
        logger.error(
          `Failed to add account ${account.accountId}`,
          error as Error,
          { accountId: account.accountId },
        );
      }
    }

    // Start order polling for all accounts
    this.manager.startOrderPollingAll(20000); // Poll every 20 seconds to avoid rate limits
    console.log("[BybitP2PManager] Started order polling for all accounts (20s interval)");

    // Start order linking service - DISABLED to avoid rate limiting
    // OrderLinkingService functionality is now handled by ActiveOrdersMonitor
    // console.log("[BybitP2PManager] Starting OrderLinkingService...");
    // this.orderLinkingService.start(2000); // Check every 2 seconds

    this.initialized = true;
    logger.info(`Initialized with ${accounts.length} accounts`, {
      accountCount: accounts.length,
    });
    console.log(`[BybitP2PManager] Initialization complete with ${accounts.length} accounts`);
  }

  /**
   * Get all account IDs
   */
  getAccounts(): string[] {
    const accounts = this.manager.getAccounts();
    logger.debug('Getting accounts list', { accountCount: accounts.length });
    return accounts.map(account => account.accountId);
  }

  /**
   * Get client for specific account
   */
  getClient(accountId: string) {
    return this.manager.getClient(accountId);
  }

  /**
   * Setup event handlers for P2P events
   */
  private setupEventHandlers(): void {
    this.manager.on("accountConnected", async ({ accountId }) => {
      logger.info(`🌐 Account connected to Bybit P2P`, {
        accountId,
        timestamp: new Date().toISOString(),
        event: "accountConnected",
      });
      await db.client.bybitAccount.update({
        where: { accountId },
        data: { lastSync: new Date() },
      });
    });

    this.manager.on("p2pEvent", async (event) => {
      logger.info(`📡 P2P Event received`, {
        eventType: event.type,
        orderId: event.data?.orderId,
        itemId: event.data?.itemId,
        accountId: event.accountId,
        timestamp: new Date().toISOString(),
        fullEvent: event,
      });

      // Handle order creation events
      if (event.type === "ORDER_CREATED" && event.data.orderId) {
        try {
          logger.info("🆕 Order created event", {
            orderId: event.data.orderId,
            itemId: event.data.itemId,
          });

          // Use PayoutAdvertisingService to link order to transaction
          const transaction = await this.payoutAdvertisingService.linkOrderToTransaction(
            event.data.itemId,
            event.data.orderId,
            event.data.price // Optional price check
          );

          logger.info("✅ Successfully linked order to transaction", {
            transactionId: transaction.id,
            payoutId: transaction.payoutId,
            orderId: event.data.orderId,
          });
        } catch (error) {
          logger.error("❌ Failed to link order to transaction", error as Error, {
            orderId: event.data.orderId,
            itemId: event.data.itemId,
          });
        }
      }
    });

    this.manager.on("chatMessage", async ({ accountId, message }) => {
      logger.info(`💬 New chat message received`, {
        accountId,
        orderId: message.orderId,
        messageId: message.messageId,
        senderId: message.senderId,
        messageType: message.type,
        contentPreview: message.content?.substring(0, 100),
        timestamp: new Date().toISOString(),
      });

      // Save message to database
      const transaction = await db.getTransactionByOrderId(message.orderId);
      if (transaction) {
        logger.info(`🔍 Found transaction for chat message`, {
          transactionId: transaction.id,
          orderId: message.orderId,
          advertisementId: transaction.advertisementId,
        });

        // Determine sender - if senderId matches our accountId, it's from us
        const sender = message.senderId === accountId ? "us" : "counterparty";
        logger.info(`👤 Message sender identified`, {
          sender,
          senderId: message.senderId,
          ourAccountId: accountId,
          isOurMessage: sender === "us",
        });

        const chatMessageData = {
          transactionId: transaction.id,
          messageId: message.messageId,
          sender: sender,
          message: message.content || message.text || message.message || "",  // Handle different message field names
          messageType: message.type || "TEXT",
        };

        logger.info("💾 Saving chat message to database", chatMessageData);

        await db.createChatMessage(chatMessageData);

        logger.info(`✅ Chat message saved successfully`, {
          messageId: message.messageId,
          transactionId: transaction.id,
        });
      } else {
        logger.error(`❌ No transaction found for order`, {
          orderId: message.orderId,
          messageId: message.messageId,
          accountId,
        });
      }
    });
  }

  /**
   * Get the manager instance
   */
  getManager(): P2PManager {
    return this.manager;
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Payment type ID mappings based on Bybit's system
   * These are common payment type IDs used by Bybit
   */
  private readonly PAYMENT_TYPE_MAPPINGS: Record<string, string[]> = {
    Tinkoff: ["59", "75", "14"], // Different IDs that might represent Tinkoff
    SBP: ["65", "71", "581"], // SBP/Fast Payment System IDs
    "Bank Transfer": ["1", "2"], // Generic bank transfer
    Raiffeisenbank: ["64"],
    Sberbank: ["28"],
    "Alfa-Bank": ["32"],
    QIWI: ["31"],
    YooMoney: ["35"],
  };

  /**
   * Get payment method name by type ID
   */
  private getPaymentMethodNameByType(paymentType: string): string | null {
    for (const [methodName, typeIds] of Object.entries(
      this.PAYMENT_TYPE_MAPPINGS,
    )) {
      if (typeIds.includes(paymentType)) {
        return methodName;
      }
    }
    return null;
  }

  /**
   * Get payment methods for account with caching
   */
  private async getPaymentMethodsForAccount(
    accountId: string,
  ): Promise<Map<string, string>> {
    // Check cache first
    const cachedTime = this.paymentMethodsCacheTime.get(accountId) || 0;
    const now = Date.now();

    if (cachedTime && now - cachedTime < this.CACHE_DURATION) {
      const cached = this.paymentMethodsCache.get(accountId);
      if (cached) {
        return cached;
      }
    }

    try {
      // Ensure service is initialized
      await this.ensureInitialized();

      // Fetch payment methods from API
      const paymentMethods = await this.manager.getPaymentMethods(accountId);

      logger.info(`Raw payment methods response for ${accountId}`, {
        accountId,
        paymentMethods,
      });

      // Create mapping of payment method names to IDs
      const methodMap = new Map<string, string>();

      // Check if paymentMethods is an array
      if (!Array.isArray(paymentMethods)) {
        logger.error(`Payment methods response is not an array`, {
          paymentMethods,
        });
        throw new Error("Invalid payment methods response format");
      }

      for (const method of paymentMethods) {
        // Check if method has required properties
        if (!method || typeof method !== "object") {
          logger.warn(`Invalid payment method object`, {
            method,
          });
          continue;
        }

        // Extract ID
        const methodId = String(method.id);
        if (!methodId || methodId === "-1") {
          // Skip internal Balance payment method
          continue;
        }

        // Extract payment method details
        const paymentName = method.paymentConfigVo?.paymentName || "";
        const paymentType = String(method.paymentType || "");
        const bankName = method.bankName || "";
        const accountNo = method.accountNo || "";
        const isEnabled = method.online === "1";

        logger.info(`Processing payment method`, {
          id: methodId,
          name: paymentName,
          type: paymentType,
          bank: bankName,
          accountNo: accountNo,
          isEnabled: isEnabled,
          fullObject: method,
        });

        // Note: Even if payment method is marked as offline (online: "0"),
        // we should still include it because it might still be usable for creating ads
        // The user's payment methods are all showing online: "0" but they need to work
        if (!isEnabled) {
          logger.info(
            `Warning: Payment method ${methodId} is marked as offline but including anyway`,
            {
              methodId,
            },
          );
        }

        // Try to determine payment method name
        let mappedMethodName: string | null = null;

        // First priority: Use payment name if available
        if (paymentName) {
          if (paymentName.toLowerCase().includes("tinkoff")) {
            mappedMethodName = "Tinkoff";
          } else if (
            paymentName.toLowerCase().includes("sbp") ||
            paymentName.toLowerCase().includes("fast payment") ||
            paymentName.toLowerCase().includes("система быстрых платежей")
          ) {
            mappedMethodName = "SBP";
          } else if (paymentName.toLowerCase().includes("raiffeisen")) {
            mappedMethodName = "Raiffeisenbank";
          } else if (paymentName.toLowerCase().includes("sber")) {
            mappedMethodName = "Sberbank";
          } else if (
            paymentName.toLowerCase().includes("alfa") ||
            paymentName.toLowerCase().includes("альфа")
          ) {
            mappedMethodName = "Alfa-Bank";
          }
        }

        // Second priority: Check bank name for bank transfers
        if (!mappedMethodName && bankName) {
          if (bankName.toLowerCase().includes("tinkoff")) {
            mappedMethodName = "Tinkoff";
          } else if (
            bankName.toLowerCase().includes("sbp") ||
            bankName.toLowerCase().includes("sber")
          ) {
            mappedMethodName = "SBP";
          } else if (bankName.toLowerCase().includes("raiffeisen")) {
            mappedMethodName = "Raiffeisenbank";
          } else if (
            bankName.toLowerCase().includes("alfa") ||
            bankName.toLowerCase().includes("альфа")
          ) {
            mappedMethodName = "Alfa-Bank";
          }
        }

        // Third priority: Use payment type mapping
        if (!mappedMethodName && paymentType) {
          mappedMethodName = this.getPaymentMethodNameByType(paymentType);
        }

        // Fourth priority: Check account number patterns
        if (!mappedMethodName && accountNo) {
          // Check for phone number pattern (might be SBP)
          if (/^\+?[78]\d{10}$/.test(accountNo.replace(/\D/g, ""))) {
            mappedMethodName = "SBP";
          }
        }

        // If we identified a method name, add it to the map
        if (mappedMethodName) {
          logger.info(
            `Mapped payment method: ${mappedMethodName} -> ${methodId}`,
            {
              mappedMethodName,
              methodId,
            },
          );
          methodMap.set(mappedMethodName, methodId);

          // For Tinkoff and SBP, also add with lowercase
          if (mappedMethodName === "Tinkoff") {
            methodMap.set("tinkoff", methodId);
          } else if (mappedMethodName === "SBP") {
            methodMap.set("sbp", methodId);
          }
        }

        // Also map by exact payment name for flexibility
        if (paymentName) {
          methodMap.set(paymentName, methodId);
        }

        // Add mapping by payment type for debugging
        methodMap.set(`type_${paymentType}`, methodId);
      }

      // Cache the results
      this.paymentMethodsCache.set(accountId, methodMap);
      this.paymentMethodsCacheTime.set(accountId, now);

      logger.info(`Final payment methods mapping for ${accountId}`, {
        accountId,
        mapping: Array.from(methodMap.entries()),
      });

      if (methodMap.size === 0) {
        logger.warn(`No payment methods found for account ${accountId}`, {
          accountId,
        });
      }

      return methodMap;
    } catch (error) {
      logger.error(
        `Failed to fetch payment methods for ${accountId}`,
        error as Error,
        {
          accountId,
        },
      );
      throw new Error(`Failed to fetch payment methods: ${error.message}`);
    }
  }

  /**
   * Create advertisement with automatic account selection
   */
  async createAdvertisementWithAutoAccount(
    payoutId: string,
    amount: string,
    currency: string,
    paymentMethod: "SBP" | "Tinkoff",
  ): Promise<CreateAdvertisementResult | { advertisementId: "WAITING"; bybitAccountId: "WAITING" }> {
    logger.info("📢 Starting advertisement creation", {
      payoutId,
      amount,
      currency,
      paymentMethod,
      timestamp: new Date().toISOString(),
    });

    // Verify payout exists and amount matches
    const payout = await db.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      logger.error("❌ Payout not found", { payoutId });
      throw new Error(`Payout ${payoutId} not found`);
    }

    const payoutData = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    const payoutAmount = payoutData?.["643"] || 0;
    const requestedAmount = parseFloat(amount);

    if (Math.abs(payoutAmount - requestedAmount) > 1) {
      logger.error("❌ Amount mismatch between payout and request", {
        payoutId,
        payoutAmount,
        requestedAmount,
        difference: Math.abs(payoutAmount - requestedAmount),
      });
      throw new Error(`Amount mismatch: payout has ${payoutAmount} but requested ${requestedAmount}`);
    }

    logger.info("✅ Payout verification passed", {
      payoutId,
      gatePayoutId: payout.gatePayoutId,
      amount: payoutAmount,
      wallet: payout.wallet,
    });

    // Ensure service is initialized
    await this.ensureInitialized();

    // Get all active accounts
    const accounts = await db.getActiveBybitAccounts();
    logger.info("🏦 Found Bybit accounts", {
      count: accounts.length,
      accountIds: accounts.map((a) => a.accountId),
    });

    if (accounts.length === 0) {
      logger.error("❌ No active Bybit accounts available");
      throw new Error("No active Bybit accounts available");
    }

    // Try each account until we find one with less than 2 ads
    let selectedAccount: BybitAccount | null = null;
    let accountsStatus: Array<{
      accountId: string;
      dbAds: number;
      bybitAds: number;
      total: number;
    }> = [];

    for (const account of accounts) {
      // Check if account already has 2 active ads (check both DB and Bybit API)
      const dbAdsCount = await db.countActiveAdvertisementsByAccount(
        account.accountId,
      );
      const bybitAdsCount = await this.getActiveAdCountFromBybit(
        account.accountId,
      );
      const activeAdsCount = Math.max(dbAdsCount, bybitAdsCount);

      accountsStatus.push({
        accountId: account.accountId,
        dbAds: dbAdsCount,
        bybitAds: bybitAdsCount,
        total: activeAdsCount,
      });

      logger.info(`📊 Account ${account.accountId} advertisement status`, {
        accountId: account.accountId,
        dbAds: dbAdsCount,
        bybitAds: bybitAdsCount,
        total: activeAdsCount,
        canCreateNew: activeAdsCount < 2,
      });

      if (activeAdsCount < 2) {
        selectedAccount = account;
        break;
      }
    }

    // If no account found with less than 2 ads, all accounts are full
    if (!selectedAccount) {
      const statusReport = accountsStatus
        .map(
          (s) =>
            `${s.accountId}: ${s.total} ads (DB: ${s.dbAds}, Bybit: ${s.bybitAds})`,
        )
        .join(", ");

      logger.warn(
        `⚠️ All ${accounts.length} Bybit accounts have maximum ads (2 each)`,
        {
          accountCount: accounts.length,
          accountStatus: statusReport,
          message: "Waiting for some ads to complete...",
          accountDetails: accountsStatus,
        },
      );

      // Return a special response indicating we're waiting
      return {
        advertisementId: "WAITING",
        bybitAccountId: "WAITING",
      };
    }

    const account = selectedAccount;

    // Check payment method of existing ads
    const existingAds = await db.getActiveAdvertisementsByAccount(
      account.accountId,
    );
    let selectedPaymentMethod = paymentMethod;

    if (existingAds.length === 1) {
      // If one ad exists, use opposite payment method
      const existingMethod = existingAds[0].paymentMethod;
      selectedPaymentMethod = existingMethod === "SBP" ? "Tinkoff" : "SBP";
    }

    logger.info(`🎯 Selected account for advertisement`, {
      accountId: account.accountId,
      paymentMethod: selectedPaymentMethod,
      existingAds: existingAds.length,
      reason:
        existingAds.length === 1
          ? "Using opposite payment method"
          : "Using requested payment method",
    });

    // Get payment method IDs for this account
    const paymentMethods = await this.getPaymentMethodsForAccount(
      account.accountId,
    );
    const paymentMethodId = paymentMethods.get(selectedPaymentMethod);

    if (!paymentMethodId) {
      // List available methods for debugging
      const availableMethods = Array.from(paymentMethods.keys())
        .filter((key) => !key.startsWith("type_")) // Filter out type_ entries for cleaner error message
        .join(", ");

      // Also list payment types for debugging
      const availableTypes = Array.from(paymentMethods.keys())
        .filter((key) => key.startsWith("type_"))
        .map((key) => key.replace("type_", ""))
        .join(", ");

      throw new Error(
        `Payment method '${selectedPaymentMethod}' not found for account ${account.accountId}. ` +
          `Available methods: ${availableMethods || "none"}. ` +
          `Available payment types: ${availableTypes || "none"}. ` +
          `Please ensure the payment method is configured and enabled in your Bybit account. ` +
          `If you see type 59, it might be Tinkoff. Type 65 might be SBP.`,
      );
    }

    // Get exchange rate from the exchange rate manager
    const exchangeRateManager = getExchangeRateManager();
    let basePrice = await exchangeRateManager.getRate();

    // Ensure basePrice is valid (must be positive)
    if (isNaN(basePrice) || basePrice <= 0) {
      logger.warn(`Invalid base price: ${basePrice}, using default 85.00`, {
        basePrice,
        defaultPrice: 85.0,
      });
      basePrice = 85.0; // Use a reasonable default
    }

    // Use the base price directly without any conflict checking
    let finalPrice = basePrice;

    logger.info(`Using price: ${finalPrice.toFixed(2)}`, {
      price: finalPrice.toFixed(2),
    });

    // Update exchange rate to use the final adjusted price
    const exchangeRate = finalPrice;

    // Validate exchange rate before calculation
    if (isNaN(exchangeRate) || exchangeRate <= 0) {
      throw new Error(
        `Invalid exchange rate: ${exchangeRate}. Cannot create advertisement.`,
      );
    }

    // Calculate USDT quantity: (amount in RUB / exchange rate) + 5 USDT
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error(
        `Invalid amount: ${amount}. Cannot create advertisement.`,
      );
    }

    const usdtQuantity = (parsedAmount / exchangeRate + 5).toFixed(2);

    // Validate the calculated quantity
    if (isNaN(parseFloat(usdtQuantity)) || parseFloat(usdtQuantity) <= 0) {
      throw new Error(
        `Invalid USDT quantity calculated: ${usdtQuantity}. Amount: ${amount}, Rate: ${exchangeRate}`,
      );
    }

    // Store advertisement parameters since response won't include them
    const adParams = {
      tokenId: "USDT",
      currencyId: currency,
      side: "1", // 1 = SELL
      priceType: "0", // 0 = FIXED
      price: exchangeRate.toString(),
      premium: "", // Empty for fixed price
      minAmount: amount,
      maxAmount: amount,
      quantity: usdtQuantity,
      paymentIds: [paymentMethodId],
      remark:
        "‼️ЧИТАЕМ‼️ СБП/КАРТА ТИНЬКОФА - БЕЗ КОМИССИИ ⚠️ОПЛАТА ТОЛЬКО С Т-БАНКА ⚠️ ‼️ОПЛАТИЛ С ДРУГОГО БАНКА НЕ ОТПУЩУ‼️ ПЕРЕВОД НА КАКОЙ БАНК УКАЖУ В ОРДЕРЕ ‼️ПЕРЕВОД СТРОГО НА УКАЗАНЫЙ МНОЮ В ЧАТЕ БАНК !!! ЕСЛИ ОТПРВИЛ НЕ НА ТОТ БАНК - ПОПРОЩАЙСЯ С ДЕНЬГАМИ !!! ЧЕК ПДФ ОБЯЗАТЕЛЬНО ОТПРАВИТЬ МНЕ НА ПОЧТУ ОТ ОФФИЦАЛЬНОЙ ПОЧТЫ Т-БАНКА ‼️ ✅РАБОТАЮ БЫСТРО✅ ‼️‼️ЕСЛИ ВЫ СО ВСЕМ СОГЛАНЫ ПОСТАВЬТЕ " +
        " в чат и я скину вам реквизиты на оплату ‼️‼️",
      paymentPeriod: "15", // 15 minutes payment time as string
      tradingPreferenceSet: {}, // Required empty object
    };

    logger.info(`📦 Advertisement parameters`, {
      ...adParams,
      paymentMethodName: selectedPaymentMethod,
      paymentMethodId,
      accountId: account.accountId,
      exchangeRate,
      calculatedUsdtQuantity: usdtQuantity,
      remarkLength: adParams.remark.length,
    });

    // Create advertisement on Bybit
    // Note: Bybit only returns itemId and security fields, not full ad details
    logger.info("🚀 Sending create advertisement request to Bybit", {
      accountId: account.accountId,
    });

    const createResponse = await this.manager.createAdvertisement(
      adParams,
      account.accountId,
    );

    logger.info(`✅ Advertisement created on Bybit`, {
      response: createResponse,
      itemId: createResponse.itemId || createResponse.id,
      hasSecurityToken: !!createResponse.securityRiskToken,
    });

    // Extract itemId from response
    // Response structure: { itemId: "...", securityRiskToken: "", ... }
    const itemId = createResponse.itemId || createResponse.id;
    if (!itemId) {
      throw new Error("Failed to get advertisement ID from Bybit response");
    }

    // Optional: Try to fetch the full advertisement details
    // This is not always necessary but can be useful for verification
    try {
      logger.info(`Fetching advertisement details for ${itemId}`, {
        itemId,
      });
      const fullAdDetails = await this.manager.getAdvertisementDetails(
        itemId,
        account.accountId,
      );
      logger.info(`Full advertisement details`, {
        details: fullAdDetails,
      });
    } catch (error) {
      logger.warn(`Could not fetch full ad details (this is normal)`, {
        error: error as Error,
      });
    }

    // Save to database with the parameters we sent
    logger.info("💾 Saving advertisement to database", {
      bybitAdId: itemId,
      accountId: account.accountId,
    });

    const dbAd = await db.createAdvertisement({
      bybitAdId: itemId,
      bybitAccountId: account.id,
      payoutId, // Add payout link
      side: "SELL",
      asset: "USDT",
      fiatCurrency: currency,
      price: adParams.price.toString(),
      quantity: adParams.quantity,
      minOrderAmount: adParams.minAmount,
      maxOrderAmount: adParams.maxAmount,
      paymentMethod: selectedPaymentMethod,
      status: "ONLINE", // Assume it's online after creation
    });

    logger.info("✅ Advertisement successfully created", {
      advertisementId: dbAd.id,
      bybitAdId: itemId,
      accountId: account.accountId,
      price: adParams.price,
      quantity: adParams.quantity,
      paymentMethod: selectedPaymentMethod,
    });

    return {
      advertisementId: itemId, // Return Bybit's itemId
      dbAdvertisementId: dbAd.id, // Also return DB advertisement ID
      bybitAccountId: account.accountId,
      price: adParams.price,
      quantity: adParams.quantity,
    };
  }

  /**
   * Get active accounts
   */
  async getActiveAccounts(): Promise<BybitAccount[]> {
    return await db.getActiveBybitAccounts();
  }

  /**
   * Get client for account
   */
  getClient(accountId: string): any {
    return this.manager.getClient(accountId);
  }

  /**
   * Send chat message for transaction
   */
  async sendChatMessage(transactionId: string, message: string): Promise<void> {
    const transaction = await db.getTransactionWithDetails(transactionId);
    if (!transaction || !transaction.orderId) {
      throw new Error("Transaction not found or no order ID");
    }

    const accountId = transaction.advertisement.bybitAccountId;

    await this.manager.sendChatMessage(
      {
        orderId: transaction.orderId,
        message,
        messageType: "TEXT",
      },
      accountId,
    );

    // Save message to database
    await db.createChatMessage({
      transactionId: transaction.id,
      messageId: `sent_${Date.now()}`,
      sender: "us",
      message: message,  // Fixed: use message field instead of content
      messageType: "TEXT",
    });
  }

  /**
   * Release assets for order
   */
  async releaseAssets(transactionId: string): Promise<void> {
    const transaction = await db.getTransactionWithDetails(transactionId);
    if (!transaction || !transaction.orderId) {
      throw new Error("Transaction not found or no order ID");
    }

    const accountId = transaction.advertisement.bybitAccountId;

    await this.manager.releaseAssets(transaction.orderId, accountId);

    // Update transaction status
    await db.updateTransaction(transactionId, {
      status: "completed",
      completedAt: new Date(),
    });
  }

  /**
   * Start chat polling for transaction
   */
  async startChatPolling(transactionId: string): Promise<void> {
    const transaction = await db.getTransactionWithDetails(transactionId);
    if (!transaction || !transaction.orderId) {
      throw new Error("Transaction not found or no order ID");
    }

    const accountId = transaction.advertisement.bybitAccountId;

    this.manager.startChatPolling(transaction.orderId, 3000, accountId);
  }

  /**
   * Clear payment methods cache for an account
   */
  clearPaymentMethodsCache(accountId?: string): void {
    if (accountId) {
      this.paymentMethodsCache.delete(accountId);
      this.paymentMethodsCacheTime.delete(accountId);
    } else {
      // Clear all cache
      this.paymentMethodsCache.clear();
      this.paymentMethodsCacheTime.clear();
    }
  }

  /**
   * Get active advertisement count from Bybit API
   */
  async getActiveAdCountFromBybit(accountId: string): Promise<number> {
    try {
      logger.info("🔍 Checking active ads from Bybit", { accountId });

      // Ensure service is initialized
      await this.ensureInitialized();

      const myAds = await this.manager.getMyAdvertisements(accountId);

      // Check if response is valid
      if (!myAds || typeof myAds !== "object") {
        logger.warn(`Invalid response from getMyAdvertisements`, {
          response: myAds,
        });
        return 0;
      }

      // Check if list property exists and is an array
      if (!myAds.list || !Array.isArray(myAds.list)) {
        logger.warn(`No advertisement list in response`, {
          response: myAds,
        });
        return 0;
      }

      // Count only ONLINE ads (status 10 = ONLINE, 20 = OFFLINE, 30 = COMPLETED)
      const activeAds = myAds.list.filter(
        (ad) => ad && (ad.status === "ONLINE" || ad.status === 10),
      );

      logger.info("📊 Active advertisement count", {
        accountId,
        totalAds: myAds.list.length,
        activeAds: activeAds.length,
        adStatuses: myAds.list.map((ad) => ({ id: ad.id, status: ad.status })),
      });

      return activeAds.length;
    } catch (error) {
      logger.error(`Failed to get ad count from Bybit`, error as Error);
      // Fall back to database count
      return await db.countActiveAdvertisementsByAccount(accountId);
    }
  }

  /**
   * List all available payment methods for an account
   */
  async listPaymentMethods(accountId: string): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      bankName?: string;
      isEnabled?: boolean;
      mappedName?: string;
      accountNo?: string;
    }>
  > {
    const paymentMethods = await this.manager.getPaymentMethods(accountId);

    logger.info(`listPaymentMethods - Raw response`, {
      paymentMethods,
    });

    if (!Array.isArray(paymentMethods)) {
      logger.error(`Payment methods response is not an array`);
      return [];
    }

    return paymentMethods
      .filter((method) => method.id !== "-1") // Skip internal Balance payment method
      .map((method) => {
        const id = String(method.id);
        const paymentName = method.paymentConfigVo?.paymentName || "";
        const type = String(method.paymentType);
        const bankName = method.bankName || undefined;
        const accountNo = method.accountNo || undefined;
        const isEnabled = method.online === "1";

        // Try to map the payment method name
        let mappedName: string | undefined;
        if (paymentName.toLowerCase().includes("tinkoff")) {
          mappedName = "Tinkoff";
        } else if (
          paymentName.toLowerCase().includes("sbp") ||
          paymentName.toLowerCase().includes("fast payment")
        ) {
          mappedName = "SBP";
        } else if (bankName?.toLowerCase().includes("tinkoff")) {
          mappedName = "Tinkoff";
        } else if (bankName?.toLowerCase().includes("sbp")) {
          mappedName = "SBP";
        } else {
          // Use type mapping
          mappedName = this.getPaymentMethodNameByType(type) || undefined;
        }

        // Generate display name
        let displayName = paymentName;
        if (!displayName) {
          if (mappedName) {
            displayName = `${mappedName} (Type ${type})`;
          } else {
            displayName = `Payment Type ${type}`;
          }
        }

        return {
          id: id,
          name: displayName,
          type: type,
          bankName: bankName,
          isEnabled: isEnabled,
          mappedName: mappedName,
          accountNo: accountNo,
        };
      });
  }

  /**
   * Get all active orders for all accounts
   */
  async getAllActiveOrders(): Promise<any[]> {
    await this.ensureInitialized();

    logger.info("🔍 [getAllActiveOrders] Starting to fetch all active orders");
    console.log("\n[getAllActiveOrders] Starting to fetch all active orders...");
    const accounts = await db.getActiveBybitAccounts();
    logger.info(`📊 [getAllActiveOrders] Found ${accounts.length} active Bybit accounts`);
    console.log(`[getAllActiveOrders] Found ${accounts.length} active Bybit accounts`);
    const allOrders: any[] = [];

    for (const account of accounts) {
      try {
        const client = this.manager.getClient(account.accountId);
        if (!client) continue;

        const httpClient = (client as any).httpClient;

        // Get orders with various active statuses:
        // 5: waiting for chain
        // 10: waiting for buyer to pay
        // 20: waiting for seller to release
        // 30: appealing
        // 40: completed (for recent transactions)
        // 90: waiting buyer select tokenId
        // 100: objectioning
        // 110: waiting for user to raise objection
        const statuses = [5, 10, 20, 30, 40, 90, 100, 110];

        // Try pending orders endpoint first
        try {
          logger.info(
            `Checking pending orders for account ${account.accountId}`,
            {
              accountId: account.accountId,
            },
          );

          const pendingResponse = await httpClient.post(
            "/v5/p2p/order/pending/simplifyList",
            {
              page: 1,
              size: 50,
            },
          );

          if (pendingResponse.result) {
            // Check different response structures
            let items = [];
            if (pendingResponse.result.result?.items) {
              items = pendingResponse.result.result.items;
            } else if (pendingResponse.result.items) {
              items = pendingResponse.result.items;
            }

            if (items.length > 0) {
              logger.info(`Pending endpoint returned ${items.length} items`, {
                itemCount: items.length,
              });
              console.log(`[getAllActiveOrders] Pending endpoint returned ${items.length} items for ${account.accountId}`);

              for (const order of items) {
                if (statuses.includes(order.status)) {
                  console.log(`[getAllActiveOrders] Found active order ${order.id} with status ${order.status}`);
                  allOrders.push({
                    ...order,
                    bybitAccountId: account.accountId,
                  });
                }
              }
            } else {
              logger.info(
                `Pending endpoint returned count=${pendingResponse.result.count || 0} but no items`,
                {
                  count: pendingResponse.result.count || 0,
                },
              );
              console.log(`[getAllActiveOrders] Pending endpoint returned count=${pendingResponse.result.count || 0} but no items`);
            }
          }
        } catch (error: any) {
          logger.info(`Pending endpoint failed, trying regular endpoint...`);
          console.log(`[getAllActiveOrders] Pending endpoint failed for ${account.accountId}: ${error.message}`);
        }

        // Also try regular orders endpoint
        try {
          const response = await httpClient.post("/v5/p2p/order/simplifyList", {
            page: 1,
            size: 50,
          });

          if (response.result?.result) {
            const result = response.result.result;

            // Check different possible response structures
            let items = [];
            if (Array.isArray(result.items)) {
              items = result.items;
            } else if (Array.isArray(result)) {
              items = result;
            }

            if (items.length > 0) {
              logger.info(`Regular endpoint returned ${items.length} items`, {
                itemCount: items.length,
              });
              console.log(`[getAllActiveOrders] Regular endpoint returned ${items.length} items for ${account.accountId}`);

              // Filter for active statuses and avoid duplicates
              const activeOrders = items.filter(
                (order: any) =>
                  statuses.includes(order.status) &&
                  !allOrders.find((o) => o.id === order.id),
              );
              
              console.log(`[getAllActiveOrders] Found ${activeOrders.length} active orders after filtering`);
              
              // Log all orders with their statuses for debugging
              items.slice(0, 5).forEach((order: any) => {
                console.log(`[getAllActiveOrders] Order ${order.id}: status=${order.status}, itemId=${order.itemId}`);
              });

              for (const order of activeOrders) {
                allOrders.push({
                  ...order,
                  bybitAccountId: account.accountId,
                });
              }
            }
          }
        } catch (error: any) {
          logger.error(
            `Error fetching orders for account ${account.accountId}`,
            error as Error,
            {
              accountId: account.accountId,
            },
          );
        }

        // Try using the P2P client's getOrders method directly
        try {
          const orders = await client.getOrders(1, 50);
          if (orders.list && orders.list.length > 0) {
            logger.info(
              `Direct getOrders returned ${orders.list.length} items`,
              {
                itemCount: orders.list.length,
              },
            );

            const activeOrders = orders.list.filter(
              (order: any) =>
                statuses.includes(order.status) &&
                !allOrders.find((o) => o.id === order.id),
            );

            for (const order of activeOrders) {
              allOrders.push({
                ...order,
                bybitAccountId: account.accountId,
              });
            }
          }
        } catch (error: any) {
          logger.error(`Direct getOrders failed`, error as Error);
        }
      } catch (error) {
        logger.error(
          `Error processing account ${account.accountId}`,
          error as Error,
          {
            accountId: account.accountId,
          },
        );
      }
    }

    logger.info(`Total active orders found: ${allOrders.length}`, {
      totalOrders: allOrders.length,
    });
    console.log(`[getAllActiveOrders] Total active orders found: ${allOrders.length}`);
    if (allOrders.length > 0) {
      console.log("[getAllActiveOrders] Order IDs:", allOrders.map(o => o.id).join(", "));
    }
    return allOrders;
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId: string, accountId: string): Promise<any> {
    await this.ensureInitialized();

    const client = this.manager.getClient(accountId);
    if (!client) {
      throw new Error(`No client found for account ${accountId}`);
    }

    const httpClient = (client as any).httpClient;

    logger.info("Getting order details", { orderId, accountId });

    try {
      const response = await httpClient.post("/v5/p2p/order/info", {
        orderId: orderId,
      });

      if (response.result?.result) {
        return response.result.result;
      } else if (response.result) {
        return response.result;
      }

      throw new Error(`Unexpected response structure for order ${orderId}`);
    } catch (error: any) {
      logger.error("Failed to get order details", error, { orderId, accountId });
      throw error;
    }
  }

  /**
   * Get PayoutAdvertisingService instance
   */
  getPayoutAdvertisingService(): PayoutAdvertisingService {
    return this.payoutAdvertisingService;
  }

  /**
   * Start order linking service
   */
  async startOrderLinking(): Promise<void> {
    // OrderLinkingService disabled - handled by ActiveOrdersMonitor
    // await this.orderLinkingService.start();
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down BybitP2PManagerService");
    
    // Stop order linking service
    this.orderLinkingService.stop();
    
    // Stop order polling
    this.manager.stopAllPolling();
    
    // Disconnect all accounts
    this.manager.disconnectAll();
    
    this.initialized = false;
    logger.info("BybitP2PManagerService shutdown complete");
  }
}
