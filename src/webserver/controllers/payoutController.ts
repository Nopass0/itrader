/**
 * Контроллер управления выплатами
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';
import { db } from '../../db';

const prisma = new PrismaClient();

export class PayoutController {
  /**
   * Получение списка выплат
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
      
      if (data.status) {
        where.status = data.status;
      }
      
      if (data.gateAccountId) {
        where.gateAccountId = data.gateAccountId;
      }
      
      if (data.minAmount || data.maxAmount) {
        where.amount = {};
        if (data.minAmount) {
          where.amount.gte = data.minAmount;
        }
        if (data.maxAmount) {
          where.amount.lte = data.maxAmount;
        }
      }
      
      if (data.dateFrom || data.dateTo) {
        where.createdAt = {};
        if (data.dateFrom) {
          where.createdAt.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          where.createdAt.lte = new Date(data.dateTo);
        }
      }

      const response = await paginatePrisma(
        prisma.payout,
        {
          ...params,
          where,
          sortBy: params.sortBy || 'createdAt'
        },
        {
          gateAccountRef: true,
          transaction: true
        }
      );

      handleSuccess(response, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение детальной информации о выплате
   */
  static async get(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const payout = await prisma.payout.findUnique({
        where: { id: data.id },
        include: {
          gateAccountRef: true,
          transaction: {
            include: {
              advertisement: true,
              chatMessages: {
                orderBy: { createdAt: 'desc' },
                take: 10
              }
            }
          }
        }
      });

      if (!payout) {
        throw new Error('Payout not found');
      }

      handleSuccess(payout, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание новой выплаты
   */
  static async create(
    socket: AuthenticatedSocket,
    data: {
      gateAccountId: string;
      amount: number;
      recipientCard: string;
      recipientName?: string;
      description?: string;
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут создавать выплаты
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot create payouts');
      }

      // Проверяем существование Gate аккаунта
      const gateAccount = await prisma.gateAccount.findUnique({
        where: { id: data.gateAccountId }
      });

      if (!gateAccount) {
        throw new Error('Gate account not found');
      }

      // Создаем выплату
      const payout = await prisma.payout.create({
        data: {
          gateAccountId: data.gateAccountId,
          amount: data.amount,
          recipientCard: data.recipientCard,
          recipientName: data.recipientName,
          description: data.description,
          status: 'pending'
        },
        include: {
          gateAccountRef: true
        }
      });

      // Emit событие о новой выплате
      socket.broadcast.emit('payout:created', {
        id: payout.id,
        payout
      });

      handleSuccess(payout, 'Payout created successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление статуса выплаты
   */
  static async updateStatus(
    socket: AuthenticatedSocket,
    data: { 
      id: string; 
      status: 'pending' | 'processing' | 'completed' | 'failed';
      failureReason?: string;
      transactionId?: string;
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут обновлять статус
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot update payouts');
      }

      const existing = await prisma.payout.findUnique({
        where: { id: data.id }
      });

      if (!existing) {
        throw new Error('Payout not found');
      }

      // Обновляем выплату
      const updateData: any = {
        status: data.status,
        updatedAt: new Date()
      };

      if (data.failureReason) {
        updateData.failureReason = data.failureReason;
      }

      if (data.transactionId) {
        updateData.transactionId = data.transactionId;
      }

      if (data.status === 'completed') {
        updateData.completedAt = new Date();
      }

      const payout = await prisma.payout.update({
        where: { id: data.id },
        data: updateData,
        include: {
          gateAccount: true,
          transaction: true
        }
      });

      // Emit событие об обновлении
      socket.broadcast.emit('payout:updated', {
        id: payout.id,
        payout
      });

      handleSuccess(payout, 'Payout status updated', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Связывание выплаты с транзакцией
   */
  static async linkToTransaction(
    socket: AuthenticatedSocket,
    data: { payoutId: string; transactionId: string },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут связывать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot link payouts');
      }

      // Проверяем существование
      const payout = await prisma.payout.findUnique({
        where: { id: data.payoutId }
      });

      if (!payout) {
        throw new Error('Payout not found');
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Обновляем выплату
      const updated = await prisma.payout.update({
        where: { id: data.payoutId },
        data: { transactionId: data.transactionId },
        include: {
          gateAccount: true,
          transaction: true
        }
      });

      handleSuccess(updated, 'Payout linked to transaction', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Отмена выплаты
   */
  static async cancel(
    socket: AuthenticatedSocket,
    data: { id: string; reason: string },
    callback: Function
  ) {
    try {
      // Только админы могут отменять выплаты
      if (socket.role !== 'admin') {
        throw new Error('Only admins can cancel payouts');
      }

      const existing = await prisma.payout.findUnique({
        where: { id: data.id }
      });

      if (!existing) {
        throw new Error('Payout not found');
      }

      if (existing.status === 'completed') {
        throw new Error('Cannot cancel completed payout');
      }

      const payout = await prisma.payout.update({
        where: { id: data.id },
        data: {
          status: 'failed',
          failureReason: data.reason,
          updatedAt: new Date()
        },
        include: {
          gateAccount: true,
          transaction: true
        }
      });

      // Emit событие об отмене
      socket.broadcast.emit('payout:cancelled', {
        id: payout.id,
        payout
      });

      handleSuccess(payout, 'Payout cancelled', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Повторная попытка выплаты
   */
  static async retry(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут повторять
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot retry payouts');
      }

      const existing = await prisma.payout.findUnique({
        where: { id: data.id }
      });

      if (!existing) {
        throw new Error('Payout not found');
      }

      if (existing.status !== 'failed') {
        throw new Error('Can only retry failed payouts');
      }

      // Создаем новую выплату на основе старой
      const newPayout = await prisma.payout.create({
        data: {
          gateAccountId: existing.gateAccountId,
          amount: existing.amount,
          recipientCard: existing.recipientCard,
          recipientName: existing.recipientName,
          description: `Retry of ${existing.id}`,
          status: 'pending'
        },
        include: {
          gateAccountRef: true
        }
      });

      handleSuccess(newPayout, 'Payout retry created', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики по выплатам
   */
  static async getStatistics(
    socket: AuthenticatedSocket,
    data: { 
      gateAccountId?: string;
      dateFrom?: string; 
      dateTo?: string;
    },
    callback: Function
  ) {
    try {
      const where: any = {};
      
      if (data.gateAccountId) {
        where.gateAccountId = data.gateAccountId;
      }
      
      if (data.dateFrom || data.dateTo) {
        where.createdAt = {};
        if (data.dateFrom) {
          where.createdAt.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          where.createdAt.lte = new Date(data.dateTo);
        }
      }

      // Статистика по статусам
      const statusStats = await prisma.payout.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      });

      // Общая статистика
      const totalStats = await prisma.payout.aggregate({
        where,
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

      // Статистика по Gate аккаунтам
      const accountStats = await prisma.payout.groupBy({
        by: ['gateAccountId'],
        where,
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      });

      // Дополняем информацией об аккаунтах
      const accountIds = accountStats.map(s => s.gateAccountId);
      const accounts = await prisma.gateAccount.findMany({
        where: { id: { in: accountIds } }
      });

      const accountStatsWithNames = accountStats.map(stat => {
        const account = accounts.find(a => a.id === stat.gateAccountId);
        return {
          ...stat,
          accountName: account?.accountName || 'Unknown'
        };
      });

      // Дневная статистика
      const dailyStats = await prisma.$queryRaw`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as count,
          SUM(amount) as totalAmount,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedCount,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completedAmount
        FROM Payout
        WHERE createdAt >= ${data.dateFrom ? new Date(data.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
        ${data.gateAccountId ? `AND gateAccountId = '${data.gateAccountId}'` : ''}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
      `;

      handleSuccess(
        {
          statusStats,
          totalStats,
          accountStats: accountStatsWithNames,
          dailyStats
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Экспорт выплат
   */
  static async export(
    socket: AuthenticatedSocket,
    data: {
      format: 'csv' | 'json' | 'xlsx';
      filters?: any;
    },
    callback: Function
  ) {
    try {
      // Получаем выплаты с фильтрами
      const where: any = {};
      
      if (data.filters?.status) {
        where.status = data.filters.status;
      }
      
      if (data.filters?.gateAccountId) {
        where.gateAccountId = data.filters.gateAccountId;
      }
      
      if (data.filters?.dateFrom || data.filters?.dateTo) {
        where.createdAt = {};
        if (data.filters.dateFrom) {
          where.createdAt.gte = new Date(data.filters.dateFrom);
        }
        if (data.filters.dateTo) {
          where.createdAt.lte = new Date(data.filters.dateTo);
        }
      }

      const payouts = await prisma.payout.findMany({
        where,
        include: {
          gateAccount: true,
          transaction: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Форматируем данные для экспорта
      const exportData = payouts.map(p => ({
        id: p.id,
        createdAt: p.createdAt,
        status: p.status,
        amount: p.amount,
        recipientCard: p.recipientCard,
        recipientName: p.recipientName,
        gateAccount: p.gateAccountRef?.accountName,
        transactionId: p.transactionId,
        completedAt: p.completedAt,
        failureReason: p.failureReason
      }));

      // В реальном приложении здесь бы была генерация файла
      // Сейчас просто возвращаем данные
      handleSuccess(
        {
          format: data.format,
          data: exportData,
          count: exportData.length
        },
        'Export data prepared',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
}