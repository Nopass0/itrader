/**
 * Сервис для синхронизации объявлений между базой данных и Bybit
 * Удаляет объявления на Bybit если они не должны быть активными
 */

import { PrismaClient } from "../../generated/prisma";
import { createLogger } from "../logger";
import { BybitP2PManagerService } from "./bybitP2PManager";

const logger = createLogger('AdvertisementSyncService');
const prisma = new PrismaClient();

export class AdvertisementSyncService {
  private bybitManager: BybitP2PManagerService;
  
  constructor(bybitManager: BybitP2PManagerService) {
    this.bybitManager = bybitManager;
  }

  /**
   * Синхронизировать все объявления
   */
  async syncAllAdvertisements(): Promise<void> {
    logger.info("Starting advertisement synchronization...");
    
    try {
      // Получаем все активные Bybit аккаунты
      const bybitAccounts = await prisma.bybitAccount.findMany({
        where: { isActive: true }
      });
      
      for (const account of bybitAccounts) {
        await this.syncAccountAdvertisements(account.accountId);
      }
      
      logger.info("Advertisement synchronization completed");
    } catch (error) {
      logger.error("Error during advertisement synchronization", error);
    }
  }

  /**
   * Синхронизировать объявления для конкретного аккаунта
   */
  private async syncAccountAdvertisements(accountId: string): Promise<void> {
    const client = this.bybitManager.getClient(accountId);
    if (!client) {
      logger.warn(`No client found for account ${accountId}`);
      return;
    }
    
    try {
      logger.info(`Syncing advertisements for account ${accountId}`);
      
      // Получаем список активных объявлений с Bybit
      let bybitAds;
      let bybitAdIds = new Set<string>();
      
      try {
        bybitAds = await client.getMyAdvertisements();
        bybitAdIds = new Set(bybitAds.list.map((ad: any) => ad.id));
        logger.info(`Found ${bybitAdIds.size} active ads on Bybit for account ${accountId}`);
      } catch (error) {
        logger.error(`Failed to get advertisements from Bybit for account ${accountId}`, error);
        return;
      }
      
      // Получаем объявления из БД для этого аккаунта
      const dbAds = await prisma.advertisement.findMany({
        where: {
          bybitAccount: { accountId },
          isActive: true
        },
        include: {
          transaction: {
            include: {
              payout: true
            }
          }
        }
      });
      
      // Проверяем каждое объявление из БД
      for (const dbAd of dbAds) {
        const shouldBeActive = await this.shouldAdvertisementBeActive(dbAd);
        
        if (!shouldBeActive && bybitAdIds.has(dbAd.bybitAdId)) {
          // Объявление не должно быть активным, но оно есть на Bybit - удаляем
          logger.info(`Deleting advertisement ${dbAd.id} (${dbAd.bybitAdId}) - no longer needed`);
          
          try {
            await client.cancelAdvertisement(dbAd.bybitAdId);
            
            // Обновляем статус в БД
            await prisma.advertisement.update({
              where: { id: dbAd.id },
              data: {
                isActive: false,
                updatedAt: new Date()
              }
            });
            
            logger.info(`✅ Deleted advertisement ${dbAd.bybitAdId} from Bybit`);
          } catch (error: any) {
            logger.error(`Failed to delete advertisement ${dbAd.bybitAdId}`, error);
            
            // Если объявление уже удалено на Bybit, обновляем БД
            if (error.response?.data?.retCode === 10404 || error.message?.includes('not found')) {
              await prisma.advertisement.update({
                where: { id: dbAd.id },
                data: {
                  isActive: false,
                  updatedAt: new Date()
                }
              });
              logger.info(`Updated DB - advertisement ${dbAd.bybitAdId} already deleted from Bybit`);
            }
          }
        }
      }
      
      // Проверяем объявления на Bybit, которых нет в БД
      for (const bybitAdId of bybitAdIds) {
        const existsInDb = dbAds.some(ad => ad.bybitAdId === bybitAdId);
        
        if (!existsInDb) {
          logger.warn(`Found orphaned advertisement ${bybitAdId} on Bybit - deleting`);
          
          try {
            await client.cancelAdvertisement(bybitAdId);
            logger.info(`✅ Deleted orphaned advertisement ${bybitAdId} from Bybit`);
          } catch (error: any) {
            logger.error(`Failed to delete orphaned advertisement ${bybitAdId}`, error);
            
            // Если ошибка говорит что объявление не найдено, это нормально
            if (error.response?.data?.retCode === 10404 || error.message?.includes('not found')) {
              logger.info(`Advertisement ${bybitAdId} already deleted from Bybit`);
            }
          }
        }
      }
      
      // Обновляем счетчик активных объявлений
      const activeCount = await prisma.advertisement.count({
        where: {
          bybitAccountId: dbAds[0]?.bybitAccountId,
          isActive: true
        }
      });
      
      if (dbAds[0]?.bybitAccountId) {
        await prisma.bybitAccount.update({
          where: { id: dbAds[0].bybitAccountId },
          data: { activeAdsCount: activeCount }
        });
      }
      
    } catch (error) {
      logger.error(`Error syncing advertisements for account ${accountId}`, error);
    }
  }

  /**
   * Проверить, должно ли объявление быть активным
   */
  private async shouldAdvertisementBeActive(advertisement: any): Promise<boolean> {
    // Если нет транзакции - объявление должно быть активно
    if (!advertisement.transaction) {
      return true;
    }
    
    const transaction = advertisement.transaction;
    
    // Если транзакция завершена или отменена - объявление не нужно
    if (transaction.status === 'completed' || transaction.status === 'cancelled' || transaction.status === 'failed') {
      return false;
    }
    
    // Если есть payout
    if (transaction.payout) {
      // Проверяем Gate аккаунт и статус payout
      const gateAccount = await prisma.gateAccount.findFirst({
        where: { accountId: transaction.payout.gateAccountId }
      });
      
      if (!gateAccount || !gateAccount.isActive) {
        // Gate аккаунт не активен - объявление не нужно
        return false;
      }
      
      // Если статус payout не 5 (pending) - объявление не нужно
      if (transaction.payout.status !== 5) {
        return false;
      }
    }
    
    // Во всех остальных случаях объявление должно быть активно
    return true;
  }
}

// Функция для запуска синхронизации
export async function syncAdvertisements(bybitManager: BybitP2PManagerService): Promise<void> {
  const syncService = new AdvertisementSyncService(bybitManager);
  await syncService.syncAllAdvertisements();
}