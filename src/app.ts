import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./db";
import { Orchestrator } from "./orchestrator";
import { GateAccountManager } from "./gate";
import { BybitP2PManagerService } from "./services/bybitP2PManager";
import { ChatAutomationService } from "./services/chatAutomation";
import { CheckVerificationService } from "./services/checkVerification";
import { P2POrderProcessor } from "./services/p2pOrderProcessor";
import { ReceiptProcessorService } from "./services/receiptProcessor";
import { ActiveOrdersMonitorService } from "./services/activeOrdersMonitor";
import { InstantOrderMonitorService } from "./services/instantOrderMonitor";
import { TinkoffReceiptService } from "./services/tinkoffReceiptService";
import { CancelledOrdersService } from "./services/cancelledOrdersService";
// import { CleanupAdvertisementsService } from "./services/cleanupAdvertisementsService";
import { GmailClient, GmailManager } from "./gmail";
import { WebSocketServer } from "./webserver";
import { loadConfig } from "./utils/config";
import { createLogger } from "./logger";
import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";

const logger = createLogger("Main");

interface AppContext {
  db: typeof db;
  gateAccountManager: GateAccountManager;
  bybitManager: BybitP2PManagerService;
  chatService: ChatAutomationService;
  checkService: CheckVerificationService;
  gmailClient: GmailClient | null;
  gmailManager: GmailManager | null;
  orderProcessor: P2POrderProcessor | null;
  receiptProcessor: ReceiptProcessorService | null;
  activeOrdersMonitor: ActiveOrdersMonitorService | null;
  instantOrderMonitor: InstantOrderMonitorService | null;
  tinkoffReceiptService: TinkoffReceiptService | null;
  cancelledOrdersService: CancelledOrdersService | null;
  // cleanupAdvertisementsService: CleanupAdvertisementsService | null;
  isManualMode: boolean;
  webSocketServer?: WebSocketServer;
  mailslurpService?: any;
  receiptParsingService?: any;
  receiptPayoutLinker?: any;
  assetReleaseService?: any;
  appealSyncService?: any;
}

async function promptUser(message: string): Promise<boolean> {
  // Check environment variable first
  if (process.env.MODE === "auto") {
    console.log(
      `[promptUser] Auto mode (env) - automatically accepting: ${message}`,
    );
    return true;
  }

  const mode = await db.getSetting("mode");
  console.log(`[promptUser] Current mode: ${mode}`);

  if (mode !== "manual") {
    console.log(`[promptUser] Auto mode - automatically accepting: ${message}`);
    return true;
  }

  console.log("\n" + "=".repeat(60));
  console.log("🤖 MANUAL MODE - ACTION REQUIRED");
  console.log("=".repeat(60));
  console.log(`\n${message}\n`);

  const response = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Do you want to proceed?",
      default: true,
    },
  ]);

  console.log("=".repeat(60) + "\n");

  if (!response.proceed) {
    console.log("❌ Action cancelled by user");
  }

  return response.proceed;
}

// Helper to extract context from task context
function getContext(taskContext: any): AppContext {
  return taskContext.shared || taskContext;
}

