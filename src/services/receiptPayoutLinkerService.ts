/**
 * Сервис для привязки чеков к payout по данным из чека
 * Сопоставляет чеки с payout по сумме, дате и другим параметрам
 */

import { PrismaClient } from "../../generated/prisma";
import { createLogger } from "../logger";
import dayjs from "dayjs";

const logger = createLogger('ReceiptPayoutLinker');
const prisma = new PrismaClient();

interface LinkingStats {
  total: number;
  linked: number;
  failed: number;
  skipped: number;
}

export class ReceiptPayoutLinkerService {
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  /**
   * Запускает периодическую привязку чеков к payout
   */
  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      logger.warn("Receipt payout linker already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting receipt payout linker service", { 
      interval: `${intervalMs / 1000}s` 
    });
    console.log(`[ReceiptPayoutLinker] ✅ Started - checking every ${intervalMs / 1000} seconds`);

    // Первый запуск сразу
    await this.linkUnlinkedReceipts();

    // Периодическая проверка
    this.intervalId = setInterval(async () => {
      try {
        await this.linkUnlinkedReceipts();
      } catch (error) {
        logger.error("Error in periodic linking", error);
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
    logger.info("Receipt payout linker stopped");
  }

  /**
   * Привязывает все непривязанные чеки к payout
   */
  async linkUnlinkedReceipts(): Promise<LinkingStats> {
    const stats: LinkingStats = {
      total: 0,
      linked: 0,
      failed: 0,
      skipped: 0
    };

    try {
      // Находим чеки которые распарсены, но не привязаны к payout
      const receipts = await prisma.receipt.findMany({
        where: {
          isParsed: true,
          payoutId: null,
          amount: { not: null },
          parseError: null
        },
        orderBy: { createdAt: 'desc' }
      });

      stats.total = receipts.length;

      if (receipts.length === 0) {
        // Log periodically to show service is running
        const now = new Date();
        if (now.getSeconds() % 30 === 0) { // Log every 30 seconds
          console.log(`[ReceiptPayoutLinker] No unlinked receipts found. Service is running...`);
        }
        return stats;
      }

      logger.info(`Found ${receipts.length} receipts to link`);
      console.log(`[ReceiptPayoutLinker] Found ${receipts.length} receipts to link`);

      for (const receipt of receipts) {
        try {
          console.log(`[ReceiptPayoutLinker] Processing receipt ${receipt.id}...`);
          const linked = await this.linkReceiptToPayout(receipt);
          console.log(`[ReceiptPayoutLinker] Receipt ${receipt.id} linked: ${linked}`);
          if (linked) {
            stats.linked++;
          } else {
            stats.skipped++;
          }
        } catch (error) {
          console.error(`[ReceiptPayoutLinker] Error linking receipt ${receipt.id}:`, error);
          logger.error("Failed to link receipt", error, { receiptId: receipt.id });
          stats.failed++;
        }
      }

      if (stats.linked > 0) {
        logger.info("Receipt linking completed", stats);
      }

    } catch (error) {
      logger.error("Error in linkUnlinkedReceipts", error);
    }

    return stats;
  }

  /**
   * Привязывает конкретный чек к payout
   */
  private async linkReceiptToPayout(receipt: any): Promise<boolean> {
    // Проверяем обязательные поля - требуется сумма и либо телефон, либо карта
    if (!receipt.amount || (!receipt.recipientPhone && !receipt.recipientCard)) {
      logger.debug("Receipt missing required fields", {
        receiptId: receipt.id,
        amount: receipt.amount,
        recipientPhone: receipt.recipientPhone,
        recipientCard: receipt.recipientCard
      });
      return false;
    }

    console.log(`[ReceiptPayoutLinker] Linking receipt ${receipt.id}: amount=${receipt.amount}, phone=${receipt.recipientPhone}, card=${receipt.recipientCard}`);

    let payout = null;

    // 1. Если есть карта, ищем по карте
    if (receipt.recipientCard) {
      console.log(`[ReceiptPayoutLinker] Searching payout by card...`);
      payout = await this.findPayoutByCard(receipt);
      console.log(`[ReceiptPayoutLinker] Payout by card:`, payout ? payout.gatePayoutId : 'not found');
    }

    // 2. Если не нашли по карте и есть телефон, ищем по телефону
    if (!payout && receipt.recipientPhone) {
      console.log(`[ReceiptPayoutLinker] Searching payout by phone...`);
      const normalizedPhone = this.normalizePhone(receipt.recipientPhone);
      payout = await this.findPayoutByPhone(receipt, normalizedPhone);
      console.log(`[ReceiptPayoutLinker] Payout by phone:`, payout ? payout.gatePayoutId : 'not found');
    }

    // 3. Если не нашли по карте/телефону, пробуем по имени получателя
    if (!payout && receipt.recipientName && receipt.recipientName !== 'Card Transfer') {
      console.log(`[ReceiptPayoutLinker] Searching payout by recipient name...`);
      payout = await this.findPayoutByName(receipt);
      console.log(`[ReceiptPayoutLinker] Payout by name:`, payout ? payout.gatePayoutId : 'not found');
    }

    // 4. Если все еще не нашли, пробуем найти только по сумме и времени (без телефона/карты)
    if (!payout) {
      console.log(`[ReceiptPayoutLinker] Searching payout by amount and time only...`);
      payout = await this.findPayoutByAmountAndTime(receipt);
      console.log(`[ReceiptPayoutLinker] Payout by amount/time:`, payout ? payout.gatePayoutId : 'not found');
    }

    if (!payout) {
      logger.debug("No matching payout found", {
        receiptId: receipt.id,
        amount: receipt.amount,
        recipientPhone: receipt.recipientPhone,
        recipientName: receipt.recipientName
      });
      console.log(`[ReceiptPayoutLinker] No matching payout found for receipt ${receipt.id}`);
      return false;
    }

    // Привязываем чек к payout (используем ID записи в БД, а не gatePayoutId)
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        payoutId: payout.id, // ID записи payout в нашей БД
        isProcessed: true,
        updatedAt: new Date()
      }
    });

