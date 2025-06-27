/**
 * Сервис обработки чеков и завершения транзакций
 */

import { EventEmitter } from "events";
import { PrismaClient } from "../../generated/prisma";
import { GmailManager, GmailClient } from "../gmail";
import { ReceiptMatcher } from "./receiptMatcher";
import { GateClient } from "../gate";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { EmailAttachment, GmailMessage } from "../gmail/types/models";
import { MailSlurpService, getMailSlurpService } from "./mailslurpService";
import { TinkoffReceiptParser } from "../ocr/receiptParser";
import { ChatAutomationService } from "./chatAutomation";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { createLogger } from "../logger";

const logger = createLogger('ReceiptProcessor');

const prisma = new PrismaClient();

interface ReceiptProcessorConfig {
  checkInterval?: number; // Интервал проверки почты (мс)
  pdfStoragePath?: string; // Путь для сохранения PDF
  maxRetries?: number;
}

interface ProcessedReceipt {
  id: string;
  emailId: string;
  fileName: string;
  transactionId?: string;
  payoutId?: string;
  processedAt: Date;
}

export class ReceiptProcessorService extends EventEmitter {
  private config: Required<ReceiptProcessorConfig>;
  private intervalId?: NodeJS.Timeout;
  public isRunning = false;
  private processedEmails = new Set<string>();
  private receiptMatcher: ReceiptMatcher;
  private io?: any; // WebSocket server instance
  private mailslurpService?: MailSlurpService;
  private chatAutomationService?: ChatAutomationService;

  constructor(
    private gmailManager: GmailManager,
    private gateClient: GateClient | null,
    private bybitManager: BybitP2PManagerService,
    config: ReceiptProcessorConfig = {},
    io?: any,
    chatAutomationService?: ChatAutomationService
  ) {
    super();

    this.io = io;
    this.chatAutomationService = chatAutomationService;
    this.config = {
      checkInterval: config.checkInterval || 10000, // 10 секунд
      pdfStoragePath: config.pdfStoragePath || "data/pdf",
      maxRetries: config.maxRetries || 3,
    };

    this.receiptMatcher = new ReceiptMatcher();
  }

  /**
   * Запускает обработчик чеков
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info("Receipt processor already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting receipt processor...", {
      checkInterval: this.config.checkInterval,
      pdfStoragePath: this.config.pdfStoragePath
    });

    // Создаем директорию для PDF если не существует
    await this.ensureStorageDirectory();

    // Загружаем обработанные email из БД
    await this.loadProcessedEmails();

    // Проверяем существующие payout со статусом 5
    await this.checkExistingPayouts();

    // Первая проверка сразу при запуске
    logger.info("Running initial receipt check...");
    await this.processReceipts();

    // Запускаем периодическую проверку
    this.intervalId = setInterval(() => {
      this.processReceipts().catch((error) => {
        logger.error("Error processing receipts", error);
      });
    }, this.config.checkInterval);

    logger.info("Receipt processor started successfully", {
      checkInterval: `${this.config.checkInterval / 1000}s`
    });
  }

  /**
   * Останавливает обработчик
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    logger.info("Receipt processor stopped");
  }

  /**
   * Проверяет существующие payout со статусом 5
   */
  private async checkExistingPayouts(): Promise<void> {
    if (!this.gateClient) {
      logger.debug("No Gate client available, skipping payout check");
      return;
    }
    
    try {
      const payouts = await prisma.payout.findMany({
        where: { status: 5 },
        include: { transaction: true },
      });

      logger.info("Found payouts with status 5", { count: payouts.length });

      for (const payout of payouts) {
        try {
          // Проверяем текущий статус в Gate.io
          const gatePayouts = await this.gateClient.searchPayouts({
            id: payout.gatePayoutId.toString(),
          });

          if (gatePayouts.length > 0) {
            const currentStatus = gatePayouts[0].status;

            if (currentStatus !== payout.status) {
              logger.info("Payout status changed", {
                payoutId: payout.id,
                oldStatus: payout.status,
                newStatus: currentStatus
              });

              await prisma.payout.update({
                where: { id: payout.id },
                data: {
                  status: currentStatus,
                  updatedAt: new Date(),
                },
              });

              this.emit("payoutStatusChanged", {
                payoutId: payout.id,
                oldStatus: payout.status,
                newStatus: currentStatus,
              });
            }
          }
        } catch (error) {
          logger.error("Error checking payout", error, { payoutId: payout.id });
        }
      }
    } catch (error) {
      logger.error("Error checking existing payouts", error);
    }
  }