async function main() {
  try {
    logger.info("Starting Itrader...");
    console.log("Starting Itrader...");

    // Initialize services
    const gateAccountManager = new GateAccountManager({
      cookiesDir: "./data/cookies",
    });
    const bybitManager = new BybitP2PManagerService();
    const chatService = new ChatAutomationService(bybitManager);
    // Don't start instantOrderMonitoring here - it will be started after initialization
    // Sync time with Bybit server on startup
    console.log("Synchronizing time with Bybit server...");
    try {
      const { TimeSync } = await import("./bybit/utils/timeSync");
      await TimeSync.forceSync();
      console.log("✓ Time synchronized successfully");
    } catch (error) {
      console.error("⚠️  Time sync failed, continuing anyway:", error);
    }

    // Gmail will be initialized later
    let gmailClient: any = null;
    let gmailManager: any = null;
    let orderProcessor: any = null;
    let receiptProcessor: any = null;
    let activeOrdersMonitor: any = null;
    let instantOrderMonitor: any = null;
    let tinkoffReceiptService: any = null;
    let cancelledOrdersService: any = null;
    // let cleanupAdvertisementsService: any = null;

    const checkService = new CheckVerificationService(
      null as any, // Will be set after Gmail initialization
      chatService,
    );

    logger.info("Services initialized successfully");
    console.log("Services initialized successfully");

    // Create context for global access
    const context: AppContext = {
      db,
      gateAccountManager,
      bybitManager,
      chatService,
      checkService,
      gmailClient,
      gmailManager,
      orderProcessor,
      receiptProcessor,
      activeOrdersMonitor,
      instantOrderMonitor,
      tinkoffReceiptService,
      cancelledOrdersService,
      // cleanupAdvertisementsService,
      isManualMode: false,
      mailslurpService: null, // Will be initialized later
    };

    const orchestrator = new Orchestrator({
      name: "Itrader",
      context,
    });
    
    // Set global context for exports
    globalContext = context;
    
    // Also set in global for WebSocket server access
    (global as any).appContext = context;

    // One-time initialization
    orchestrator.addOneTime("init", async (taskContext: any) => {
      const context = getContext(taskContext);
      logger.info("Initializing all accounts...");
      console.log("Initializing all accounts...");
      
      // Ensure admin account exists
      try {
        logger.info("Checking for admin account...");
        const adminAccount = await context.db.prisma.systemAccount.findUnique({
          where: { username: 'admin' }
        });
        
        if (!adminAccount) {
          logger.info("Creating default admin account...");
          console.log("⚠️  No admin account found, creating default admin account...");
          
          const { hashPassword } = await import("./webserver/utils/password");
          const defaultPassword = 'admin123';
          const passwordHash = await hashPassword(defaultPassword);
          
          const newAdmin = await context.db.prisma.systemAccount.create({
            data: {
              username: 'admin',
              passwordHash,
              role: 'admin',
              isActive: true
            }
          });
          
          logger.info("Default admin account created", {
            id: newAdmin.id,
            username: newAdmin.username
          });
          
          console.log("\n✅ Default admin account created!");
          console.log("====================================");
          console.log("Username: admin");
          console.log("Password: admin123");
          console.log("====================================");
          console.log("⚠️  IMPORTANT: Change the password after first login!\n");
        } else {
          logger.info("Admin account already exists", {
            username: adminAccount.username,
            active: adminAccount.isActive
          });
        }
      } catch (error) {
        logger.error("Failed to ensure admin account", error as Error);
        console.error("⚠️  Failed to ensure admin account:", error);
      }

      // Initialize GateAccountManager
      await context.gateAccountManager.initialize();

      // Initialize Gate accounts
      const gateAccounts = await context.db.getActiveGateAccounts();
      for (const account of gateAccounts) {
        try {
          await context.gateAccountManager.addAccount(
            account.email,
            "", // password not needed when using cookies
            false, // don't auto-login
            account.accountId, // pass accountId for cookie lookup
          );
          logger.info(`Added Gate account ${account.accountId}`, {
            accountId: account.accountId,
          });
          console.log(`[Init] Added Gate account ${account.accountId}`);

          // Set balance to 10 million RUB on initialization
          try {
            const client = context.gateAccountManager.getClient(account.email);
            if (client) {
              await client.setBalance(10_000_000);
              console.log(
                `[Init] Set balance to 10,000,000 RUB for Gate account ${account.accountId}`,
              );
            }
          } catch (balanceError) {
            console.error(
              `[Init] Failed to set balance for Gate account ${account.accountId}:`,
              balanceError,
            );
          }
        } catch (error) {
          logger.error(
            `Failed to add Gate account ${account.accountId}`,
            error as Error,
            { accountId: account.accountId },
          );
          console.error(
            `[Init] Failed to add Gate account ${account.accountId}:`,
            error,
          );
        }
      }

      // Initialize Bybit accounts
      await context.bybitManager.initialize();

      // Initialize and start MoneyReleaseService (after BybitManager is ready)
      try {
        logger.info("[Init] Starting MoneyReleaseService...");
        console.log("[Init] Starting MoneyReleaseService...");
        
        const { getMoneyReleaseService } = await import("./services/moneyReleaseService");
        const moneyReleaseService = getMoneyReleaseService(context.bybitManager);
        await moneyReleaseService.start();
        
        logger.info("[Init] ✅ MoneyReleaseService started - monitoring transactions for asset release");
        console.log("[Init] ✅ MoneyReleaseService started - monitoring transactions for asset release");
      } catch (error) {
        logger.error("Failed to start MoneyReleaseService", error as Error);
        console.error("[Init] ❌ Failed to start MoneyReleaseService:", error);
      }


      // Initialize Gmail (legacy, fallback)
      logger.info("🔐 Initializing Gmail...");
      console.log("[Init] 🔐 Initializing Gmail...");

      const gmailAccount = await context.db.getActiveGmailAccount();
      logger.info("Gmail account from DB", {
        found: !!gmailAccount,
        email: gmailAccount?.email,
      });

      if (gmailAccount) {
        try {
          // Load credentials
          const credentialsPath = path.join("data", "gmail-credentials.json");
          logger.info("Checking for Gmail credentials", {
            path: credentialsPath,
          });

          // Check if credentials file exists
          try {
            await fs.access(credentialsPath);
            logger.info("✅ Gmail credentials file found");
          } catch {
            logger.warn("Gmail credentials file not found", {
              path: credentialsPath,
            });
            console.log(
              "[Init] Gmail credentials file not found. Skipping Gmail initialization.",
            );
            return;
          }

          const credentialsContent = JSON.parse(
            await fs.readFile(credentialsPath, "utf-8"),
          );

          // Extract OAuth2 credentials (could be under 'installed' or 'web' key)
          const credentials =
            credentialsContent.installed ||
            credentialsContent.web ||
            credentialsContent;

          // Create Gmail manager with credentials
          context.gmailManager = new GmailManager({
            tokensDir: "./data/gmail-tokens",
            credentials: credentialsContent,
          });
          await context.gmailManager.initialize();

          // Add account to manager with existing tokens
          const tokens = {
            refresh_token: gmailAccount.refreshToken,
            access_token: "", // Will be refreshed automatically
            token_type: "Bearer",
            expiry_date: 0, // Force refresh on first use
            scope:
              "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send", // Add required scopes
          };

          logger.info("Adding Gmail account to manager", {
            email: gmailAccount.email,
            hasRefreshToken: !!gmailAccount.refreshToken,
          });

          await context.gmailManager.addAccountWithTokens(tokens);

          // Get client from manager
          context.gmailClient = context.gmailManager.getClient(
            gmailAccount.email,
          );
          logger.info("✅ Gmail client created and configured through manager");

          // Update check service with Gmail client
          (context.checkService as any).gmailClient = context.gmailClient;

          // Initialize order processor
          context.orderProcessor = new P2POrderProcessor(
            context.bybitManager,
            context.chatService,
            {
              pollingInterval: 10000, // 10 seconds
              maxRetries: 3,
              retryDelay: 5000,
            },
          );

          // Initialize active orders monitor
          context.activeOrdersMonitor = new ActiveOrdersMonitorService(
            context.bybitManager,
          );

          // Start active orders monitoring - DISABLED (using order_checker instead)
          // await context.activeOrdersMonitor.startMonitoring(15000); // Check every 15 seconds to avoid rate limits
          // console.log("[Init] ActiveOrdersMonitor started with 5s interval");

          // Initialize instant order monitor
          context.instantOrderMonitor = new InstantOrderMonitorService(
            context.bybitManager,
            context.chatService,
          );
          // Start instant monitoring
          await context.instantOrderMonitor.start();
          console.log("[Init] InstantOrderMonitor started");

          // OrderLinkingService starts automatically in bybitManager.initialize()
          logger.info("[Init] OrderLinkingService started automatically with BybitManager");
          console.log("[Init] ✅ OrderLinkingService is running (started with BybitManager)");

          // Initialize receipt processor
          logger.info("[Init] Initializing ReceiptProcessorService...");
          console.log("[Init] Initializing ReceiptProcessorService...");

          // Get first active gate account client
          let gateClient = null;
          logger.info("[Init] Gate accounts available", {
            count: gateAccounts.length,
          });

          if (gateAccounts.length > 0) {
            try {
              // Use email instead of accountId for getClient
              gateClient = context.gateAccountManager.getClient(
                gateAccounts[0].email,
              );
              logger.info("[Init] Got Gate client for receipt processor");
            } catch (error) {
              logger.error("[Init] Failed to get Gate client", error as Error);
            }
          }

          // Receipt processor will be initialized after WebSocket server starts
          context.receiptProcessor = null; // Will be set later
          logger.info(
            "[Init] Receipt processor will be initialized after WebSocket server starts",
          );
          console.log(
            "[Init] Receipt processor will be initialized after WebSocket server starts",
          );

          // TinkoffReceiptService DISABLED - using only ReceiptProcessorService
          // to avoid duplicate processing
          logger.info(
            "[Init] TinkoffReceiptService disabled - using ReceiptProcessorService only",
          );
          console.log(
            "[Init] TinkoffReceiptService disabled - using ReceiptProcessorService only",
          );

          logger.info(`Added Gmail account ${gmailAccount.email}`, {
            email: gmailAccount.email,
          });
          console.log(`[Init] Added Gmail account ${gmailAccount.email}`);
        } catch (error) {
          logger.error(`Failed to initialize Gmail`, error as Error);
          console.error(`[Init] Failed to initialize Gmail:`, error);
        }
      } else {
        console.log(
          "[Init] No Gmail account configured. Gmail features will be disabled.",
        );
      }

      // Check mode
      const mode = await context.db.getSetting("mode");
      context.isManualMode = mode === "manual";
      console.log(
        `[Init] Running in ${context.isManualMode ? "manual" : "automatic"} mode`,
      );

      // Initial receipt matching (without loading new ones)
      if (context.receiptProcessor) {
        try {
          logger.info("🔍 Receipt processor is initialized", {
            hasGmailClient: !!context.gmailClient,
            hasReceiptProcessor: !!context.receiptProcessor,
          });
          console.log(
            "[Init] 🔍 Receipt processor is initialized and will start checking emails every 10 seconds",
          );

          // Skip initial loading - let ReceiptProcessorService handle it
          logger.info(
            "📧 Receipt loading will be handled by ReceiptProcessorService",
          );
          console.log(
            "[Init] 📧 Receipt loading will be handled by ReceiptProcessorService automatically",
          );

          // Then try to match any unprocessed receipts
          const { ReceiptMatcher } = await import("./services/receiptMatcher");
          const matcher = new ReceiptMatcher();

          // Get unprocessed receipts
          const unprocessedReceipts = await context.db.prisma.receipt.findMany({
            where: {
              isProcessed: false,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          });

          logger.info(
            `Found ${unprocessedReceipts.length} unprocessed receipts to match`,
          );
          console.log(
            `[Init] Found ${unprocessedReceipts.length} unprocessed receipts to match`,
          );

          // Get pending payouts
          const pendingPayouts = await context.db.prisma.payout.findMany({
            where: {
              status: 5, // Waiting for confirmation
            },
            include: {
              transaction: true,
            },
          });

          logger.info(`Found ${pendingPayouts.length} pending payouts`);
          console.log(`[Init] Found ${pendingPayouts.length} pending payouts`);

          let matchCount = 0;
          for (const receipt of unprocessedReceipts) {
            for (const payout of pendingPayouts) {
              if (!payout.transaction) continue;

              try {
                const pdfBuffer = await fs.readFile(receipt.filePath);
                const matches = await matcher.matchPayoutWithReceiptBuffer(
                  payout.transaction.id,
                  pdfBuffer,
                );

                if (matches) {
                  logger.info(
                    `Matched receipt ${receipt.id} with payout ${payout.id}`,
                    {
                      receiptId: receipt.id,
                      payoutId: payout.id,
                      amount: receipt.amount,
                    },
                  );
                  console.log(
                    `[Init] ✅ Matched receipt ${receipt.id} with payout ${payout.id}`,
                  );
                  matchCount++;
                  break;
                }
              } catch (error) {
                logger.error(
                  `Error matching receipt ${receipt.id}`,
                  error as Error,
                );
              }
            }
          }

          logger.info(`Receipt matching complete: ${matchCount} matches found`);
          console.log(
            `[Init] Receipt matching complete: ${matchCount} matches found`,
          );
        } catch (error) {
          logger.error("Error loading/matching receipts", error as Error);
          console.error("[Init] Error loading/matching receipts:", error);
        }
      } else {
        logger.warn(
          "TinkoffReceiptService not initialized - skipping receipt check",
        );
        console.log(
          "[Init] ⚠️ TinkoffReceiptService not initialized - skipping receipt check",
        );
      }

      // Mark initialization as complete
      logger.info("Initialization complete!");
      console.log("[Init] Initialization complete!");

      // Now manually trigger the work acceptor for the first time
      logger.info("Triggering initial work acceptor check...");
      console.log("[Init] Triggering initial work acceptor check...");
      try {
        const workAcceptorTask = orchestrator.getTask("work_acceptor");
        if (workAcceptorTask) {
          await workAcceptorTask.fn({
            shared: context,
            taskId: "work_acceptor",
            executionCount: 0,
          });
        }
      } catch (error) {
        logger.error("Error running initial work acceptor", error as Error);
        console.error("[Init] Error running initial work acceptor:", error);
      }

      // Also trigger ad creator to check for any payouts that need ads
      console.log("[Init] Triggering initial ad creator check...");
      try {
        const adCreatorTask = orchestrator.getTask("ad_creator");
        if (adCreatorTask) {
          await adCreatorTask.fn({
            shared: context,
            taskId: "ad_creator",
            executionCount: 0,
          });
        }
      } catch (error) {
        console.error("[Init] Error running initial ad creator:", error);
      }

      // Trigger Gate payouts sync to load existing payouts with status 5
      console.log("[Init] Triggering initial Gate payouts sync...");
      try {
        const gatePayoutsSyncTask = orchestrator.getTask("gate_payouts_sync");
        if (gatePayoutsSyncTask) {
          await gatePayoutsSyncTask.fn({
            shared: context,
            taskId: "gate_payouts_sync",
            executionCount: 0,
          });
        }
      } catch (error) {
        console.error("[Init] Error running initial Gate payouts sync:", error);
      }
      
      // Initialize Receipt Parsing Service
      console.log("[Init] 🔄 Starting Receipt Parsing Service...");
      try {
        const { startReceiptParsingService } = await import("./services/receiptParsingService");
        const parsingService = await startReceiptParsingService(2000); // Check every 2 seconds
        context.receiptParsingService = parsingService;
        
        logger.info("✅ Receipt Parsing Service started", {
          interval: "2s"
        });
        console.log("[Init] ✅ Receipt Parsing Service started (checking every 2s)");
        
        // Get initial stats
        const stats = await parsingService.getStats();
        console.log(`[Init] Receipt stats: Total: ${stats.total}, Parsed: ${stats.parsed}, Unparsed: ${stats.unparsed}`);
      } catch (error) {
        logger.error("Failed to start Receipt Parsing Service", error as Error);
        console.error("[Init] Failed to start Receipt Parsing Service:", error);
      }
      
      // Initialize Receipt Payout Linker Service
      console.log("[Init] 🔗 Starting Receipt Payout Linker Service...");
      try {
        const { startReceiptPayoutLinker } = await import("./services/receiptPayoutLinkerService");
        const linkerService = await startReceiptPayoutLinker(5000); // Check every 5 seconds
        context.receiptPayoutLinker = linkerService;
        
        logger.info("✅ Receipt Payout Linker Service started", {
          interval: "5s"
        });
        console.log("[Init] ✅ Receipt Payout Linker Service started (checking every 5s)");
        
        // Get initial stats
        const linkerStats = await linkerService.getStats();
        console.log(`[Init] Linker stats: Total receipts: ${linkerStats.totalReceipts}, Linked: ${linkerStats.linkedReceipts}, Unlinked: ${linkerStats.unlinkedReceipts}`);
      } catch (error) {
        logger.error("Failed to start Receipt Payout Linker Service", error as Error);
        console.error("[Init] Failed to start Receipt Payout Linker Service:", error);
      }
      
      // Initialize Asset Release Service
      console.log("[Init] 💸 Starting Asset Release Service...");
      try {
        const { getAssetReleaseService } = await import("./services/assetReleaseService");
        const releaseService = getAssetReleaseService(context.bybitManager);
        context.assetReleaseService = releaseService;
        
        // Start periodic checking
        setInterval(async () => {
          await releaseService.checkAndReleaseAssets();
        }, 10000); // Check every 10 seconds
        
        logger.info("✅ Asset Release Service started", {
          interval: "10s"
        });
        console.log("[Init] ✅ Asset Release Service started (checking every 10s)");
        
        // Run first check immediately
        await releaseService.checkAndReleaseAssets();
      } catch (error) {
        logger.error("Failed to start Asset Release Service", error as Error);
        console.error("[Init] Failed to start Asset Release Service:", error);
      }
      
      // Initialize Cancelled Orders Service
      console.log("[Init] 🔍 Starting Cancelled Orders Service...");
      try {
        const cancelledOrdersService = new CancelledOrdersService(context.bybitManager);
        context.cancelledOrdersService = cancelledOrdersService;
        await cancelledOrdersService.start();
        
        logger.info("✅ Cancelled Orders Service started", {
          checkInterval: "5s"
        });
        console.log("[Init] ✅ Cancelled Orders Service started (checking every 5 seconds for API status and chat messages)");
      } catch (error) {
        logger.error("Failed to start Cancelled Orders Service", error as Error);
        console.error("[Init] Failed to start Cancelled Orders Service:", error);
      }
      
      // Initialize Cleanup Advertisements Service - DISABLED (marks completed transactions as cancelled incorrectly)
      // console.log("[Init] 🧹 Starting Cleanup Advertisements Service...");
      // try {
      //   const cleanupAdvertisementsService = new CleanupAdvertisementsService(context.bybitManager);
      //   context.cleanupAdvertisementsService = cleanupAdvertisementsService;
      //   await cleanupAdvertisementsService.start();
      //   
      //   logger.info("✅ Cleanup Advertisements Service started", {
      //     checkInterval: "10s"
      //   });
      //   console.log("[Init] ✅ Cleanup Advertisements Service started (checking every 10 seconds)");
      // } catch (error) {
      //   logger.error("Failed to start Cleanup Advertisements Service", error as Error);
      //   console.error("[Init] Failed to start Cleanup Advertisements Service:", error);
      // }
      
      // Initialize Cancelled Order Detector Service - DISABLED
      // console.log("[Init] 🚫 Starting Cancelled Order Detector Service...");
      // try {
      //   const { CancelledOrderDetectorService } = await import("./services/cancelledOrderDetector");
      //   const cancelledOrderDetector = new CancelledOrderDetectorService(context.bybitManager);
      //   await cancelledOrderDetector.start(5000); // Check every 5 seconds
      //   
      //   logger.info("✅ Cancelled Order Detector Service started", {
      //     checkInterval: "5s"
      //   });
      //   console.log("[Init] ✅ Cancelled Order Detector Service started (checking every 5 seconds)");
      //   
      //   // Store in context for cleanup
      //   (context as any).cancelledOrderDetector = cancelledOrderDetector;
      // } catch (error) {
      //   logger.error("Failed to start Cancelled Order Detector Service", error as Error);
      //   console.error("[Init] Failed to start Cancelled Order Detector Service:", error);
      // }
      
      // Initialize ReceiptProcessorService after email service is ready
      const hasEmailService = context.gmailManager || (await context.db.getActiveMailslurpAccount());
      if (hasEmailService && context.webSocketServer) {
        try {
          const io = context.webSocketServer.getIO();
          
          // Get Gate client if available
          let gateClient = null;
          const gateAccounts = await context.db.getActiveGateAccounts();
          if (gateAccounts.length > 0) {
            try {
              gateClient = context.gateAccountManager.getClient(gateAccounts[0].email);
              logger.info("[Init] Found Gate client for receipt processor");
            } catch (error) {
              logger.warn("[Init] Failed to get Gate client, will work without approval", error);
            }
          }
          
          // Initialize ReceiptProcessor with or without Gate client
          context.receiptProcessor = new ReceiptProcessorService(
            context.gmailManager,
            gateClient,
            context.bybitManager,
            {
              checkInterval: 10000, // 10 seconds for faster checking
              pdfStoragePath: "data/receipts",
            },
            io,
            context.chatService
          );
          
          if (gateClient) {
            logger.info("[Init] ✅ ReceiptProcessorService initialized with Gate client (full features)");
            console.log("[Init] ✅ ReceiptProcessorService initialized with Gate client (full features)");
          } else {
            logger.info("[Init] ✅ ReceiptProcessorService initialized WITHOUT Gate client (download only)");
            console.log("[Init] ✅ ReceiptProcessorService initialized WITHOUT Gate client (download only)");
          }
          
          // Start the processor
          await context.receiptProcessor.start();
          logger.info("[Init] ✅ ReceiptProcessorService started");
          console.log("[Init] ✅ ReceiptProcessorService started");
        } catch (error) {
          logger.error("[Init] Failed to initialize ReceiptProcessorService", error as Error);
          console.error("[Init] Failed to initialize ReceiptProcessorService:", error);
        }
      } else {
        logger.warn("[Init] Email service or WebSocket not available, ReceiptProcessor not initialized");
        console.log("[Init] ⚠️ Email service or WebSocket not available, ReceiptProcessor not initialized");
      }
      
      // Sync Bybit advertisements
      console.log("[Init] 🔄 Syncing Bybit advertisements...");
      try {
        const { syncAdvertisements } = await import("./services/advertisementSyncService");
        await syncAdvertisements(context.bybitManager);
        logger.info("✅ Bybit advertisements synchronized");
        console.log("[Init] ✅ Bybit advertisements synchronized");
      } catch (error) {
        logger.error("Failed to sync Bybit advertisements", error as Error);
        console.error("[Init] Failed to sync Bybit advertisements:", error);
      }
    });

    // Task 0.5: Sync payouts with status 5 from Gate.io
    orchestrator.addTask({
      id: "gate_payouts_sync",
      name: "Sync payouts with status 5 from Gate.io",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        const logger = createLogger("GatePayoutsSync");

        logger.info("Starting Gate.io payouts sync...");
        console.log(
          "[GatePayoutsSync] Starting sync for payouts with status 5...",
        );

        const accounts = await context.gateAccountManager.getAccounts();
        logger.info(`Found ${accounts.length} Gate accounts to check`);

        for (const account of accounts) {
          logger.info(`Processing account ${account.email}`);
          console.log(`[GatePayoutsSync] Processing account ${account.email}`);

          const client = context.gateAccountManager.getClient(account.id);
          if (!client) {
            logger.warn(`No client found for account ${account.id}`);
            continue;
          }

          try {
            // Get payouts with status 4 and 5
            const payouts = await client.getAvailableTransactions();
            const status5Payouts = payouts.filter((p) => p.status === 5);

            logger.info(`Found ${status5Payouts.length} payouts with status 5`);
            console.log(
              `[GatePayoutsSync] Found ${status5Payouts.length} payouts with status 5 for ${account.email}`,
            );

            for (const payout of status5Payouts) {
              try {
                // Check if payout already exists in database
                const existingPayout =
                  await context.db.prisma.payout.findUnique({
                    where: { gatePayoutId: payout.id },
                  });

                if (!existingPayout) {
                  logger.info(`New payout found: ${payout.id}`, {
                    amount: payout.amount?.trader?.["643"],
                    wallet: payout.wallet,
                  });
                  console.log(
                    `[GatePayoutsSync] 🆕 New payout ${payout.id}: ${payout.amount?.trader?.["643"]} RUB to ${payout.wallet}`,
                  );

                  // Save to database
                  await context.db.upsertPayoutFromGate(
                    payout as any,
                    account.email,
                  );
                  logger.info(`Saved payout ${payout.id} to database`);
                  console.log(
                    `[GatePayoutsSync] ✅ Saved payout ${payout.id} to database`,
                  );
                } else {
                  logger.debug(
                    `Payout ${payout.id} already exists in database`,
                  );
                }
              } catch (error) {
                logger.error(
                  `Error processing payout ${payout.id}`,
                  error as Error,
                );
                console.error(
                  `[GatePayoutsSync] Error processing payout ${payout.id}:`,
                  error,
                );
              }
            }
          } catch (error) {
            logger.error(
              `Error fetching payouts for account ${account.email}`,
              error as Error,
            );
            console.error(
              `[GatePayoutsSync] Error for account ${account.email}:`,
              error,
            );
          }
        }

        logger.info("Gate.io payouts sync completed");
        console.log("[GatePayoutsSync] Sync completed");
      },
      runOnStart: false, // Will be triggered manually in init
      interval: 5 * 60 * 1000, // Run every 5 minutes
    });

    // Task 1: Accept available transactions from Gate
    orchestrator.addTask({
      id: "work_acceptor",
      name: "Accept available transactions with status 4",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        console.log("[WorkAcceptor] Checking for new payouts...");

        const accounts = await context.gateAccountManager.getAccounts();
        console.log(
          `[WorkAcceptor] Found ${accounts.length} Gate accounts to check`,
        );

        for (const account of accounts) {
          console.log(
            `[WorkAcceptor] Processing account ${account.email} (ID: ${account.id})`,
          );
          const client = context.gateAccountManager.getClient(account.id);
          if (!client) {
            console.log(
              `[WorkAcceptor] No client found for account ${account.id}, skipping`,
            );
            continue;
          }

          try {
            // Get pending transactions (status 4)
            console.log(
              `[WorkAcceptor] Fetching pending transactions for ${account.email}...`,
            );
            const payouts = await client.getPendingTransactions();
            console.log(
              `[WorkAcceptor] Found ${payouts.length} pending payouts for ${account.email}`,
            );

            for (const payout of payouts) {
              // For pending transactions, amount is empty array until accepted
              const isAmountHidden =
                Array.isArray(payout.amount) && payout.amount.length === 0;
              const displayAmount = isAmountHidden
                ? "HIDDEN"
                : payout.amount?.trader?.["643"] || "0";

              console.log(
                `[WorkAcceptor] Processing payout ${payout.id} with amount: ${displayAmount} RUB (hidden until accepted: ${isAmountHidden})`,
              );

              // Check if already in database
              const existing = await context.db.getPayoutByGatePayoutId(
                payout.id,
              );
              if (existing) {
                console.log(
                  `[WorkAcceptor] Payout ${payout.id} already exists in database, skipping`,
                );
                continue;
              }

              console.log(`[WorkAcceptor] Payout ${payout.id} is new`);

              // For automatic mode or manual approval
              const shouldAccept = await promptUser(
                `Accept payout ${payout.id}? (Amount will be revealed after accepting)`,
              );

              if (shouldAccept) {
                console.log(
                  `[WorkAcceptor] Accepting transaction ${payout.id} to reveal details...`,
                );

                try {
                  // Accept transaction to reveal full details
                  await client.acceptTransaction(payout.id.toString());
                  console.log(
                    `[WorkAcceptor] Transaction ${payout.id} accepted, fetching updated details...`,
                  );

                  // Get the updated transaction details with revealed amount
                  const updatedPayout = await client.searchTransactionById(
                    payout.id.toString(),
                  );

                  if (updatedPayout) {
                    const revealedAmount =
                      updatedPayout.amount?.trader?.["643"] || 0;
                    console.log(
                      `[WorkAcceptor] Revealed amount for payout ${payout.id}: ${revealedAmount} RUB`,
                    );

                    // Save to database with revealed details
                    await context.db.upsertPayoutFromGate(
                      updatedPayout as any,
                      account.email,
                    );
                    console.log(
                      `[WorkAcceptor] Saved payout ${payout.id} to database with amount ${revealedAmount} RUB`,
                    );
                  } else {
                    console.error(
                      `[WorkAcceptor] Could not fetch updated details for payout ${payout.id}`,
                    );
                    // Still save the original payout data
                    await context.db.upsertPayoutFromGate(
                      payout as any,
                      account.email,
                    );
                  }
                } catch (acceptError) {
                  console.error(
                    `[WorkAcceptor] Error accepting payout ${payout.id}:`,
                    acceptError,
                  );
                }
              } else {
                console.log(`[WorkAcceptor] User rejected payout ${payout.id}`);
              }
            }
          } catch (error) {
            console.error(
              `[WorkAcceptor] Error for account ${account.email}:`,
              error,
            );
            // Log the full error stack trace
            if (error instanceof Error) {
              console.error(`[WorkAcceptor] Error details:`, error.message);
              console.error(`[WorkAcceptor] Stack trace:`, error.stack);
            }
          }
        }
      },
      runOnStart: false, // Don't run immediately, will be triggered after init
      interval: 5 * 60 * 1000, // 5 minutes
    });

    // Task 2: Create Bybit advertisements for payouts
    orchestrator.addTask({
      id: "ad_creator",
      name: "Create Bybit advertisements for accepted payouts",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        const payoutAdvertisingService = context.bybitManager.getPayoutAdvertisingService();
        
        console.log(
          "[AdCreator] Checking for payouts without advertisements...",
        );

        // Get payouts with status 5 (accepted) that don't have transactions yet
        const acceptedPayouts = await context.db.getPayoutsWithoutTransaction(5);

        console.log(
          `[AdCreator] Found ${acceptedPayouts.length} payouts with status 5 without ads`,
        );

        if (acceptedPayouts.length === 0) {
          return;
        }

        for (const payout of acceptedPayouts) {
          try {
            const amount = payout.amountTrader["643"] || 0;
            console.log(
              `[AdCreator] Processing payout ${payout.gatePayoutId} with amount ${amount} RUB`,
            );

            const shouldCreate = await promptUser(
              `Create ad for payout ${payout.gatePayoutId} (${amount} RUB)?`,
            );

            if (shouldCreate) {
              console.log(
                `[AdCreator] Creating advertisement for payout ${payout.gatePayoutId}...`,
              );

              const transaction = await payoutAdvertisingService.createAdForPayout(payout.id);
              
              if (transaction) {
                console.log(
                  `[AdCreator] ✓ Created ad ${transaction.advertisement.bybitAdId} for payout ${payout.gatePayoutId}`,
                );
              } else {
                console.log(
                  `[AdCreator] All accounts are full. Will retry for payout ${payout.gatePayoutId}`,
                );
              }
            } else {
              console.log(
                `[AdCreator] User declined to create ad for payout ${payout.gatePayoutId}`,
              );
            }
          } catch (error) {
            console.error(
              `[AdCreator] Error creating ad for payout ${payout.id}:`,
              error,
            );
          }
        }
      },
      interval: 10 * 1000, // 10 seconds
    });

    // Task 3.5: Process receipts
    orchestrator.addTask({
      id: "receipt_processor",
      name: "Process email receipts",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        logger.info("[ReceiptProcessor] Task triggered");
        console.log("[ReceiptProcessor] Task triggered");

        if (!context.receiptProcessor) {
          logger.info("[ReceiptProcessor] Receipt processor not initialized");
          console.log("[ReceiptProcessor] Receipt processor not initialized");
          return;
        }

        try {
          // Receipt processor runs its own polling loop
          if (!context.receiptProcessor.isRunning) {
            logger.info("[ReceiptProcessor] Starting receipt processor...");
            console.log("[ReceiptProcessor] Starting receipt processor...");
            await context.receiptProcessor.start();
            logger.info(
              "[ReceiptProcessor] ✅ Receipt processor started successfully",
            );
            console.log(
              "[ReceiptProcessor] ✅ Receipt processor started successfully",
            );
          } else {
            logger.debug(
              "[ReceiptProcessor] Receipt processor is already running",
            );
            console.log(
              "[ReceiptProcessor] Receipt processor is already running",
            );
          }
        } catch (error) {
          logger.error("[ReceiptProcessor] Error:", error as Error);
          console.error("[ReceiptProcessor] Error:", error);
        }
      },
      runOnStart: true,
      interval: 5 * 60 * 1000, // Check every 5 minutes if still running
    });

    // Task 3.6: DISABLED - Using Task 4.5 instead to avoid duplicate processing
    // orchestrator.addTask({
    //   id: "chat_processor",
    //   name: "Process chat messages",
    //   fn: async (taskContext: any) => {
    //     const context = getContext(taskContext);
    //
    //     try {
    //       // Still process unprocessed messages in case instant monitor misses any
    //       await context.chatService.processUnprocessedMessages();
    //     } catch (error) {
    //       console.error("[ChatProcessor] Error:", error);
    //     }
    //   },
    //   runOnStart: true,
    //   interval: 5 * 1000, // Process every 5 seconds as backup
    // });

    // Task 3.7: Check for active orders periodically
    orchestrator.addTask({
      id: "order_checker",
      name: "Check for active Bybit orders",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);

        // Skip if bybitManager is not initialized
        if (!context.bybitManager) {
          return;
        }

        console.log("\n[OrderChecker] ========= CHECKING ORDERS =========");
        console.log(`[OrderChecker] Time: ${new Date().toLocaleString()}`);

        try {
          const accounts = await context.bybitManager.getActiveAccounts();

          // Skip if no accounts
          if (accounts.length === 0) {
            console.log("[OrderChecker] No Bybit accounts available yet");
            return;
          }
          let totalActiveOrders = 0;

          for (const account of accounts) {
            let client;
            try {
              client = context.bybitManager.getClient(account.accountId);
            } catch (error) {
              console.log(`[OrderChecker] Client not ready for account ${account.accountId}, skipping`);
              continue;
            }
            if (!client) continue;

            console.log(
              `\n[OrderChecker] 📋 Checking account: ${account.accountId}`,
            );

            // Get all orders
            const ordersResult = await client.getOrdersSimplified({
              page: 1,
              size: 20,
            });

            console.log(`   Found ${ordersResult.count} total orders`);

            if (ordersResult.items && ordersResult.items.length > 0) {
              // Log first few orders with their statuses
              console.log(`   First few orders:`);
              // Show first 5 orders and get their details
              for (const order of ordersResult.items.slice(0, 5)) {
                console.log(`     Order ${order.id}: status=${order.status}, itemId=${order.itemId}`);
                
                // Get details for orders without itemId
                if (!order.itemId) {
                  try {
                    const httpClient = (client as any).httpClient;
                    const orderInfo = await httpClient.post("/v5/p2p/order/info", {
                      orderId: order.id
                    });
                    
                    if (orderInfo.retCode === 0 && orderInfo.result) {
                      const itemId = orderInfo.result.itemId;
                      console.log(`       → Got itemId via API: ${itemId}`);
                      order.itemId = itemId; // Update order object
                      
                      // Log order details
                      logger.info("📦 Order details fetched", {
                        orderId: order.id,
                        status: orderInfo.result.status,
                        itemId: itemId,
                        amount: orderInfo.result.amount,
                        currency: orderInfo.result.currencyId,
                        counterparty: orderInfo.result.targetNickName,
                        side: orderInfo.result.side === 1 ? "SELL" : "BUY"
                      });
                    }
                  } catch (error) {
                    console.log(`       → Failed to get details: ${error.message}`);
                  }
                }
              }
              
              // Count active orders
              const activeOrders = ordersResult.items.filter(
                (order: any) => order.status === 10 || order.status === 20,
              );

              totalActiveOrders += activeOrders.length;

              // Also check recent cancelled/completed orders (last 24 hours)
              const recentOrders = ordersResult.items.filter((order: any) => {
                if (!order.createDate) return false;
                const orderTime = parseInt(order.createDate);
                const hoursSinceOrder = (Date.now() - orderTime) / (1000 * 60 * 60);
                return hoursSinceOrder < 24; // Last 24 hours
              });
              
              console.log(`   📊 Recent orders (last 24h): ${recentOrders.length}`);
              
              // Process recent orders to ensure they're linked
              for (const order of recentOrders.slice(0, 3)) { // Check first 3 recent orders
                if (!order.itemId) continue;
                
                logger.info("🔍 Checking recent order linking", {
                  orderId: order.id,
                  status: order.status,
                  itemId: order.itemId,
                  createdAt: new Date(parseInt(order.createDate || "0")).toISOString()
                });
                
                // Check if order is linked to transaction
                const existingTx = await context.db.getTransactionByOrderId(order.id);
                if (!existingTx && order.itemId) {
                  const advertisement = await context.db.getAdvertisementByBybitId(order.itemId);
                  if (advertisement) {
                    const transactions = await context.db.getActiveTransactions();
                    const tx = transactions.find(t => t.advertisementId === advertisement.id && !t.orderId);
                    if (tx) {
                      console.log(`   🔗 Linking recent order ${order.id} to transaction ${tx.id}`);
                      await context.db.updateTransaction(tx.id, {
                        orderId: order.id
                      });
                    }
                  }
                }
              }

              if (activeOrders.length > 0) {
                console.log(`   ✅ Active orders: ${activeOrders.length}`);

                // Process each active order
                for (const order of activeOrders) {
                  console.log(`\n   📦 Order: ${order.id}`);
                  console.log(
                    `      Status: ${order.status} (${order.status === 10 ? "Payment in processing" : "Waiting for coin transfer"})`,
                  );
                  console.log(
                    `      Amount: ${order.amount} ${order.currencyId}`,
                  );
                  console.log(`      Counterparty: ${order.targetNickName}`);
                  
                  // Get order details if itemId is missing
                  let itemId = order.itemId;
                  if (!itemId) {
                    console.log(`      Getting order details to find itemId...`);
                    try {
                      const httpClient = (client as any).httpClient;
                      const orderInfo = await httpClient.post("/v5/p2p/order/info", {
                        orderId: order.id
                      });
                      
                      if (orderInfo.retCode === 0 && orderInfo.result) {
                        itemId = orderInfo.result.itemId;
                        console.log(`      ✅ Found itemId: ${itemId}`);
                      }
                    } catch (error) {
                      console.log(`      ❌ Failed to get order details`);
                    }
                  }

                  // Get chat messages for this order
                  const chatResponse = await client.getChatMessages(
                    order.id,
                    1,
                    10,
                  );

                  let messages = [];
                  if (Array.isArray(chatResponse)) {
                    messages = chatResponse;
                  } else if (chatResponse && chatResponse.list) {
                    messages = chatResponse.list;
                  } else if (chatResponse && chatResponse.result) {
                    messages = chatResponse.result;
                  }

                  console.log(
                    `      📨 Found ${messages.length} chat messages`,
                  );

                  // Check who sent messages
                  // System messages have msgType=0 or contain specific patterns
                  const systemMessages = messages.filter(
                    (msg: any) =>
                      msg.msgType === 0 ||
                      msg.message?.includes("Be careful not to be fooled") ||
                      msg.message?.includes("A buyer has submitted an order") ||
                      msg.message?.includes("‼️ЧИТАЕМ‼️"),
                  );

                  // Our messages are from our userId but NOT system messages
                  const ourMessages = messages.filter(
                    (msg: any) =>
                      msg.userId === order.userId &&
                      msg.msgType !== 0 &&
                      !msg.message?.includes("Be careful not to be fooled") &&
                      !msg.message?.includes(
                        "A buyer has submitted an order",
                      ) &&
                      !msg.message?.includes("‼️ЧИТАЕМ‼️"),
                  );

                  // Their messages are from different userId
                  const theirMessages = messages.filter(
                    (msg: any) => msg.userId !== order.userId,
                  );

                  console.log(
                    `      📊 System: ${systemMessages.length}, Our: ${ourMessages.length}, Their: ${theirMessages.length}`,
                  );

                  // Debug: show message details
                  if (messages.length > 0) {
                    console.log(`      🔍 Order userId: ${order.userId}`);
                    messages.slice(0, 3).forEach((msg: any, idx: number) => {
                      console.log(
                        `      Message ${idx + 1}: userId=${msg.userId}, msgType=${msg.msgType}, nickName=${msg.nickName}, text="${msg.message?.substring(0, 50)}..."`,
                      );
                    });
                  }

                  if (messages.length > 0) {
                    const latestMsg = messages[0];
                    console.log(
                      `      💬 Latest: "${latestMsg.message?.substring(0, 60)}..."`,
                    );
                  }

                  // Check if we have a transaction for this order
                  let transaction = await context.db.getTransactionByOrderId(
                    order.id,
                  );

                  if (!transaction) {
                    console.log(`      ⚠️ No transaction found for order ${order.id}`);
                    
                    // Try to find transaction by itemId
                    if (itemId) {
                      console.log(`      🔍 Searching for transaction by itemId: ${itemId}`);
                      
                      const advertisement = await context.db.getAdvertisementByBybitId(itemId);
                      if (advertisement) {
                        console.log(`      ✅ Found advertisement for itemId: ${itemId}`);
                        
                        // Find transaction for this advertisement
                        const transactions = await context.db.getActiveTransactions();
                        const existingTransaction = transactions.find(t => t.advertisementId === advertisement.id);
                        
                        if (existingTransaction) {
                          console.log(`      ✅ Found transaction ${existingTransaction.id} for advertisement`);
                          
                          // Update transaction with orderId
                          if (!existingTransaction.orderId) {
                            console.log(`      🔗 Linking order to transaction...`);
                            await context.db.updateTransaction(existingTransaction.id, {
                              orderId: order.id,
                              status: order.status === 10 ? "chat_started" : order.status === 20 ? "waiting_payment" : "processing"
                            });
                            console.log(`      ✅ Order linked successfully!`);
                          } else {
                            console.log(`      ✅ Order already linked`);
                          }
                          
                          // Continue processing with this transaction
                          transaction = await context.db.getTransactionWithDetails(existingTransaction.id);
                        } else {
                          console.log(`      ❌ No transaction found for advertisement ${advertisement.id}`);
                          continue;
                        }
                      } else {
                        console.log(`      ❌ No advertisement found for itemId ${itemId}`);
                        continue;
                      }
                    } else {
                      console.log(`      ❌ No itemId available, cannot link order`);
                      continue;
                    }
                  } else {
                    // Transaction found by orderId
                    console.log(
                      `      ✅ Transaction exists: ${transaction.id}`,
                    );
                    
                    // Update status if it's still pending
                    if (transaction.status === "pending") {
                      console.log(`      📝 Updating transaction status from pending to chat_started`);
                      await context.db.updateTransaction(transaction.id, {
                        status: order.status === 10 ? "chat_started" : order.status === 20 ? "waiting_payment" : "processing"
                      });
                      transaction = await context.db.getTransactionWithDetails(transaction.id);
                    }
                  }

                  // Skip if transaction is marked as stupid
                  if (transaction.status === "stupid") {
                    console.log(`      ⚠️ Skipping order - marked as stupid`);
                    continue;
                  }

                  // Check if we already have messages in database
                  const dbMessages = await context.db.getChatMessages(
                    transaction.id,
                  );
                  const ourDbMessages = dbMessages.filter(
                    (msg) => msg.sender === "us",
                  );

                  // Save their messages to database
                  for (const msg of theirMessages) {
                    const existingMsg =
                      await context.db.getChatMessageByMessageId(msg.id);
                    if (!existingMsg) {
                      await context.db.createChatMessage({
                        transactionId: transaction.id,
                        messageId: msg.id,
                        sender: "them",
                        content: msg.message || "",
                        messageType:
                          msg.contentType === "pic" ? "IMAGE" : "TEXT",
                        sentAt: new Date(parseInt(msg.createDate)),
                        isProcessed: false,
                      });
                      console.log(
                        `      💾 Saved their message: "${msg.message?.substring(0, 50)}..."`,
                      );
                    }
                  }

                  // Start chat automation if needed
                  if (
                    ourMessages.length === 0 &&
                    ourDbMessages.length === 0 &&
                    order.status === 10
                  ) {
                    console.log(
                      `      📝 No messages from us - starting chat automation`,
                    );
                    
                    try {
                      await context.chatService.startAutomation(transaction.id);
                      console.log(`      ✅ Chat automation started successfully`);
                    } catch (error) {
                      console.error(`      ❌ Failed to start chat automation:`, error);
                    }
                  } else if (
                    ourMessages.length > 0 ||
                    ourDbMessages.length > 0
                  ) {
                    console.log(
                      `      ✅ We already sent messages (API: ${ourMessages.length}, DB: ${ourDbMessages.length})`,
                    );
                  }
                }
              }
            }
          }

          console.log(
            `\n[OrderChecker] Total active orders found: ${totalActiveOrders}`,
          );
          console.log(
            "[OrderChecker] ==========================================\n",
          );
        } catch (error) {
          console.error("[OrderChecker] Error:", error);
        }
      },
      runOnStart: true,
      interval: 10 * 1000, // Check every 10 seconds to avoid rate limits
    });

    // Task 3.8: Aggressive chat monitor for active orders - DISABLED (handled by ActiveOrdersMonitor)
    /*
    orchestrator.addTask({
      id: "chat_monitor",
      name: "Monitor chats for active orders",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);

        // Skip if not initialized
        if (!context.bybitManager || !context.db) {
          return;
        }

        try {
          const accounts = await context.bybitManager.getActiveAccounts();

          if (accounts.length === 0) {
            return;
          }

          for (const account of accounts) {
            let client;
            try {
              client = context.bybitManager.getClient(account.accountId);
            } catch (error) {
              // Skip if client not ready
              continue;
            }
            if (!client) continue;

            // Get active orders
            const ordersResult = await client.getOrdersSimplified({
              page: 1,
              size: 20,
              status: 10, // Only payment in processing
            });

            if (ordersResult.items && ordersResult.items.length > 0) {
              for (const order of ordersResult.items) {
                // Get chat messages
                try {
                  const chatResponse = await client.getChatMessages(
                    order.id,
                    1,
                    5,
                  );

                  let messages = [];
                  if (Array.isArray(chatResponse)) {
                    messages = chatResponse;
                  } else if (chatResponse && chatResponse.list) {
                    messages = chatResponse.list;
                  } else if (chatResponse && chatResponse.result) {
                    messages = chatResponse.result;
                  }

                  // Check if we sent any messages (excluding system messages)
                  const ourMessages = messages.filter(
                    (msg: any) =>
                      msg.userId === order.userId &&
                      msg.msgType !== 0 &&
                      !msg.message?.includes("Be careful not to be fooled") &&
                      !msg.message?.includes(
                        "A buyer has submitted an order",
                      ) &&
                      !msg.message?.includes("‼️ЧИТАЕМ‼️"),
                  );

                  // Also check database for sent messages
                  let existingTransaction =
                    await context.db.getTransactionByOrderId(order.id);
                  if (existingTransaction) {
                    // Skip if transaction is marked as stupid
                    if (existingTransaction.status === "stupid") {
                      continue;
                    }

                    const dbMessages = await context.db.getChatMessages(
                      existingTransaction.id,
                    );
                    const ourDbMessages = dbMessages.filter(
                      (msg) => msg.sender === "us",
                    );
                    if (ourDbMessages.length > 0) {
                      continue; // Skip if we already sent messages
                    }
                  }

                  if (ourMessages.length === 0 && order.status === 10) {
                    console.log(
                      `\n[ChatMonitor] 🆕 Order ${order.id} needs initial message`,
                    );
                    console.log(
                      `[ChatMonitor] Amount: ${order.amount} ${order.currencyId}`,
                    );
                    console.log(
                      `[ChatMonitor] Counterparty: ${order.targetNickName}`,
                    );

                    // Check if transaction exists
                    let transaction = existingTransaction;

                    // If no transaction found by orderId, try to find by itemId
                    if (!transaction && order.itemId) {
                      console.log(
                        `[ChatMonitor] No transaction by orderId, searching by itemId: ${order.itemId}`,
                      );
                      
                      const advertisement = await context.db.getAdvertisementByBybitId(order.itemId);
                      if (advertisement) {
                        transaction = await context.db.prisma.transaction.findFirst({
                          where: { advertisementId: advertisement.id },
                          include: {
                            advertisement: {
                              include: { bybitAccount: true }
                            },
                            payout: true
                          }
                        });
                        
                        if (transaction) {
                          console.log(
                            `[ChatMonitor] Found transaction by advertisement: ${transaction.id}`,
                          );
                          // Update transaction with orderId
                          await context.db.updateTransaction(transaction.id, {
                            orderId: order.id,
                            status: "chat_started"
                          });
                        }
                      }
                    }

                    if (!transaction) {
                      console.log(
                        `[ChatMonitor] No transaction found for order ${order.id}, skipping`,
                      );
                      continue;
                    }

                    // Start chat automation instead of sending directly
                    try {
                      await context.chatService.startAutomation(transaction.id);
                      console.log(
                        `[ChatMonitor] ✅ Started chat automation for order ${order.id}`,
                      );
                    } catch (error) {
                      console.error(
                        `[ChatMonitor] Failed to start automation:`,
                        error,
                      );
                    }
                  }
                } catch (error) {
                  // Silent fail for individual orders
                }
              }
            }
          }
        } catch (error) {
          // Silent fail
        }
      },
      runOnStart: true,
      interval: 3 * 1000, // Check every 3 seconds (reduced frequency to prevent race conditions)
    });
    */

    // Task 4.5: Process incoming chat messages every 1 second
    orchestrator.addTask({
      id: "chat_processor",
      name: "Process incoming chat messages",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        try {
          // Process unprocessed messages
          await context.chatService.processUnprocessedMessages();
        } catch (error) {
          console.error("[ChatProcessor] Error:", error);
        }
      },
      runOnStart: true,
      interval: 1 * 1000, // Check every 1 second for instant response
    });

    // Task 4.6: Process chats for transactions with orders
    orchestrator.addTask({
      id: "transaction_chat_processor",
      name: "Process chats for transactions with orders",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        try {
          // Get all active transactions with orders
          const transactions = await context.db.prisma.transaction.findMany({
            where: {
              orderId: { not: null },
              status: { in: ["chat_started", "waiting_payment", "payment_received", "processing"] }
            },
            include: {
              advertisement: {
                include: { bybitAccount: true }
              },
              chatMessages: {
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            }
          });

          logger.info("🔍 [TransactionChatProcessor] Checking transactions with orders", {
            count: transactions.length,
            transactionIds: transactions.map(t => t.id)
          });

          for (const transaction of transactions) {
            if (!transaction.orderId || !transaction.advertisement?.bybitAccount) continue;

            try {
              const client = context.bybitManager.getClient(transaction.advertisement.bybitAccount.accountId);
              if (!client) continue;

              // Get chat messages from Bybit
              const chatResponse = await client.getChatMessages(transaction.orderId, 1, 50);
              
              let messages = [];
              if (Array.isArray(chatResponse)) {
                messages = chatResponse;
              } else if (chatResponse && chatResponse.list) {
                messages = chatResponse.list;
              } else if (chatResponse && chatResponse.result) {
                messages = chatResponse.result;
              }

              if (messages.length > 0) {
                logger.info("💬 [TransactionChatProcessor] Found messages", {
                  transactionId: transaction.id,
                  orderId: transaction.orderId,
                  messageCount: messages.length
                });

                // Save new messages
                for (const msg of messages) {
                  const existingMsg = await context.db.prisma.chatMessage.findFirst({
                    where: { messageId: msg.id }
                  });

                  if (!existingMsg && msg.message) {
                    // Determine sender based on userId
                    const httpClient = (client as any).httpClient;
                    const orderInfo = await httpClient.post("/v5/p2p/order/info", {
                      orderId: transaction.orderId
                    });
                    
                    let sender = "unknown";
                    if (orderInfo.retCode === 0 && orderInfo.result) {
                      const ourUserId = orderInfo.result.userId;
                      sender = msg.userId === ourUserId ? "us" : "counterparty";
                    }

                    await context.db.saveChatMessage({
                      transactionId: transaction.id,
                      messageId: msg.id,
                      sender: sender,
                      content: msg.message || '',
                      messageType: msg.contentType === "pic" ? "IMAGE" : "TEXT",
                      isProcessed: sender === "us",
                      sentAt: new Date(parseInt(msg.createDate))
                    });

                    logger.info("💾 [TransactionChatProcessor] Saved new message", {
                      transactionId: transaction.id,
                      sender: sender,
                      preview: msg.message ? msg.message.substring(0, 50) + "..." : "[empty message]"
                    });
                  }
                }

                // Check if we need to send initial message
                const ourMessages = await context.db.prisma.chatMessage.findMany({
                  where: {
                    transactionId: transaction.id,
                    sender: "us"
                  }
                });

                if (ourMessages.length === 0 && transaction.status === "chat_started") {
                  logger.info("🤖 [TransactionChatProcessor] Starting chat automation", {
                    transactionId: transaction.id,
                    orderId: transaction.orderId
                  });
                  
                  await context.chatService.startAutomation(transaction.id);
                }
              }
            } catch (error) {
              logger.error("Error processing transaction chat", error as Error, {
                transactionId: transaction.id,
                orderId: transaction.orderId
              });
            }
          }
        } catch (error) {
          logger.error("[TransactionChatProcessor] Error:", error as Error);
        }
      },
      runOnStart: true,
      interval: 5 * 1000, // Check every 5 seconds
    });

    // Task 5: Handle failed/stuck transactions
    orchestrator.addTask({
      id: "successer",
      name: "Handle failed or stuck transactions",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        try {
          // Check for stuck transactions (no activity for 30 minutes)
          const stuckTransactions = await context.db.getStuckTransactions();

          for (const transaction of stuckTransactions) {
            console.log(
              `[Successer] Found stuck transaction ${transaction.id}`,
            );

            if (
              await promptUser(`Mark transaction ${transaction.id} as failed?`)
            ) {
              await context.db.updateTransaction(transaction.id, {
                status: "failed",
                failureReason: "Transaction stuck - no activity for 30 minutes",
              });
            }
          }
        } catch (error) {
          console.error("[Successer] Error:", error);
        }
      },
      interval: 5 * 60 * 1000, // 5 minutes
    });

    // Task 6: set gate balance 10m every 4 hours and from started
    orchestrator.addTask({
      id: "gate_balance_setter",
      name: "Set Gate balance to 10m every 4 hours",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        console.log(
          "[GateBalanceSetter] Setting balance to 10m for all Gate accounts...",
        );

        const accounts = await context.gateAccountManager.getAccounts();

        for (const account of accounts) {
          const client = context.gateAccountManager.getClient(account.id);
          if (!client) continue;

          try {
            if (
              await promptUser(
                `Set balance to 10,000,000 for Gate account ${account.id}?`,
              )
            ) {
              await client.setBalance(10_000_000); // temporary 1 instead of 10000000
              console.log(
                `[GateBalanceSetter] Set balance to 10m for account ${account.id}`,
              );
            }
          } catch (error) {
            console.error(
              `[GateBalanceSetter] Error setting balance for account ${account.email}:`,
              error,
            );
          }
        }
      },
      runOnStart: true,
      interval: 4 * 60 * 60 * 1000, // 4 hours
    });

    // Task 7: Manual trigger for receipt processor (for debugging)
    orchestrator.addTask({
      id: "receipt_processor",
      name: "Process receipts from Gmail",
      fn: async (taskContext: any) => {
        const context = getContext(taskContext);
        const logger = createLogger("ReceiptProcessor");
        
        logger.info("Task triggered");
        
        if (!context.receiptProcessor) {
          logger.warn("Receipt processor not initialized");
          return;
        }
        
        try {
          // This task is just for manual triggering
          // The ReceiptProcessorService runs its own interval
          logger.info("Receipt processor is running with its own interval");
        } catch (error) {
          logger.error("Error in receipt processor task", error as Error);
        }
      },
      runOnStart: false,
      interval: 60 * 60 * 1000, // Once per hour (just for manual trigger)
    });

    // Task 8: DISABLED - ReceiptProcessorService handles fund release
    // orchestrator.addTask({
    //   id: "fund_releaser",
    //   name: "Release funds for completed receipts",
    //   fn: async () => {
    //     // Disabled - ReceiptProcessorService handles everything
    //   },
    //   runOnStart: false,
    //   interval: 24 * 60 * 60 * 1000, // Once a day (effectively disabled)
    // });

    // Load configuration
    const config = loadConfig();

    // Initialize orchestrator
    await orchestrator.initialize();

    // Start orchestrator based on config
    if (config.orchestrator.start_paused) {
      await orchestrator.pause();
      console.log(
        "Orchestrator initialized in PAUSED state (configured in config.toml)",
      );
      console.log("Use Socket.IO API to resume: orchestrator:resume");
    } else {
      await orchestrator.start();
      logger.info("Orchestrator started successfully!");
      console.log("Orchestrator started successfully!");
    }

    // Set global context for WebSocket controllers
    (global as any).appContext = context;
    (global as any).bybitP2PManager = context.bybitManager;

    // Start WebSocket server
    const webSocketPort = parseInt(process.env.WEBSOCKET_PORT || "3002");
    const webSocketServer = new WebSocketServer(webSocketPort);

    // Set orchestrator instance in controller
    const { OrchestratorController } = await import(
      "./webserver/controllers/orchestratorController"
    );
    OrchestratorController.setOrchestrator(orchestrator);

    await webSocketServer.start();
    logger.info(`WebSocket server started on port ${webSocketPort}`, {
      port: webSocketPort,
    });
    console.log(`WebSocket server started on port ${webSocketPort}`);
    
    // Store WebSocket server reference for later use
    context.webSocketServer = webSocketServer;
    
    // Initialize MailSlurp (primary email service)
    logger.info("📧 Initializing MailSlurp...");
    console.log("📧 Initializing MailSlurp...");
    
    const mailslurpApiKey = process.env.MAILSLURP_API_KEY;
    if (mailslurpApiKey) {
      try {
        const { getMailSlurpService } = await import("./services/mailslurpService");
        const { ensureMultipleMailslurpEmails } = await import("./services/enhancedMailslurpService");
        
        const mailslurpService = await getMailSlurpService();
        const email = await mailslurpService.initialize();
        
        // Ensure we have multiple emails
        // Commented out to prevent creating new emails on each startup
        // await ensureMultipleMailslurpEmails(mailslurpService);
        
        const allEmails = mailslurpService.getEmailAddresses();
        logger.info("✅ MailSlurp initialized successfully", { 
          primaryEmail: email,
          totalEmails: allEmails.length,
          emails: allEmails 
        });
        console.log(`✅ MailSlurp initialized with ${allEmails.length} emails: ${allEmails.join(', ')}`);
        
        // Store service in context for later use
        context.mailslurpService = mailslurpService;
        
        // Set up event listeners for receipt processing
        mailslurpService.on('receipt:new', async (receipt) => {
          logger.info("📨 New receipt detected via MailSlurp", {
            receiptId: receipt.id,
            filename: receipt.filename
          });
          console.log(`[MailSlurp] 📨 New receipt: ${receipt.filename}`);
        });

        mailslurpService.on('receipt:matched', async (data) => {
          logger.info("✅ Receipt matched to transaction!", {
            receiptId: data.receipt.id,
            transactionId: data.transactionId,
            payoutId: data.payoutId
          });
          console.log(`[MailSlurp] ✅ Receipt matched! Transaction: ${data.transactionId}`);
          
          // Complete the transaction
          try {
            if (context.chatService) {
              await context.chatService.completeTransaction(data.transactionId, data.receipt.id);
            }
          } catch (error) {
            logger.error("Failed to complete transaction after receipt match", error);
          }
        });
        
        // Start monitoring for receipts
        mailslurpService.startMonitoring(60000); // Check every 60 seconds to avoid rate limits
        logger.info("📬 MailSlurp monitoring started");
        console.log("📬 MailSlurp monitoring started (checking every 60s)");
      } catch (error) {
        logger.error("Failed to initialize MailSlurp", error as Error);
        console.error("Failed to initialize MailSlurp:", error);
      }
    } else {
      logger.warn("MAILSLURP_API_KEY not configured");
      console.log("⚠️ MAILSLURP_API_KEY not configured. MailSlurp features disabled.");
    }
    
    // Initialize Bybit Appeal Sync Service
    logger.info("⚖️ Initializing Bybit Appeal Sync Service...");
    console.log("⚖️ Initializing Bybit Appeal Sync Service...");
    
    try {
      const { BybitAppealSyncService } = await import("./services/bybitAppealSyncService");
      const appealSyncService = new BybitAppealSyncService(context.bybitManager);
      
      // Start syncing every minute
      appealSyncService.start(60000);
      
      // Store in context
      context.appealSyncService = appealSyncService;
      
      logger.info("✅ Bybit Appeal Sync Service started");
      console.log("✅ Bybit Appeal Sync Service started (checking every 60s)");
    } catch (error) {
      logger.error("Failed to initialize Bybit Appeal Sync Service", error as Error);
      console.error("Failed to initialize Bybit Appeal Sync Service:", error);
    }
    
    // Start log cleanup service
    const { getLogCleanupService } = await import('./services/logCleanupService');
    const logCleanupService = getLogCleanupService();
    await logCleanupService.start();
    logger.info('Log cleanup service started');
    console.log('Log cleanup service started');

    console.log("Press Ctrl+C to stop");

    // Keep the process alive
    const keepAlive = setInterval(() => {
      // This keeps the event loop active
    }, 1000);

    // Handle graceful shutdown
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Received ${signal}, shutting down gracefully...`, {
        signal,
      });
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      clearInterval(keepAlive);

      try {
        await orchestrator.stop();

        // Stop order processor
        if (orchestrator.context.orderProcessor) {
          orchestrator.context.orderProcessor.stop();
        }

        // Stop receipt processor
        if (orchestrator.context.receiptProcessor) {
          orchestrator.context.receiptProcessor.stop();
        }

        // Stop receipt parsing service
        if (orchestrator.context.receiptParsingService) {
          orchestrator.context.receiptParsingService.stop();
        }

        // Stop active orders monitor
        if (orchestrator.context.activeOrdersMonitor) {
          await orchestrator.context.activeOrdersMonitor.cleanup();
        }

        // Stop instant order monitor
        if (orchestrator.context.instantOrderMonitor) {
          orchestrator.context.instantOrderMonitor.stop();
        }
        
        // Stop appeal sync service
        if (orchestrator.context.appealSyncService) {
          orchestrator.context.appealSyncService.stop();
        }
        
        // Stop cancelled order detector - DISABLED
        // if ((orchestrator.context as any).cancelledOrderDetector) {
        //   (orchestrator.context as any).cancelledOrderDetector.stop();
        // }

        // Stop WebSocket server
        await webSocketServer.stop();

        await db.disconnect();
        logger.info("Shutdown complete");
        console.log("Shutdown complete");
        process.exit(0);
      } catch (error) {
        logger.fatal("Error during shutdown", error as Error);
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    // Ensure proper signal handling
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Handle Windows CTRL+C
    if (process.platform === "win32") {
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.on("SIGINT", () => {
        process.emit("SIGINT" as any);
      });
    }

    // Also handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.fatal("Uncaught exception", error);
      console.error("Uncaught exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.fatal("Unhandled rejection", new Error(String(reason)), {
        promise: String(promise),
      });
      console.error("Unhandled rejection at:", promise, "reason:", reason);
      process.exit(1);
    });
  } catch (error) {
    logger.fatal("Failed to start Itrader", error as Error);
    console.error("Failed to start Itrader:", error);
    process.exit(1);
  }
}

// Export main for CLI
export default main;

// Export helper to get receipt processor
let globalContext: AppContext | null = null;
export function getReceiptProcessor(): ReceiptProcessorService | null {
  return globalContext?.receiptProcessor || null;
}

// Export helper to get BybitP2PManager
export function getBybitP2PManager(): BybitP2PManagerService | null {
  return globalContext?.bybitManager || null;
}

// Export helper to get MailSlurp service
export function getMailSlurpService(): any {
  // Try to get from context first
  if (globalContext?.mailslurpService) {
    return globalContext.mailslurpService;
  }
  
  // Otherwise try to get the singleton instance
  try {
    const { getMailSlurpServiceSync } = require('./services/mailslurpService');
    const service = getMailSlurpServiceSync();
    logger.info('getMailSlurpService called', { 
      hasGlobalContext: !!globalContext,
      hasMailslurpService: !!globalContext?.mailslurpService,
      hasSingletonService: !!service
    });
    return service;
  } catch (error) {
    logger.error('Failed to get MailSlurp service', error as Error);
    return null;
  }
}

// Check if running directly
if (require.main === module) {
  if (process.argv.includes("--cli")) {
    // Import and run CLI
    import("./cli")
      .then((cli) => {
        cli.runCLI();
      })
      .catch((error) => {
        console.error("CLI error:", error);
        process.exit(1);
      });
  } else {
    // Run main application
    main().catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
  }
}