    // Находим транзакцию связанную с этим payout
    const transaction = await prisma.transaction.findFirst({
      where: { payoutId: payout.id },
      include: {
        advertisement: {
          include: {
            bybitAccount: true
          }
        }
      }
    });

    if (transaction) {
      logger.info("Found transaction for payout", {
        transactionId: transaction.id,
        orderId: transaction.orderId,
        payoutId: payout.id
      });

      // Апрувим payout через AssetReleaseService
      try {
        const { getAssetReleaseService } = await import('./assetReleaseService');
        // Get the shared instance (it will already have bybitManager)
        const assetReleaseService = getAssetReleaseService();
        logger.info("Approving transaction through AssetReleaseService", {
          transactionId: transaction.id,
          payoutId: payout.id,
          gatePayoutId: payout.gatePayoutId,
          receiptPath: receipt.filePath
        });

        // Апрувим через AssetReleaseService
        const approved = await assetReleaseService.approveTransactionWithReceipt(
          transaction.id,
          payout.id,
          receipt.filePath || ''
        );

        if (approved) {
          logger.info("✅ Transaction approved through AssetReleaseService", {
            transactionId: transaction.id,
            gatePayoutId: payout.gatePayoutId
          });
        } else {
          logger.warn("Failed to approve transaction through AssetReleaseService", {
            transactionId: transaction.id
          });
        }
      } catch (error) {
        logger.error("Error approving payout in Gate.io", error, {
          payoutId: payout.gatePayoutId
        });
        console.error(`[ReceiptPayoutLinker] Gate approval error:`, error);
      }

      // Отправляем сообщение в чат о получении чека
      try {
        const { ChatAutomationService } = await import("./chatAutomation");
        const { BybitP2PManagerService } = await import("./bybitP2PManager");
        
        const bybitManager = new BybitP2PManagerService();
        const chatService = new ChatAutomationService(bybitManager);
        
        if (transaction.orderId && transaction.advertisement?.bybitAccount) {
          const client = bybitManager.getClient(transaction.advertisement.bybitAccount.accountId);
          if (client) {
            const receiptMessage = `✅ Чек получен и подтвержден!\n\nСумма: ${receipt.amount} RUB\nОперация: ${receipt.operationId || 'N/A'}\n\n⏱️ В течении двух минут проверю чек и отпущу средства.\n\nПереходи в закрытый чат https://t.me/+nIB6kP22KmhlMmQy\n\nВсегда есть большой объем ЮСДТ по хорошему курсу, работаем оперативно.`;
            
            await chatService.sendMessageDirect(client, transaction.orderId, receiptMessage);
            
            logger.info("Sent receipt confirmation message", {
              transactionId: transaction.id,
              orderId: transaction.orderId
            });
          }
        }
      } catch (error) {
        logger.error("Error sending chat message", error, {
          transactionId: transaction.id
        });
      }

      // Статус транзакции уже обновлен в AssetReleaseService до release_money
      // Проверяем текущий статус
      const updatedTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id }
      });

      logger.info("Transaction status after approval", {
        transactionId: transaction.id,
        status: updatedTransaction?.status
      });

      // Удаляем связанное объявление с Bybit после привязки к транзакции
      if (transaction.advertisement?.bybitAdId && transaction.advertisement?.bybitAccount) {
        try {
          console.log(`[ReceiptPayoutLinker] Deleting Bybit advertisement: ${transaction.advertisement.bybitAdId}`);
          
          // Get the shared BybitManager from global context
          const globalContext = (global as any).appContext;
          const bybitManager = globalContext?.bybitManager;
          
          if (!bybitManager) {
            logger.warn('No shared BybitManager available');
            console.log('[ReceiptPayoutLinker] ❌ No shared BybitManager available');
            return;
          }
          
          const bybitClient = bybitManager.getClient(transaction.advertisement.bybitAccount.accountId);
          
          if (bybitClient) {
            await bybitClient.cancelAdvertisement(transaction.advertisement.bybitAdId);
            
            console.log(`[ReceiptPayoutLinker] ✅ Advertisement deleted successfully: ${transaction.advertisement.bybitAdId}`);
            logger.info("Advertisement deleted after transaction linking", {
              transactionId: transaction.id,
              advertisementId: transaction.advertisement.id,
              bybitAdId: transaction.advertisement.bybitAdId
            });

            // Обновляем статус объявления в БД
            await prisma.advertisement.update({
              where: { id: transaction.advertisement.id },
              data: {
                isActive: false,
                updatedAt: new Date()
              }
            });
          } else {
            console.log(`[ReceiptPayoutLinker] ❌ Bybit client not found for account: ${transaction.advertisement.bybitAccount.accountId}`);
          }
        } catch (error) {
          logger.error("Error deleting Bybit advertisement", error, {
            transactionId: transaction.id,
            advertisementId: transaction.advertisement?.id,
            bybitAdId: transaction.advertisement?.bybitAdId
          });
          console.error(`[ReceiptPayoutLinker] Error deleting advertisement: ${error}`);
        }
      } else {
        console.log(`[ReceiptPayoutLinker] No advertisement to delete - bybitAdId: ${transaction.advertisement?.bybitAdId}, account: ${!!transaction.advertisement?.bybitAccount}`);
      }
    }

    // Статус payout обновляется в AssetReleaseService

    logger.info("Receipt linked to payout", {
      receiptId: receipt.id,
      payoutId: payout.id, // ID записи в БД
      gatePayoutId: payout.gatePayoutId,
      amount: receipt.amount,
      recipientPhone: receipt.recipientPhone
    });

    // Emit event for real-time updates
    const io = (global as any).io;
    if (io) {
      io.emit('receipt:linked', {
        receiptId: receipt.id,
        payoutId: payout.id, // ID записи в БД
        gatePayoutId: payout.gatePayoutId,
        amount: receipt.amount,
        transactionId: transaction?.id
      });
    }

    return true;
  }

  /**
   * Ищет payout по номеру карты
   */
  private async findPayoutByCard(receipt: any): Promise<any> {
    if (!receipt.recipientCard) return null;

    const cardNumber = receipt.recipientCard;
    
    // Извлекаем начальные 6 цифр и последние 4 цифры из замаскированной карты
    // Формат: 220040******6401
    const cardPattern = cardNumber.replace(/\*/g, '');
    const firstSix = cardPattern.substring(0, 6);
    const lastFour = cardPattern.substring(cardPattern.length - 4);

    console.log(`[ReceiptPayoutLinker] Card pattern: first6=${firstSix}, last4=${lastFour}`);

    try {
      // Ищем payout где wallet начинается с первых 6 цифр и заканчивается последними 4
      const payout = await prisma.payout.findFirst({
        where: {
          OR: [
            { amount: receipt.amount },
            { 
              amountTrader: {
                path: ['643'],
                equals: receipt.amount
              }
            }
          ],
          AND: [
            { wallet: { startsWith: firstSix } },
            { wallet: { endsWith: lastFour } }
          ],
          createdAt: receipt.transactionDate ? {
            gte: dayjs(receipt.transactionDate).subtract(1, 'day').toDate(),
            lte: dayjs(receipt.transactionDate).add(1, 'day').toDate()
          } : undefined
        },
        orderBy: { createdAt: 'desc' }
      });

      return payout;
    } catch (error) {
      console.error(`[ReceiptPayoutLinker] Error searching by card:`, error);
      return null;
    }
  }

  /**
   * Ищет payout по телефону
   */
  private async findPayoutByPhone(receipt: any, normalizedPhone: string): Promise<any> {
    try {
      const payout = await Promise.race([
        prisma.payout.findFirst({
          where: {
            OR: [
              // Ищем по amount если оно заполнено
              { amount: receipt.amount },
              // Или по amountTrader['643'] для RUB
              { 
                amountTrader: {
                  path: ['643'],
                  equals: receipt.amount
                }
              }
            ],
            wallet: { contains: normalizedPhone },
            // Payout должен быть создан примерно в то же время (±1 день)
            createdAt: receipt.transactionDate ? {
              gte: dayjs(receipt.transactionDate).subtract(1, 'day').toDate(),
              lte: dayjs(receipt.transactionDate).add(1, 'day').toDate()
            } : undefined
          },
          orderBy: { createdAt: 'desc' }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000))
      ]);
      
      return payout;
    } catch (error) {
      console.error(`[ReceiptPayoutLinker] Error searching by phone:`, error);
      return null;
    }
  }

  /**
   * Ищет payout по имени получателя
   */
  private async findPayoutByName(receipt: any): Promise<any> {
    try {
      const payout = await prisma.payout.findFirst({
        where: {
          AND: [
            {
              OR: [
                { amount: receipt.amount },
                { 
                  amountTrader: {
                    path: ['643'],
                    equals: receipt.amount
                  }
                }
              ]
            },
            {
              OR: [
                { recipientName: { contains: receipt.recipientName } },
                { wallet: { contains: receipt.recipientName } },
                { 
                  meta: {
                    path: ['name'],
                    string_contains: receipt.recipientName
                  }
                }
              ]
            }
          ],
          createdAt: receipt.transactionDate ? {
            gte: dayjs(receipt.transactionDate).subtract(1, 'day').toDate(),
            lte: dayjs(receipt.transactionDate).add(1, 'day').toDate()
          } : undefined
        },
        orderBy: { createdAt: 'desc' }
      });

      return payout;
    } catch (error) {
      console.error(`[ReceiptPayoutLinker] Error searching by name:`, error);
      return null;
    }
  }

  /**
   * Ищет payout только по сумме и времени
   */
  private async findPayoutByAmountAndTime(receipt: any): Promise<any> {
    try {
      const payout = await prisma.payout.findFirst({
        where: {
          OR: [
            { amount: receipt.amount },
            { 
              amountTrader: {
                path: ['643'],
                equals: receipt.amount
              }
            }
          ],
          createdAt: receipt.transactionDate ? {
            gte: dayjs(receipt.transactionDate).subtract(30, 'minutes').toDate(),
            lte: dayjs(receipt.transactionDate).add(30, 'minutes').toDate()
          } : undefined
        },
        orderBy: { createdAt: 'desc' }
      });

      // Проверяем, что payout не привязан к другому чеку
      if (payout) {
        const existingReceipt = await prisma.receipt.findFirst({
          where: {
            payoutId: payout.id, // ID записи в БД
            id: { not: receipt.id }
          }
        });

        if (existingReceipt) {
          logger.debug("Payout already linked to another receipt", {
            payoutId: payout.gatePayoutId,
            existingReceiptId: existingReceipt.id
          });
          return null;
        }
      }

      return payout;
    } catch (error) {
      console.error(`[ReceiptPayoutLinker] Error searching by amount/time:`, error);
      return null;
    }
  }

  /**
   * Нормализует телефон для поиска
   */
  private normalizePhone(phone: string): string {
    // Убираем все кроме цифр
    const digits = phone.replace(/\D/g, '');
    
    // Если начинается с 7, убираем ее
    if (digits.startsWith('7') && digits.length === 11) {
      return digits.substring(1);
    }
    
    // Если начинается с 8, заменяем на 7 и убираем
    if (digits.startsWith('8') && digits.length === 11) {
      return digits.substring(1);
    }
    
    return digits;
  }

  /**
   * Получает статистику по привязкам
   */
  async getStats(): Promise<{
    totalReceipts: number;
    linkedReceipts: number;
    unlinkedReceipts: number;
    totalPayouts: number;
    receiptsWithPayouts: number;
  }> {
    const [
      totalReceipts,
      linkedReceipts,
      totalPayouts
    ] = await Promise.all([
      prisma.receipt.count({ where: { isParsed: true } }),
      prisma.receipt.count({ where: { payoutId: { not: null } } }),
      prisma.payout.count()
    ]);

    // Считаем уникальные payoutId в чеках
    const receiptsWithPayouts = await prisma.receipt.groupBy({
      by: ['payoutId'],
      where: { payoutId: { not: null } },
      _count: true
    });

    return {
      totalReceipts,
      linkedReceipts,
      unlinkedReceipts: totalReceipts - linkedReceipts,
      totalPayouts,
      receiptsWithPayouts: receiptsWithPayouts.length
    };
  }

  /**
   * Пытается найти и привязать payout для конкретного чека
   */
  async linkSpecificReceipt(receiptId: string): Promise<boolean> {
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    });

    if (!receipt) {
      logger.error("Receipt not found", { receiptId });
      return false;
    }

    if (receipt.payoutId) {
      logger.info("Receipt already linked", { 
        receiptId, 
        payoutId: receipt.payoutId 
      });
      return true;
    }

    return await this.linkReceiptToPayout(receipt);
  }
}

// Синглтон для удобства
let linkerService: ReceiptPayoutLinkerService | null = null;

export function getReceiptPayoutLinker(): ReceiptPayoutLinkerService {
  if (!linkerService) {
    linkerService = new ReceiptPayoutLinkerService();
  }
  return linkerService;
}

// Функция для запуска сервиса
export async function startReceiptPayoutLinker(intervalMs: number = 5000): Promise<ReceiptPayoutLinkerService> {
  const service = getReceiptPayoutLinker();
  await service.start(intervalMs);
  return service;
}