  /**
   * Основной метод обработки чеков
   */
  private async processReceipts(): Promise<void> {
    logger.info("Starting receipt processing cycle...", {
      hasGmailManager: !!this.gmailManager,
      gmailManagerClients: this.gmailManager ? this.gmailManager.clients.size : 0,
      hasGateClient: !!this.gateClient,
      pdfPath: this.config.pdfStoragePath
    });
    
    try {
      // Try MailSlurp first
      const mailslurpAccount = await prisma.mailSlurpAccount.findFirst({
        where: { isActive: true }
      });

      if (mailslurpAccount) {
        logger.info("Found active MailSlurp account", { email: mailslurpAccount.email });
        await this.processMailSlurpReceipts();
      } else {
        // Fallback to Gmail if no MailSlurp
        const gmailAccount = await prisma.gmailAccount.findFirst({
          where: { isActive: true }
        });

        if (gmailAccount) {
          logger.info("Found active Gmail account", { email: gmailAccount.email });
          await this.processAccountReceipts(gmailAccount.email);
        } else {
          logger.warn("No active email account found (neither MailSlurp nor Gmail)");
          
          // Если нет аккаунта в БД, но есть клиенты в менеджере
          if (this.gmailManager && this.gmailManager.clients.size > 0) {
            const firstEmail = Array.from(this.gmailManager.clients.keys())[0];
            logger.warn(`No DB account, but found client in manager: ${firstEmail}`);
            await this.processAccountReceipts(firstEmail);
          }
        }
      }
    } catch (error) {
      logger.error("Error in processReceipts", error);
    }
  }

