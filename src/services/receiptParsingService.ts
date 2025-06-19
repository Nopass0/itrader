/**
 * Сервис для парсинга загруженных чеков
 * Обрабатывает все чеки в БД и извлекает из них данные
 */

import { PrismaClient } from "../../generated/prisma";
import { TinkoffReceiptParserV2 } from "../ocr/receiptParserV2";
import { createLogger } from "../logger";
import * as fs from "fs/promises";
import * as path from "path";

const logger = createLogger('ReceiptParsingService');
const prisma = new PrismaClient();

interface ParsingStats {
  total: number;
  parsed: number;
  failed: number;
  skipped: number;
}

export class ReceiptParsingService {
  private parser: TinkoffReceiptParserV2;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.parser = new TinkoffReceiptParserV2();
  }

  /**
   * Запускает периодическую обработку чеков
   */
  async start(intervalMs: number = 30000): Promise<void> {
    if (this.isRunning) {
      logger.warn("Receipt parsing service already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting receipt parsing service", { 
      interval: `${intervalMs / 1000}s` 
    });

    // Первый запуск сразу
    await this.parseUnparsedReceipts();

    // Периодическая проверка
    this.intervalId = setInterval(async () => {
      try {
        await this.parseUnparsedReceipts();
      } catch (error) {
        logger.error("Error in periodic parsing", error);
      }
    }, intervalMs);
  }

  /**
   * Останавливает сервис
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    logger.info("Receipt parsing service stopped");
  }

  /**
   * Парсит все нераспарсенные чеки
   */
  async parseUnparsedReceipts(): Promise<ParsingStats> {
    console.log("[ReceiptParser] 🔍 Checking for unparsed receipts...");
    
    const stats: ParsingStats = {
      total: 0,
      parsed: 0,
      failed: 0,
      skipped: 0
    };

    try {
      // Сначала проверим все чеки в БД
      const allReceipts = await prisma.receipt.count();
      console.log(`[ReceiptParser] Total receipts in DB: ${allReceipts}`);
      
      // Находим чеки которые нужно распарсить
      console.log(`[ReceiptParser] Querying for unparsed receipts...`);
      
      let receipts;
      try {
        // Упрощенный запрос - просто все непарсенные чеки
        receipts = await prisma.receipt.findMany({
          where: {
            isParsed: false
          },
          orderBy: { createdAt: 'desc' },
          take: 50 // Обрабатываем по 50 за раз
        });
      } catch (queryError) {
        console.error(`[ReceiptParser] Query error:`, queryError);
        return stats;
      }

      stats.total = receipts.length;
      console.log(`[ReceiptParser] Found ${receipts.length} receipts to parse`);

      if (receipts.length === 0) {
        logger.info("No unparsed receipts found");
        console.log("[ReceiptParser] No unparsed receipts found");
        return stats;
      }

      logger.info(`Found ${receipts.length} receipts to parse`);

      for (const receipt of receipts) {
        try {
          // Проверяем существование файла
          if (!receipt.filePath) {
            logger.warn("Receipt has no file path", { receiptId: receipt.id });
            stats.skipped++;
            continue;
          }

          // Преобразуем относительный путь в абсолютный
          const absolutePath = path.isAbsolute(receipt.filePath) 
            ? receipt.filePath 
            : path.join(process.cwd(), receipt.filePath);
          
          try {
            await fs.access(absolutePath);
          } catch {
            logger.warn("Receipt file not found", { 
              receiptId: receipt.id, 
              filePath: receipt.filePath,
              absolutePath
            });
            stats.skipped++;
            continue;
          }

          // Парсим чек
          logger.info("Parsing receipt", { 
            receiptId: receipt.id, 
            filePath: receipt.filePath,
            absolutePath
          });
          console.log(`[ReceiptParser] 📄 Parsing receipt ${receipt.id} from ${absolutePath}`);

          const parsedData = await this.parser.parseReceiptPDF(absolutePath);

          // Обновляем данные в БД
          const updateData: any = {
            parsedData: parsedData as any,
            rawText: parsedData.rawText || null,
            isParsed: true, // Отмечаем что чек был обработан парсером
            updatedAt: new Date()
          };

          // Обновляем основные поля если они были извлечены
          if (parsedData.amount !== undefined) {
            updateData.amount = parsedData.amount;
          }
          if (parsedData.senderName) {
            updateData.senderName = parsedData.senderName;
          }
          if (parsedData.recipientName) {
            updateData.recipientName = parsedData.recipientName;
          }
          if (parsedData.recipientPhone) {
            updateData.recipientPhone = parsedData.recipientPhone;
          }
          if (parsedData.recipientCard) {
            updateData.recipientCard = parsedData.recipientCard;
          }
          if (parsedData.recipientBank) {
            updateData.recipientBank = parsedData.recipientBank;
          }
          if (parsedData.transferType) {
            updateData.transferType = parsedData.transferType;
          }
          if (parsedData.status) {
            updateData.status = parsedData.status;
          }
          if (parsedData.commission !== undefined) {
            updateData.commission = parsedData.commission;
          }
          if (parsedData.datetime) {
            updateData.transactionDate = parsedData.datetime;
          }
          if (parsedData.total !== undefined) {
            updateData.total = parsedData.total;
          }
          if (parsedData.operationId) {
            updateData.operationId = parsedData.operationId;
          }
          if (parsedData.sbpCode) {
            updateData.sbpCode = parsedData.sbpCode;
          }
          if (parsedData.receiptNumber) {
            updateData.receiptNumber = parsedData.receiptNumber;
          }
          if (parsedData.senderAccount) {
            updateData.senderAccount = parsedData.senderAccount;
          }

          // Создаем reference строку
          const recipient = 
            parsedData.recipientName ||
            parsedData.recipientPhone ||
            parsedData.recipientCard ||
            'Unknown';
          
          updateData.reference = `${parsedData.senderName || 'Unknown'} -> ${recipient}`;

          await prisma.receipt.update({
            where: { id: receipt.id },
            data: updateData
          });

          logger.info("Receipt parsed successfully", {
            receiptId: receipt.id,
            amount: parsedData.amount,
            sender: parsedData.senderName,
            transferType: parsedData.transferType,
            operationId: parsedData.operationId,
            total: parsedData.total
          });
          console.log(`[ReceiptParser] ✅ Receipt ${receipt.id} parsed: Amount=${parsedData.amount}, Total=${parsedData.total}, Sender=${parsedData.senderName}, OpID=${parsedData.operationId}`);

          stats.parsed++;

          // Пытаемся сопоставить с транзакцией если чек еще не обработан
          if (!receipt.isProcessed && !receipt.payoutId && parsedData.amount) {
            try {
              const { ReceiptMatcher } = await import("./receiptMatcher");
              const matcher = new ReceiptMatcher();
              
              const matchResult = await matcher.matchReceiptToTransaction({
                ...receipt,
                ...updateData
              });

              if (matchResult.success && matchResult.transactionId) {
                logger.info("Receipt matched to transaction", {
                  receiptId: receipt.id,
                  transactionId: matchResult.transactionId,
                  confidence: matchResult.confidence
                });

                // Обновляем чек с информацией о сопоставлении
                await prisma.receipt.update({
                  where: { id: receipt.id },
                  data: {
                    payoutId: matchResult.payoutId,
                    isProcessed: true
                  }
                });

                // Запускаем обработку транзакции
                const { getReceiptProcessor } = await import("../app");
                const processor = getReceiptProcessor();
                if (processor) {
                  await processor.completeTransaction(matchResult.transactionId, receipt.id);
                }
              }
            } catch (error) {
              logger.error("Error matching receipt to transaction", error, {
                receiptId: receipt.id
              });
            }
          }

        } catch (error) {
          logger.error("Failed to parse receipt", error, { 
            receiptId: receipt.id 
          });
          
          // Отмечаем что попытались распарсить но не удалось
          await prisma.receipt.update({
            where: { id: receipt.id },
            data: {
              isParsed: true,
              parseError: error instanceof Error ? error.message : String(error)
            }
          }).catch(() => {});
          
          stats.failed++;
        }
      }

      logger.info("Receipt parsing completed", stats);
      console.log(`[ReceiptParser] 📊 Parsing completed: Total=${stats.total}, Parsed=${stats.parsed}, Failed=${stats.failed}, Skipped=${stats.skipped}`);

    } catch (error) {
      logger.error("Error in parseUnparsedReceipts", error);
    }

    return stats;
  }

  /**
   * Парсит конкретный чек по ID
   */
  async parseReceipt(receiptId: string): Promise<boolean> {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { id: receiptId }
      });

      if (!receipt) {
        logger.error("Receipt not found", { receiptId });
        return false;
      }

      if (!receipt.filePath) {
        logger.error("Receipt has no file path", { receiptId });
        return false;
      }

      // Преобразуем путь в абсолютный если нужно
      const absolutePath = path.isAbsolute(receipt.filePath) 
        ? receipt.filePath 
        : path.join(process.cwd(), receipt.filePath);

      // Парсим чек
      const parsedData = await this.parser.parseReceiptPDF(absolutePath);

      // Обновляем данные
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          amount: parsedData.amount,
          senderName: parsedData.senderName,
          recipientName: parsedData.recipientName || null,
          recipientPhone: parsedData.recipientPhone || null,
          recipientCard: parsedData.recipientCard || null,
          recipientBank: parsedData.recipientBank || null,
          transferType: parsedData.transferType,
          status: parsedData.status,
          commission: parsedData.commission || null,
          transactionDate: parsedData.datetime,
          total: parsedData.total || null,
          operationId: parsedData.operationId || null,
          sbpCode: parsedData.sbpCode || null,
          receiptNumber: parsedData.receiptNumber || null,
          senderAccount: parsedData.senderAccount || null,
          parsedData: parsedData as any,
          rawText: parsedData.rawText || null,
          isParsed: true,
          reference: `${parsedData.senderName || 'Unknown'} -> ${
            parsedData.recipientName ||
            parsedData.recipientPhone ||
            parsedData.recipientCard || 'Unknown'
          }`
        }
      });

      logger.info("Receipt parsed successfully", {
        receiptId,
        amount: parsedData.amount,
        sender: parsedData.senderName
      });

      return true;

    } catch (error) {
      logger.error("Failed to parse receipt", error, { receiptId });
      return false;
    }
  }

  /**
   * Получает статистику по чекам
   */
  async getStats(): Promise<{
    total: number;
    parsed: number;
    unparsed: number;
    processed: number;
    unprocessed: number;
    withAmount: number;
    withoutAmount: number;
  }> {
    const [
      total,
      parsed,
      processed,
      withAmount
    ] = await Promise.all([
      prisma.receipt.count(),
      prisma.receipt.count({ where: { isParsed: true } }),
      prisma.receipt.count({ where: { isProcessed: true } }),
      prisma.receipt.count({ where: { NOT: { amount: null } } })
    ]);

    return {
      total,
      parsed,
      unparsed: total - parsed,
      processed,
      unprocessed: total - processed,
      withAmount,
      withoutAmount: total - withAmount
    };
  }
}

// Синглтон для удобства
let parsingService: ReceiptParsingService | null = null;

export function getReceiptParsingService(): ReceiptParsingService {
  if (!parsingService) {
    parsingService = new ReceiptParsingService();
  }
  return parsingService;
}

// Функция для запуска сервиса
export async function startReceiptParsingService(intervalMs: number = 30000): Promise<ReceiptParsingService> {
  const service = getReceiptParsingService();
  await service.start(intervalMs);
  return service;
}