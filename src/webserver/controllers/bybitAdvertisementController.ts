/**
 * Контроллер для работы с объявлениями Bybit P2P напрямую через API
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';

const logger = createLogger('BybitAdvertisementController');

export class BybitAdvertisementController {
  /**
   * Получение списка объявлений с Bybit API
   */
  static async list(
    socket: AuthenticatedSocket,
    data: { 
      accountId?: string;
      side?: 'buy' | 'sell';
      status?: 'active' | 'inactive';
      limit?: number;
      offset?: number;
    },
    callback: Function
  ) {
    try {
      logger.info('Getting advertisements from Bybit', { 
        accountId: data.accountId,
        side: data.side,
        status: data.status
      });

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        logger.error('BybitP2PManager not initialized');
        handleSuccess({
          items: [],
          total: 0,
          error: 'BybitP2PManager not initialized'
        }, 'No Bybit manager available', callback);
        return;
      }

      // Если указан конкретный аккаунт
      if (data.accountId) {
        const client = bybitManager.getClient(data.accountId);
        if (!client) {
          throw new Error(`Bybit client not found for account ${data.accountId}`);
        }

        // Получаем объявления через API
        const advertisements = await client.getMyAdvertisements({
          side: data.side,
          limit: data.limit || 50,
          offset: data.offset || 0
        });

        // Добавляем accountId к каждому объявлению
        let adsWithAccount = advertisements.list.map(ad => ({
          ...ad,
          bybitAccountId: data.accountId
        }));

        // Фильтруем по статусу если указан
        if (data.status) {
          adsWithAccount = adsWithAccount.filter(ad => {
            // Проверяем разные варианты активности из Bybit API
            const isActive = ad.status === 'ONLINE' || 
                            ad.status === 1 || 
                            ad.status === '1' ||
                            ad.isActive === true ||
                            (ad.status !== 'OFFLINE' && ad.status !== 0 && ad.status !== '0' && ad.isActive !== false);
            return data.status === 'active' ? isActive : !isActive;
          });
        }

        handleSuccess({
          items: adsWithAccount,
          total: adsWithAccount.length,
          accountId: data.accountId
        }, undefined, callback);
      } else {
        // Получаем объявления со всех аккаунтов
        const allAdvertisements = [];
        const accountIds = bybitManager.getAccounts();
        
        logger.info('Found Bybit accounts', { accountCount: accountIds.length });

        if (accountIds.length === 0) {
          logger.warn('No Bybit accounts found');
          handleSuccess({
            items: [],
            total: 0,
            message: 'No Bybit accounts configured'
          }, 'No accounts found', callback);
          return;
        }

        for (const accountId of accountIds) {
          try {
            const client = bybitManager.getClient(accountId);
            if (client) {
              logger.debug(`Fetching advertisements for account ${accountId}`);
              const ads = await client.getMyAdvertisements({
                side: data.side,
                limit: data.limit || 50,
                offset: data.offset || 0
              });
              
              logger.debug(`Got ${ads.list?.length || 0} advertisements for account ${accountId}`);
              
              // Логируем статусы объявлений для отладки
              if (ads.list?.length > 0) {
                const statuses = ads.list.map(ad => ({ 
                  id: ad.itemId || ad.id, 
                  status: ad.status,
                  isActive: ad.isActive,
                  online: ad.online,
                  visible: ad.visible,
                  enabled: ad.enabled,
                  state: ad.state,
                  allFields: Object.keys(ad),
                  fullObject: ad
                }));
                logger.info(`Advertisement detailed data for account ${accountId}`, { statuses });
                
                // Отдельно логируем первое объявление полностью
                if (ads.list[0]) {
                  logger.info(`First advertisement full structure:`, ads.list[0]);
                }
              }
              
              // Добавляем accountId к каждому объявлению
              let adsWithAccount = ads.list.map(ad => ({
                ...ad,
                bybitAccountId: accountId
              }));

              // Фильтруем по статусу если указан
              if (data.status) {
                adsWithAccount = adsWithAccount.filter(ad => {
                  // Проверяем разные варианты активности из Bybit API
                  const isActive = ad.status === 'ONLINE' || 
                                  ad.status === 1 || 
                                  ad.status === '1' ||
                                  ad.isActive === true ||
                                  (ad.status !== 'OFFLINE' && ad.status !== 0 && ad.status !== '0' && ad.isActive !== false);
                  return data.status === 'active' ? isActive : !isActive;
                });
              }
              
              allAdvertisements.push(...adsWithAccount);
            }
          } catch (error) {
            logger.error(`Error fetching ads for account ${accountId}`, error as Error);
          }
        }

        handleSuccess({
          items: allAdvertisements,
          total: allAdvertisements.length
        }, undefined, callback);
      }

    } catch (error) {
      logger.error('Error getting advertisements', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Создание объявления на Bybit
   */
  static async create(
    socket: AuthenticatedSocket,
    data: {
      bybitAccountId: string;
      side: 'buy' | 'sell';
      tokenId: string;
      currencyId: string;
      priceType: string;
      price?: number;
      premium?: string;
      quantity: number;
      minAmount: number;
      maxAmount: number;
      payments: string[];
      remarks?: string;
      paymentPeriod?: number;
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут создавать объявления
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot create advertisements');
      }

      logger.info('Creating advertisement on Bybit', { 
        accountId: data.bybitAccountId,
        side: data.side,
        quantity: data.quantity 
      });

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(data.bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${data.bybitAccountId}`);
      }

      // Создаем объявление через Bybit API
      const advertisement = await client.createAdvertisement({
        side: data.side === 'buy' ? 0 : 1, // 0 = buy, 1 = sell
        tokenId: data.tokenId,
        currencyId: data.currencyId,
        priceType: data.priceType,
        price: data.price?.toString(),
        premium: data.premium,
        quantity: data.quantity.toString(),
        minOrderAmount: data.minAmount.toString(),
        maxOrderAmount: data.maxAmount.toString(),
        payments: data.payments,
        remark: data.remarks,
        paymentPeriod: data.paymentPeriod || 15
      });

      logger.info('Advertisement created successfully on Bybit', { 
        itemId: advertisement.itemId,
        accountId: data.bybitAccountId 
      });

      // Emit событие о новом объявлении
      socket.broadcast.emit('bybitAdvertisement:created', {
        advertisement,
        accountId: data.bybitAccountId
      });

      handleSuccess(advertisement, 'Advertisement created successfully', callback);

    } catch (error) {
      logger.error('Error creating advertisement', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Обновление объявления на Bybit
   */
  static async update(
    socket: AuthenticatedSocket,
    data: { 
      itemId: string;
      bybitAccountId: string;
      updates: {
        price?: number;
        premium?: string;
        quantity?: number;
        minAmount?: number;
        maxAmount?: number;
        remarks?: string;
        paymentPeriod?: number;
        priceType?: string;
      }
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут обновлять
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot update advertisements');
      }

      logger.info('Updating advertisement on Bybit', { 
        itemId: data.itemId,
        accountId: data.bybitAccountId 
      });

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(data.bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${data.bybitAccountId}`);
      }

      // Обновляем объявление через Bybit API
      const updateData: any = {
        itemId: data.itemId
      };

      if (data.updates.price !== undefined) {
        updateData.price = data.updates.price.toString();
      }
      if (data.updates.premium !== undefined) {
        updateData.premium = data.updates.premium;
      }
      if (data.updates.quantity !== undefined) {
        updateData.quantity = data.updates.quantity.toString();
      }
      if (data.updates.minAmount !== undefined) {
        updateData.minOrderAmount = data.updates.minAmount.toString();
      }
      if (data.updates.maxAmount !== undefined) {
        updateData.maxOrderAmount = data.updates.maxAmount.toString();
      }
      if (data.updates.remarks !== undefined) {
        updateData.remark = data.updates.remarks;
      }
      if (data.updates.paymentPeriod !== undefined) {
        updateData.paymentPeriod = data.updates.paymentPeriod;
      }
      if (data.updates.priceType !== undefined) {
        updateData.priceType = data.updates.priceType;
      }

      const result = await client.updateAdvertisement(updateData);

      logger.info('Advertisement updated successfully on Bybit', { 
        itemId: data.itemId,
        accountId: data.bybitAccountId 
      });

      // Emit событие об обновлении
      socket.broadcast.emit('bybitAdvertisement:updated', {
        itemId: data.itemId,
        accountId: data.bybitAccountId,
        updates: data.updates
      });

      handleSuccess(result, 'Advertisement updated successfully', callback);

    } catch (error) {
      logger.error('Error updating advertisement', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Переключение статуса объявления (активно/неактивно)
   */
  static async toggle(
    socket: AuthenticatedSocket,
    data: { 
      itemId: string;
      bybitAccountId: string;
      status: 'on' | 'off';
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут переключать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot toggle advertisements');
      }

      logger.info('Toggling advertisement status on Bybit', { 
        itemId: data.itemId,
        accountId: data.bybitAccountId,
        status: data.status 
      });

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(data.bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${data.bybitAccountId}`);
      }

      // Переключаем статус через Bybit API
      const result = await client.setAdvertisementStatus({
        itemId: data.itemId,
        status: data.status === 'on' ? 1 : 0
      });

      logger.info('Advertisement status toggled successfully', { 
        itemId: data.itemId,
        accountId: data.bybitAccountId,
        newStatus: data.status 
      });

      // Emit событие
      socket.broadcast.emit('bybitAdvertisement:toggled', {
        itemId: data.itemId,
        accountId: data.bybitAccountId,
        status: data.status
      });

      handleSuccess(result, `Advertisement ${data.status === 'on' ? 'activated' : 'deactivated'}`, callback);

    } catch (error) {
      logger.error('Error toggling advertisement', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Удаление объявления на Bybit
   */
  static async delete(
    socket: AuthenticatedSocket,
    data: { 
      itemId: string;
      bybitAccountId: string;
    },
    callback: Function
  ) {
    try {
      // Только админы могут удалять
      if (socket.role !== 'admin') {
        throw new Error('Only admins can delete advertisements');
      }

      logger.info('Deleting advertisement on Bybit', { 
        itemId: data.itemId,
        accountId: data.bybitAccountId 
      });

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(data.bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${data.bybitAccountId}`);
      }

      // Удаляем объявление через Bybit API
      const result = await client.deleteAdvertisement(data.itemId);

      logger.info('Advertisement deleted successfully', { 
        itemId: data.itemId,
        accountId: data.bybitAccountId 
      });

      // Emit событие
      socket.broadcast.emit('bybitAdvertisement:deleted', {
        itemId: data.itemId,
        accountId: data.bybitAccountId
      });

      handleSuccess(result, 'Advertisement deleted successfully', callback);

    } catch (error) {
      logger.error('Error deleting advertisement', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Get Bybit account balances
   */
  static async getBalances(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('Getting Bybit account balances');

      // Get bybitP2PManager from global context
      const bybitManager = (global as any).appContext?.bybitManager;
      
      if (!bybitManager) {
        throw new Error('Bybit P2P Manager not initialized');
      }

      const balances = [];
      const accountIds = bybitManager.getAccounts();

      for (const accountId of accountIds) {
        try {
          const client = bybitManager.getClient(accountId);
          if (!client) {
            logger.warn(`No client found for account ${accountId}`);
            continue;
          }
          const balance = await client.getAccountBalance();
          const accountInfo = await prisma.bybitAccount.findUnique({
            where: { accountId },
            select: { email: true, isActive: true }
          });

          balances.push({
            accountId,
            email: accountInfo?.email || accountId,
            balance: balance || 0,
            currency: 'RUB',
            lastUpdate: new Date().toISOString(),
            isActive: accountInfo?.isActive || false
          });
        } catch (error) {
          logger.warn(`Failed to get balance for account ${accountId}`, error);
          
          const accountInfo = await prisma.bybitAccount.findUnique({
            where: { accountId },
            select: { email: true, isActive: true }
          });

          balances.push({
            accountId,
            email: accountInfo?.email || accountId,
            balance: 0,
            currency: 'RUB',
            lastUpdate: new Date().toISOString(),
            isActive: false,
            error: 'Failed to fetch balance'
          });
        }
      }

      handleSuccess({
        balances,
        total: balances.reduce((sum, acc) => sum + acc.balance, 0)
      }, 'Balances fetched successfully', callback);

    } catch (error) {
      logger.error('Error getting Bybit balances', error);
      handleError(error, callback);
    }
  }

  /**
   * Refresh Bybit account balances
   */
  static async refreshBalances(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('Refreshing Bybit account balances');

      // Get bybitP2PManager from global context
      const bybitManager = (global as any).appContext?.bybitManager;
      
      if (!bybitManager) {
        throw new Error('Bybit P2P Manager not initialized');
      }

      // Force refresh balances
      const balances = [];
      const accountIds = bybitManager.getAccounts();

      for (const accountId of accountIds) {
        try {
          const client = bybitManager.getClient(accountId);
          if (!client) {
            logger.warn(`No client found for account ${accountId}`);
            continue;
          }
          // Force refresh by clearing cache if method exists
          if (client.clearBalanceCache) {
            await client.clearBalanceCache();
          }
          
          const balance = await client.getAccountBalance();
          const accountInfo = await prisma.bybitAccount.findUnique({
            where: { accountId },
            select: { email: true, isActive: true }
          });

          balances.push({
            accountId,
            email: accountInfo?.email || accountId,
            balance: balance || 0,
            currency: 'RUB',
            lastUpdate: new Date().toISOString(),
            isActive: accountInfo?.isActive || false
          });
        } catch (error) {
          logger.warn(`Failed to refresh balance for account ${accountId}`, error);
        }
      }

      // Emit balance update to all connected clients
      socket.to('bybit:balances').emit('bybit:balanceUpdate', { balances });

      handleSuccess({
        balances,
        total: balances.reduce((sum, acc) => sum + acc.balance, 0)
      }, 'Balances refreshed successfully', callback);

    } catch (error) {
      logger.error('Error refreshing Bybit balances', error);
      handleError(error, callback);
    }
  }
}