  /**
   * Process receipts from MailSlurp
   */
  private async processMailSlurpReceipts(): Promise<void> {
    try {
      if (!this.mailslurpService) {
        this.mailslurpService = await getMailSlurpService();
      }

      // Get emails from last check
      // On first run or if no recent receipts, check last 7 days
      const lastReceipt = await prisma.receipt.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      
      let checkSince: Date;
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      if (!lastReceipt) {
        // No receipts at all, check last 7 days
        checkSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        logger.info("No receipts found in DB, checking emails from last 7 days");
      } else if (lastReceipt.createdAt < oneDayAgo) {
        // Last receipt is older than 24 hours, check from that date
        checkSince = new Date(lastReceipt.createdAt.getTime() - 60 * 60 * 1000); // 1 hour before last receipt
        logger.info("Last receipt is old, checking emails from", { 
          lastReceiptDate: lastReceipt.createdAt,
          checkSince: checkSince 
        });
      } else {
        // Recent receipt exists, check from last interval
        checkSince = new Date(now.getTime() - this.config.checkInterval - 60000);
        logger.info("Recent receipt exists, checking from last interval", { checkSince });
      }
      
      await this.mailslurpService.processReceipts(checkSince);

      // Also check for any receipts already in DB that need processing
      const unprocessedReceipts = await prisma.receipt.findMany({
        where: {
          OR: [
            { processed: false },
            { 
              AND: [
                { isProcessed: true },
                { processed: false },
                { payoutId: null }
              ]
            }
          ],
          emailFrom: { contains: '@tinkoff.ru' }
        },
        orderBy: { receivedAt: 'desc' },
        take: 20
      });

      logger.info(`Found ${unprocessedReceipts.length} unprocessed receipts in DB`);

      for (const receipt of unprocessedReceipts) {
        try {
          // Parse receipt if not already parsed
          if (!receipt.parsedData || Object.keys(receipt.parsedData as any).length === 0) {
            logger.info("Parsing receipt", { receiptId: receipt.id, filepath: receipt.filePath });
            
            if (receipt.filePath) {
              try {
                const parser = new TinkoffReceiptParser();
                // Convert relative path to absolute
                const absolutePath = path.isAbsolute(receipt.filePath) 
                  ? receipt.filePath 
                  : path.join(process.cwd(), receipt.filePath);
                logger.info("Parsing PDF receipt", { filepath: absolutePath });
                const parsedData = await parser.parseReceiptPDF(absolutePath);
                
                logger.info("Successfully parsed receipt", { 
                  amount: parsedData.amount,
                  senderName: parsedData.senderName,
                  recipientName: parsedData.recipientName
                });
                
                await prisma.receipt.update({
                  where: { id: receipt.id },
                  data: {
                    amount: parsedData.amount,
                    senderName: parsedData.senderName,
                    recipientName: parsedData.recipientName,
                    recipientCard: parsedData.recipientCard,
                    transactionDate: parsedData.transactionDate ? new Date(parsedData.transactionDate) : undefined,
                    parsedData: parsedData as any,
                    rawText: parsedData.rawText
                  }
                });
              } catch (parseError) {
                logger.error("Failed to parse receipt PDF", { 
                  receiptId: receipt.id, 
                  filepath: receipt.filePath,
                  error: parseError instanceof Error ? parseError.message : String(parseError)
                });
                
                // Mark receipt as failed to parse
                await prisma.receipt.update({
                  where: { id: receipt.id },
                  data: {
                    parsedData: { error: parseError instanceof Error ? parseError.message : String(parseError) } as any,
                    processed: true, // Mark as processed to avoid retrying
                    isProcessed: true
                  }
                });
                continue; // Skip to next receipt
              }
            }
          }

          // Match with transaction
          const updatedReceipt = await prisma.receipt.findUnique({
            where: { id: receipt.id }
          });

          if (updatedReceipt && updatedReceipt.amount) {
            const matchResult = await this.receiptMatcher.matchReceiptToTransaction(updatedReceipt);
            
            if (matchResult.success && matchResult.transactionId) {
              logger.info("Receipt matched to transaction", {
                receiptId: receipt.id,
                transactionId: matchResult.transactionId,
                confidence: matchResult.confidence
              });

              // Update receipt as processed
              await prisma.receipt.update({
                where: { id: receipt.id },
                data: { 
                  processed: true,
                  isProcessed: true,
                  payoutId: matchResult.payoutId
                }
              });

              // Complete transaction
              await this.completeTransaction(matchResult.transactionId, receipt.id);
            }
          }
        } catch (error) {
          logger.error("Error processing receipt from DB", error, { receiptId: receipt.id });
        }
      }
    } catch (error) {
      logger.error("Error processing MailSlurp receipts", error);
    }
  }

  /**
   * Обрабатывает чеки для конкретного аккаунта
   */
  private async processAccountReceipts(email: string): Promise<void> {
    try {
      // Gmail manager stores clients by email
      const gmailClient = this.gmailManager.getClient(email);
      if (!gmailClient) {
        logger.error("No Gmail client found", { 
          email,
          availableClients: Array.from(this.gmailManager.clients.keys()),
          clientsSize: this.gmailManager.clients.size
        });
        // Попробуем найти клиента по другому email если он есть
        if (this.gmailManager.clients.size > 0) {
          const firstEmail = Array.from(this.gmailManager.clients.keys())[0];
          logger.warn(`Using first available client with email: ${firstEmail}`);
          const client = this.gmailManager.getClient(firstEmail);
          if (client) {
            await this.processAccountReceipts(firstEmail);
          }
        }
        return;
      }

      // Ищем письма от Тинькофф
      // Check if we have recent receipts, otherwise search last 7 days
      const lastGmailReceipt = await prisma.receipt.findFirst({
        where: { emailFrom: { contains: '@tinkoff.ru' } },
        orderBy: { createdAt: 'desc' }
      });
      
      let searchAfter: Date;
      if (!lastGmailReceipt || lastGmailReceipt.createdAt < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        // No recent receipts, search last 7 days
        searchAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        logger.info("No recent Gmail receipts, searching last 7 days");
      } else {
        // Search from today
        const today = new Date();
        searchAfter = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      }
      
      logger.info("Searching for Tinkoff emails", {
        email: email,
        after: searchAfter.toISOString(),
        sender: "noreply@tinkoff.ru"
      });
      
      const searchResult = await gmailClient.getEmailsFromSender(
        "noreply@tinkoff.ru",
        {
          after: searchAfter,
          maxResults: 100,
        },
      );

      // Проверяем, что результат - это EmailSearchResult, а не массив
      const messages = Array.isArray(searchResult) ? searchResult : searchResult.messages;

      if (!messages || messages.length === 0) {
        logger.info("No emails from Tinkoff found", { 
          email,
          after: startOfDay.toISOString()
        });
        return;
      }

      logger.info("Found emails from Tinkoff", { 
        count: messages.length, 
        email,
        messageIds: messages.slice(0, 5).map(m => m.id)
      });

      for (const message of messages) {
        if (this.processedEmails.has(message.id)) {
          continue; // Уже обработано
        }

        try {
          await this.processEmail(gmailClient, message.id);
        } catch (error) {
          logger.error("Error processing email", error, { messageId: message.id });
        }
      }
    } catch (error) {
      logger.error("Error processing receipts for email", error, { email });
    }
  }

