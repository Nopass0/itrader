/**
 * Контроллер управления платформенными аккаунтами (Gate, Bybit)
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';
import { getActiveGateAccounts, upsertGateAccount, getActiveBybitAccounts, upsertBybitAccount } from '../../db';

const prisma = new PrismaClient();

export class PlatformAccountController {
  /**
   * Список Gate аккаунтов
   */
  static async listGateAccounts(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      const response = await paginatePrisma(
        prisma.gateAccount,
        {
          ...params,
          where: data.isActive !== undefined ? { isActive: data.isActive } : undefined,
          orderBy: { createdAt: 'desc' }
        }
      );

      // Скрываем пароль и API ключи
      const sanitizedData = response.data.map((account: any) => ({
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        email: account.email,
        isActive: account.isActive,
        lastSync: account.lastSync,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        // Добавляем placeholder для API ключей
        apiKey: account.apiKey ? '***' + account.apiKey.slice(-4) : null,
        hasApiKey: !!account.apiKey,
        hasApiSecret: !!account.apiSecret
      }));

      handleSuccess(
        {
          ...response,
          data: sanitizedData
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание Gate аккаунта
   */
  static async createGateAccount(
    socket: AuthenticatedSocket,
    data: { email: string; password: string; apiKey: string; apiSecret: string; accountName?: string },
    callback: Function
  ) {
    try {
      // Проверяем, не существует ли уже аккаунт с таким email
      const existing = await prisma.gateAccount.findUnique({
        where: { email: data.email }
      });

      if (existing) {
        throw new Error('Account with this email already exists');
      }

      // Создаем аккаунт
      const account = await prisma.gateAccount.create({
        data: {
          accountId: `gate_${Date.now()}`, // Уникальный ID
          email: data.email,
          password: data.password,
          apiKey: data.apiKey || '',
          apiSecret: data.apiSecret || '',
          accountName: data.accountName || data.email,
          isActive: true
        }
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          email: account.email,
          accountName: account.accountName,
          isActive: account.isActive,
          createdAt: account.createdAt
        },
        'Gate account created successfully',
        callback
      );

      // Emit event for real-time updates
      socket.emit('platform:accountCreated', {
        platform: 'gate',
        account: {
          id: account.id,
          email: account.email,
          accountName: account.accountName
        }
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление Gate аккаунта
   */
  static async deleteGateAccount(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Soft delete - just mark as inactive
      const account = await prisma.gateAccount.update({
        where: { id: data.id },
        data: { isActive: false }
      });

      handleSuccess(null, 'Gate account deleted successfully', callback);

      // Emit event for real-time updates
      socket.emit('platform:accountDeleted', {
        platform: 'gate',
        accountId: data.id
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Список Bybit аккаунтов
   */
  static async listBybitAccounts(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      const response = await paginatePrisma(
        prisma.bybitAccount,
        {
          ...params,
          where: data.isActive !== undefined ? { isActive: data.isActive } : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            advertisements: {
              where: { isActive: true },
              select: { id: true }
            }
          }
        }
      );

      // Скрываем API ключи
      const sanitizedData = response.data.map((account: any) => ({
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        isActive: account.isActive,
        activeAdsCount: account.advertisements?.length || 0,
        lastSync: account.lastSync,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        // Добавляем placeholder для API ключей
        apiKey: account.apiKey ? '***' + account.apiKey.slice(-4) : null,
        hasApiKey: !!account.apiKey,
        hasApiSecret: !!account.apiSecret
      }));

      handleSuccess(
        {
          ...response,
          data: sanitizedData
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание Bybit аккаунта
   */
  static async createBybitAccount(
    socket: AuthenticatedSocket,
    data: { apiKey: string; apiSecret: string; accountName?: string },
    callback: Function
  ) {
    try {
      // Проверяем, не существует ли уже аккаунт с таким API ключом
      const existing = await prisma.bybitAccount.findFirst({
        where: { apiKey: data.apiKey }
      });

      if (existing) {
        throw new Error('Account with this API key already exists');
      }

      // Создаем аккаунт
      const account = await prisma.bybitAccount.create({
        data: {
          accountId: `bybit_${Date.now()}`, // Уникальный ID
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          accountName: data.accountName || 'Bybit Account',
          isActive: true
        }
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName,
          isActive: account.isActive,
          createdAt: account.createdAt
        },
        'Bybit account created successfully',
        callback
      );

      // Emit event for real-time updates
      socket.emit('platform:accountCreated', {
        platform: 'bybit',
        account: {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName
        }
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление Bybit аккаунта
   */
  static async deleteBybitAccount(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Soft delete - just mark as inactive
      const account = await prisma.bybitAccount.update({
        where: { id: data.id },
        data: { isActive: false }
      });

      handleSuccess(null, 'Bybit account deleted successfully', callback);

      // Emit event for real-time updates
      socket.emit('platform:accountDeleted', {
        platform: 'bybit',
        accountId: data.id
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление Gate аккаунта
   */
  static async updateGateAccount(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function
  ) {
    try {
      const allowedUpdates = ['accountName', 'apiKey', 'apiSecret', 'password', 'isActive'];
      const filteredUpdates: any = {};

      // Фильтруем разрешенные поля
      for (const key of allowedUpdates) {
        if (data.updates[key] !== undefined) {
          filteredUpdates[key] = data.updates[key];
        }
      }

      const account = await prisma.gateAccount.update({
        where: { id: data.id },
        data: filteredUpdates
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          email: account.email,
          accountName: account.accountName,
          isActive: account.isActive,
          updatedAt: account.updatedAt
        },
        'Gate account updated successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление Bybit аккаунта
   */
  static async updateBybitAccount(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function
  ) {
    try {
      const allowedUpdates = ['accountName', 'apiKey', 'apiSecret', 'isActive'];
      const filteredUpdates: any = {};

      // Фильтруем разрешенные поля
      for (const key of allowedUpdates) {
        if (data.updates[key] !== undefined) {
          filteredUpdates[key] = data.updates[key];
        }
      }

      const account = await prisma.bybitAccount.update({
        where: { id: data.id },
        data: filteredUpdates
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName,
          isActive: account.isActive,
          updatedAt: account.updatedAt
        },
        'Bybit account updated successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики Gate аккаунта
   */
  static async getGateAccountStats(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const account = await prisma.gateAccount.findUnique({
        where: { id: data.id },
        include: {
          _count: {
            select: {
              payouts: true
            }
          }
        }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Получаем статистику по выплатам
      const payoutStats = await prisma.payout.groupBy({
        by: ['status'],
        where: {
          gateAccountId: data.id
        },
        _count: true
      });

      handleSuccess(
        {
          account: {
            id: account.id,
            email: account.email,
            accountName: account.accountName,
            lastSync: account.lastSync
          },
          stats: {
            totalPayouts: account._count.payouts,
            payoutsByStatus: payoutStats
          }
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики Bybit аккаунта
   */
  static async getBybitAccountStats(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const account = await prisma.bybitAccount.findUnique({
        where: { id: data.id },
        include: {
          advertisements: {
            where: { isActive: true }
          },
          _count: {
            select: {
              advertisements: true
            }
          }
        }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Получаем статистику по транзакциям
      const transactionStats = await prisma.transaction.groupBy({
        by: ['status'],
        where: {
          advertisement: {
            bybitAccountId: data.id
          }
        },
        _count: true
      });

      handleSuccess(
        {
          account: {
            id: account.id,
            accountId: account.accountId,
            accountName: account.accountName,
            lastSync: account.lastSync
          },
          stats: {
            totalAds: account._count.advertisements,
            activeAds: account.advertisements.length,
            transactionsByStatus: transactionStats
          }
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
}