/**
 * Контроллер управления объявлениями P2P
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();

export class AdvertisementController {
  /**
   * Получение списка объявлений
   */
  static async list(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      // Формируем where условие
      const where: any = {};
      
      if (data.isActive !== undefined) {
        where.isActive = data.isActive;
      }
      
      if (data.bybitAccountId) {
        where.bybitAccountId = data.bybitAccountId;
      }
      
      if (data.type) {
        where.type = data.type;
      }
      
      if (data.currency) {
        where.currency = data.currency;
      }
      
      if (data.fiat) {
        where.fiat = data.fiat;
      }

      const response = await paginatePrisma(
        prisma.advertisement,
        {
          ...params,
          where,
          sortBy: params.sortBy || 'createdAt'
        },
        {
          bybitAccount: true,
          transaction: true
        }
      );

      handleSuccess(response, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение детальной информации об объявлении
   */
  static async get(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const advertisement = await prisma.advertisement.findUnique({
        where: { id: data.id },
        include: {
          bybitAccount: true,
          transaction: {
            include: {
              payout: true
            }
          }
        }
      });

      if (!advertisement) {
        throw new Error('Advertisement not found');
      }

      // Получаем статистику по объявлению
      const stats = await prisma.transaction.groupBy({
        by: ['status'],
        where: { advertisementId: data.id },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      });

      handleSuccess(
        {
          ...advertisement,
          statistics: stats
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание нового объявления
   */
  static async create(
    socket: AuthenticatedSocket,
    data: {
      bybitAccountId: string;
      type: 'sell' | 'buy';
      currency: string;
      fiat: string;
      price: number;
      minAmount: number;
      maxAmount: number;
      paymentMethods: string[];
      description?: string;
      autoReply?: boolean;
      autoReplyMessage?: string;
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут создавать объявления
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot create advertisements');
      }

      // Проверяем существование Bybit аккаунта
      const bybitAccount = await prisma.bybitAccount.findUnique({
        where: { id: data.bybitAccountId }
      });

      if (!bybitAccount) {
        throw new Error('Bybit account not found');
      }

      // First create a placeholder payout for the advertisement
      const payout = await prisma.payout.create({
        data: {
          status: 0,  // Initial status
          meta: {
            type: 'advertisement_placeholder',
            currency: data.currency
          }
        }
      });

      // Создаем объявление
      const advertisement = await prisma.advertisement.create({
        data: {
          bybitAccountId: data.bybitAccountId,
          payoutId: payout.id,
          type: data.type,
          currency: data.currency,
          fiat: data.fiat,
          price: data.price.toString(),
          minAmount: data.minAmount,
          maxAmount: data.maxAmount,
          paymentMethods: data.paymentMethods,
          description: data.description,
          autoReply: data.autoReply || false,
          autoReplyMessage: data.autoReplyMessage,
          isActive: true
        },
        include: {
          bybitAccount: true
        }
      });

      // Emit событие о новом объявлении
      socket.broadcast.emit('advertisement:created', {
        id: advertisement.id,
        advertisement
      });

      handleSuccess(advertisement, 'Advertisement created successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление объявления
   */
  static async update(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут обновлять
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot update advertisements');
      }

      const existing = await prisma.advertisement.findUnique({
        where: { id: data.id }
      });

      if (!existing) {
        throw new Error('Advertisement not found');
      }

      // Не позволяем менять критичные поля
      const { bybitAccountId, type, currency, fiat, ...safeUpdates } = data.updates;

      const advertisement = await prisma.advertisement.update({
        where: { id: data.id },
        data: {
          ...safeUpdates,
          updatedAt: new Date()
        },
        include: {
          bybitAccount: true
        }
      });

      // Emit событие об обновлении
      socket.broadcast.emit('advertisement:updated', {
        id: advertisement.id,
        advertisement
      });

      handleSuccess(advertisement, 'Advertisement updated', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Включение/выключение объявления
   */
  static async toggle(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут переключать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot toggle advertisements');
      }

      const existing = await prisma.advertisement.findUnique({
        where: { id: data.id }
      });

      if (!existing) {
        throw new Error('Advertisement not found');
      }

      const advertisement = await prisma.advertisement.update({
        where: { id: data.id },
        data: {
          isActive: !existing.isActive,
          updatedAt: new Date()
        },
        include: {
          bybitAccount: true
        }
      });

      // Emit событие
      socket.broadcast.emit('advertisement:toggled', {
        id: advertisement.id,
        isActive: advertisement.isActive
      });

      handleSuccess(
        advertisement,
        `Advertisement ${advertisement.isActive ? 'activated' : 'deactivated'}`,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление объявления
   */
  static async delete(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы могут удалять
      if (socket.role !== 'admin') {
        throw new Error('Only admins can delete advertisements');
      }

      // Проверяем нет ли активных транзакций
      const activeTransactions = await prisma.transaction.count({
        where: {
          advertisementId: data.id,
          status: {
            notIn: ['completed', 'failed', 'cancelled']
          }
        }
      });

      if (activeTransactions > 0) {
        throw new Error('Cannot delete advertisement with active transactions');
      }

      await prisma.advertisement.delete({
        where: { id: data.id }
      });

      // Emit событие
      socket.broadcast.emit('advertisement:deleted', {
        id: data.id
      });

      handleSuccess(null, 'Advertisement deleted', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Массовое обновление цен
   */
  static async bulkUpdatePrices(
    socket: AuthenticatedSocket,
    data: {
      ids: string[];
      priceAdjustment: {
        type: 'fixed' | 'percentage';
        value: number;
      };
    },
    callback: Function
  ) {
    try {
      // Только админы могут массово обновлять
      if (socket.role !== 'admin') {
        throw new Error('Only admins can bulk update prices');
      }

      const advertisements = await prisma.advertisement.findMany({
        where: { id: { in: data.ids } }
      });

      const updates = await Promise.all(
        advertisements.map(async (ad) => {
          let newPrice = ad.price;
          
          if (data.priceAdjustment.type === 'fixed') {
            newPrice = ad.price + data.priceAdjustment.value;
          } else {
            newPrice = ad.price * (1 + data.priceAdjustment.value / 100);
          }

          return prisma.advertisement.update({
            where: { id: ad.id },
            data: { price: newPrice }
          });
        })
      );

      handleSuccess(
        {
          updated: updates.length,
          advertisements: updates
        },
        'Prices updated successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики по объявлениям
   */
  static async getStatistics(
    socket: AuthenticatedSocket,
    data: {
      bybitAccountId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    callback: Function
  ) {
    try {
      const where: any = {};
      
      if (data.bybitAccountId) {
        where.bybitAccountId = data.bybitAccountId;
      }

      // Общее количество объявлений
      const totalCount = await prisma.advertisement.count({ where });
      const activeCount = await prisma.advertisement.count({
        where: { ...where, isActive: true }
      });

      // Статистика по типам
      const typeStats = await prisma.advertisement.groupBy({
        by: ['type'],
        where,
        _count: {
          id: true
        }
      });

      // Статистика по валютам
      const currencyStats = await prisma.advertisement.groupBy({
        by: ['currency', 'fiat'],
        where,
        _count: {
          id: true
        }
      });

      // Статистика транзакций по объявлениям
      const transactionWhere: any = {};
      
      if (data.dateFrom || data.dateTo) {
        transactionWhere.createdAt = {};
        if (data.dateFrom) {
          transactionWhere.createdAt.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          transactionWhere.createdAt.lte = new Date(data.dateTo);
        }
      }

      if (data.bybitAccountId) {
        // Получаем ID объявлений для этого аккаунта
        const adIds = await prisma.advertisement.findMany({
          where: { bybitAccountId: data.bybitAccountId },
          select: { id: true }
        });
        transactionWhere.advertisementId = {
          in: adIds.map(ad => ad.id)
        };
      }

      const transactionStats = await prisma.transaction.aggregate({
        where: {
          ...transactionWhere,
          status: 'completed'
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        },
        _avg: {
          amount: true
        }
      });

      // Топ объявлений по количеству транзакций
      const topAdvertisements = await prisma.$queryRaw`
        SELECT 
          a.id,
          a.type,
          a.currency,
          a.fiat,
          a.price,
          COUNT(t.id) as transactionCount,
          SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END) as totalAmount,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completedCount
        FROM Advertisement a
        LEFT JOIN Transaction t ON t.advertisementId = a.id
        ${data.bybitAccountId ? `WHERE a.bybitAccountId = '${data.bybitAccountId}'` : ''}
        GROUP BY a.id
        ORDER BY transactionCount DESC
        LIMIT 10
      `;

      handleSuccess(
        {
          overview: {
            total: totalCount,
            active: activeCount,
            inactive: totalCount - activeCount
          },
          typeStats,
          currencyStats,
          transactionStats,
          topAdvertisements
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Клонирование объявления
   */
  static async clone(
    socket: AuthenticatedSocket,
    data: { id: string; bybitAccountId?: string },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут клонировать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot clone advertisements');
      }

      const original = await prisma.advertisement.findUnique({
        where: { id: data.id }
      });

      if (!original) {
        throw new Error('Advertisement not found');
      }

      // Создаем клон
      const { id, createdAt, updatedAt, ...cloneData } = original;
      
      const clone = await prisma.advertisement.create({
        data: {
          ...cloneData,
          bybitAccountId: data.bybitAccountId || original.bybitAccountId,
          isActive: false // Клоны создаются неактивными
        },
        include: {
          bybitAccount: true
        }
      });

      handleSuccess(clone, 'Advertisement cloned successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
}