  /**
   * Обрабатывает отдельное письмо
   */
  private async processEmail(
    gmailClient: GmailClient,
    messageId: string,
  ): Promise<void> {
    try {
      // Проверяем, не обработан ли уже этот email
      const existingReceipt = await prisma.receipt.findUnique({
        where: { emailId: messageId }
      });

      if (existingReceipt) {
        logger.info("Email already processed", { messageId });
        this.processedEmails.add(messageId);
        return;
      }

      const fullMessage = await gmailClient.getMessage(messageId);
      if (!fullMessage) {
        return;
      }

      // Проверяем есть ли PDF вложения
      const pdfAttachments = fullMessage.attachments?.filter((att) =>
        att.filename?.toLowerCase().endsWith(".pdf"),
      ) || [];

      if (pdfAttachments.length === 0) {
        return; // Нет PDF чеков
      }

      logger.info("Processing PDF attachments", { count: pdfAttachments.length, messageId });

      for (const attachment of pdfAttachments) {
        try {
          // Скачиваем PDF
          const pdfData = await gmailClient.downloadAttachment(
            messageId,
            attachment,
          );

          // Декодируем base64 в Buffer
          const pdfBuffer = Buffer.from(pdfData.data, 'base64');

          // Вычисляем хеш файла для проверки дубликатов
          const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

          // Проверяем, не обработан ли уже этот файл
          const existingReceiptByHash = await prisma.receipt.findUnique({
            where: { fileHash }
          });

          if (existingReceiptByHash) {
            logger.info("Receipt with hash already processed", { fileHash });
            continue;
          }

          // Сохраняем PDF
          const savedPath = await this.savePDF(
            pdfBuffer,
            attachment.filename || "receipt.pdf",
          );

          // Обрабатываем чек и сохраняем в БД
          await this.processReceipt(
            pdfBuffer, 
            savedPath, 
            messageId,
            fullMessage.from || 'noreply@tinkoff.ru',
            fullMessage.subject || '',
            attachment.filename || "receipt.pdf",
            fileHash
          );
        } catch (error) {
          logger.error("Error processing attachment", error, { filename: attachment.filename });
        }
      }

      // Помечаем email как обработанный
      this.processedEmails.add(messageId);

      // Сохраняем в БД
      await prisma.processedEmail
        .create({
          data: {
            emailId: messageId,
            processedAt: new Date(),
          },
        })
        .catch(() => {
          // Игнорируем если уже существует
        });
    } catch (error) {
      logger.error("Error processing email", error, { messageId });
    }
  }

  /**
   * Обрабатывает PDF чек
   */
  private async processReceipt(
    pdfBuffer: Buffer,
    filePath: string,
    emailId: string,
    emailFrom: string,
    emailSubject: string,
    attachmentName: string,
    fileHash: string,
  ): Promise<void> {
    try {
      // Парсим чек используя OCR модуль
      const parser = new TinkoffReceiptParser();
      const parsedReceipt = await parser.parseFromBuffer(pdfBuffer);
      
      if (!parsedReceipt) {
        logger.error("Failed to parse receipt");
        return;
      }

      // Сохраняем чек в базу данных
      const receipt = await prisma.receipt.create({
        data: {
          emailId,
          emailFrom,
          emailSubject,
          attachmentName,
          filePath,
          fileHash,
          amount: parsedReceipt.amount,
          bank: "Tinkoff",
          reference: `${parsedReceipt.sender} -> ${
            'recipientName' in parsedReceipt ? parsedReceipt.recipientName :
            'recipientPhone' in parsedReceipt ? parsedReceipt.recipientPhone :
            parsedReceipt.recipientCard
          }`,
          transferType: parsedReceipt.transferType,
          status: parsedReceipt.status,
          senderName: parsedReceipt.sender,
          recipientName: 'recipientName' in parsedReceipt ? parsedReceipt.recipientName : null,
          recipientPhone: 'recipientPhone' in parsedReceipt ? parsedReceipt.recipientPhone : null,
          recipientCard: parsedReceipt.recipientCard || null,
          recipientBank: 'recipientBank' in parsedReceipt ? parsedReceipt.recipientBank : null,
          commission: parsedReceipt.commission || null,
          transactionDate: parsedReceipt.datetime,
          parsedData: parsedReceipt as any,
          rawText: parser.lastExtractedText || null,
          isProcessed: false
        }
      });

      logger.info("Receipt saved to database", { receiptId: receipt.id });
      
      // Emit WebSocket event for real-time updates
      if (this.io) {
        const io = this.io;
        logger.info("Emitting WebSocket event: receipts:new", { receiptId: receipt.id });
        io.emit('receipts:new', {
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
            createdAt: receipt.createdAt
          }
        });
      } else {
        logger.warn("No WebSocket IO available, cannot emit receipt event");
      }
      // Получаем все активные payout со статусом 5
      const activePayouts = await prisma.transaction.findMany({
        where: {
          payout: {
            status: 5, // Ожидающие подтверждения
          },
          status: {
            in: ["pending", "chat_started", "waiting_payment"],
          },
        },
        include: {
          payout: true,
        },
      });

      logger.info("Checking receipt against active payouts", { count: activePayouts.length });

      // Проверяем чек против каждого payout
      for (const transaction of activePayouts) {
        if (!transaction.payout) continue;

        try {
          const matches =
            await this.receiptMatcher.matchPayoutWithReceiptBuffer(
              transaction.id,
              pdfBuffer,
            );

          if (matches) {
            logger.info("✅ Receipt matches transaction", { transactionId: transaction.id });

            // Обрабатываем совпадение
            await this.handleMatchedReceipt(
              transaction.id,
              transaction.payoutId,
              filePath,
              emailId,
              receipt.id,
            );

            // Обновляем чек как обработанный
            await prisma.receipt.update({
              where: { id: receipt.id },
              data: {
                isProcessed: true,
                payoutId: transaction.payoutId
              }
            });

            // Один чек может соответствовать только одной транзакции
            break;
          }
        } catch (error) {
          logger.error("Error matching receipt with transaction", error, { transactionId: transaction.id });
        }
      }
    } catch (error) {
      logger.error("Error processing receipt", error);
    }
  }

  /**
   * Обрабатывает совпавший чек
   */
  private async handleMatchedReceipt(
    transactionId: string,
    payoutId: string,
    receiptPath: string,
    emailId: string,
    receiptId: string,
  ): Promise<void> {
    try {
      logger.info("Processing matched receipt", { transactionId });

      // 1. Апрувим payout на Gate.io с приложением чека
      const payout = await prisma.payout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      // Читаем файл чека для отправки
      const receiptData = await fs.readFile(receiptPath);

      // Апрувим на Gate.io (если есть Gate клиент)
      if (this.gateClient) {
        logger.info("Approving payout on Gate.io", { gatePayoutId: payout.gatePayoutId });
        await this.gateClient.approvePayout(
          payout.gatePayoutId.toString(),
          receiptData,
        );

        // 2. Обновляем статус payout
        await prisma.payout.update({
          where: { id: payoutId },
          data: {
            status: 10, // Approved
            approvedAt: new Date(),
            attachments: JSON.stringify([
              {
                type: "receipt",
                path: receiptPath,
                emailId: emailId,
              },
            ]),
          },
        });
      } else {
        logger.warn("No Gate client available, marking receipt but not approving", { payoutId });
        // Только связываем чек с payout, но не апрувим
        await prisma.payout.update({
          where: { id: payoutId },
          data: {
            attachments: JSON.stringify([
              {
                type: "receipt",
                path: receiptPath,
                emailId: emailId,
              },
            ]),
          },
        });
      }

      // 3. Обновляем транзакцию
      const transaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "payment_received",
          checkReceivedAt: new Date(),
        },
        include: {
          payout: true,
        },
      });

      // 4. Если есть orderId, отправляем сообщение и отпускаем средства на Bybit
      if (transaction.orderId) {
        logger.info("Processing Bybit order", { orderId: transaction.orderId });

        try {
          // Находим Bybit аккаунт по объявлению
          const advertisement = await prisma.advertisement.findUnique({
            where: { id: transaction.advertisementId },
            include: { bybitAccount: true }
          });

          if (advertisement) {
            const bybitClient = this.bybitManager.getClient(
              advertisement.bybitAccount.accountId,
            );
            if (bybitClient) {
              // Отправляем сообщение в чат
              try {
                await this.bybitManager.manager.sendChatMessage({
                  orderId: transaction.orderId,
                  message: "Чек получен. Ожидайте, в течении 2 минут отпущу крипту."
                }, advertisement.bybitAccount.accountId);
                logger.info("Sent receipt confirmation message", { orderId: transaction.orderId });
              } catch (error) {
                logger.error("Failed to send chat message", error, { orderId: transaction.orderId });
              }
              
              // Отпускаем средства
              await bybitClient.releaseAssets(transaction.orderId);

              // Обновляем статус транзакции
              await prisma.transaction.update({
                where: { id: transactionId },
                data: {
                  status: "completed",
                  completedAt: new Date(),
                },
              });

              logger.info("✅ Transaction completed successfully", { transactionId });
              
              // Emit WebSocket event for receipt matched
              if (this.io) {
                this.io.emit('receipts:matched', {
                  receiptId,
                  payoutId,
                  transactionId,
                  approved: true
                });
              }

              // Удаляем объявление после успешного завершения
              try {
                if (advertisement.bybitAdId && !advertisement.bybitAdId.startsWith('temp_')) {
                  logger.info("Deleting advertisement", { bybitAdId: advertisement.bybitAdId });
                  await bybitClient.deleteAdvertisement(advertisement.bybitAdId);
                  logger.info("✅ Advertisement deleted from Bybit");
                }

                // Помечаем объявление как неактивное в БД
                await prisma.advertisement.update({
                  where: { id: advertisement.id },
                  data: { isActive: false }
                });
                logger.info("✅ Advertisement marked as inactive in database");
              } catch (deleteError) {
                logger.error("Error deleting advertisement", deleteError);
                // Не критично, продолжаем
              }
            }
          }
        } catch (error) {
          logger.error("Error releasing assets for order", error, { orderId: transaction.orderId });
          // Не прерываем процесс, транзакция уже подтверждена
        }
      }

      // 5. Генерируем событие
      this.emit("receiptProcessed", {
        transactionId,
        payoutId,
        receiptPath,
        status: "success",
      });
    } catch (error) {
      logger.error("Error handling matched receipt", error);

      // Обновляем статус транзакции на failed
      await prisma.transaction
        .update({
          where: { id: transactionId },
          data: {
            status: "failed",
            failureReason: `Receipt processing error: ${error instanceof Error ? error.message : String(error)}`,
          },
        })
        .catch(() => {});

      this.emit("receiptProcessed", {
        transactionId,
        payoutId,
        receiptPath,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Сохраняет PDF файл
   */
  private async savePDF(data: Buffer, originalName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}_${originalName}`;
    const absolutePath = path.join(this.config.pdfStoragePath, fileName);

    await fs.writeFile(absolutePath, data);

    // Return relative path for database storage
    return path.join('data', 'receipts', fileName);
  }


  /**
   * Создает директорию для хранения PDF
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.pdfStoragePath, { recursive: true });
    } catch (error) {
      logger.error("Error creating storage directory", error);
    }
  }

  /**
   * Загружает обработанные email из БД
   */
  private async loadProcessedEmails(): Promise<void> {
    try {
      const processed = await prisma.processedEmail.findMany({
        where: {
          processedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // За последние 7 дней
          },
        },
      });

      processed.forEach((email) => {
        this.processedEmails.add(email.emailId);
      });

      logger.info("Loaded processed emails", { count: processed.length });
    } catch (error) {
      logger.error("Error loading processed emails", error);
    }
  }
  
  /**
   * Complete transaction after receipt match
   */
  private async completeTransaction(transactionId: string, receiptId: string): Promise<void> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          payout: true,
          advertisement: {
            include: { bybitAccount: true }
          }
        }
      });
      
      if (!transaction) {
        logger.error('Transaction not found', { transactionId });
        return;
      }
      
      // 1. Approve payout on Gate.io
      if (transaction.payout && this.gateClient) {
        try {
          logger.info('Approving payout on Gate.io', { 
            payoutId: transaction.payoutId,
            gatePayoutId: transaction.payout.gatePayoutId 
          });
          
          const receipt = await prisma.receipt.findUnique({
            where: { id: receiptId }
          });
          
          if (receipt && receipt.filePath) {
            // Convert relative path to absolute for reading
            const absolutePath = path.isAbsolute(receipt.filePath) 
              ? receipt.filePath 
              : path.join(process.cwd(), receipt.filePath);
            const receiptData = await fs.readFile(absolutePath);
            await this.gateClient.approvePayout(
              transaction.payout.gatePayoutId.toString(),
              receiptData
            );
            
            await prisma.payout.update({
              where: { id: transaction.payoutId },
              data: {
                status: 10, // Approved
                approvedAt: new Date()
              }
            });
          }
        } catch (error) {
          logger.error('Failed to approve payout on Gate', error);
        }
      }
      
      // 2. Update transaction status
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'payment_received',
          checkReceivedAt: new Date()
        }
      });
      
      // 3. Send message and release on Bybit
      if (transaction.orderId && transaction.advertisement) {
        const bybitClient = this.bybitManager.getClient(
          transaction.advertisement.bybitAccount.accountId
        );
        
        if (bybitClient) {
          try {
            // Send confirmation message
            await this.bybitManager.manager.sendChatMessage({
              orderId: transaction.orderId,
              message: "Чек получен. Ожидайте, в течении 2 минут отпущу крипту."
            }, transaction.advertisement.bybitAccount.accountId);
            
            // Release assets
            await bybitClient.releaseAssets(transaction.orderId);
            
            // Send advertisement message after release
            if (this.chatAutomationService) {
              try {
                await this.chatAutomationService.sendFinalMessage(transactionId);
                logger.info('Advertisement message sent', { transactionId });
              } catch (error) {
                logger.error('Failed to send advertisement message', error, { transactionId });
              }
            }
            
            // Update to completed
            await prisma.transaction.update({
              where: { id: transactionId },
              data: {
                status: 'completed',
                completedAt: new Date()
              }
            });
            
            logger.info('Transaction completed successfully', { transactionId });
          } catch (error) {
            logger.error('Failed to complete Bybit order', error);
          }
        }
      }
      
      // Emit completion event
      this.emit('transactionCompleted', { transactionId, receiptId });
      
    } catch (error) {
      logger.error('Failed to complete transaction', error, { transactionId });
    }
  }
}

// Экспортируем для удобства
export async function startReceiptProcessor(
  gmailManager: GmailManager,
  gateClient: GateClient,
  bybitManager: BybitP2PManagerService,
  config?: ReceiptProcessorConfig,
  io?: any,
  chatAutomationService?: ChatAutomationService,
): Promise<ReceiptProcessorService> {
  const processor = new ReceiptProcessorService(
    gmailManager,
    gateClient,
    bybitManager,
    config,
    io,
    chatAutomationService,
  );

  await processor.start();
  return processor;
}
