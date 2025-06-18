/**
 * Контроллер управления аккаунтами системы
 */

import type { AuthenticatedSocket } from '../types';
import { AuthManager } from '../auth/authManager';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';

const authManager = new AuthManager();
const prisma = new PrismaClient();

export class AccountController {
  /**
   * Создание нового аккаунта
   */
  static async create(
    socket: AuthenticatedSocket,
    data: { username: string; role?: 'admin' | 'operator' | 'viewer' },
    callback: Function
  ) {
    try {
      // Только админы могут создавать аккаунты
      if (socket.role !== 'admin') {
        throw new Error('Only admins can create accounts');
      }

      const { account, password } = await authManager.createAccount(
        data.username,
        data.role || 'operator'
      );

      console.log(`[AccountController] Created account: ${account.username} with password: ${password}`);

      handleSuccess(
        {
          account: {
            id: account.id,
            username: account.username,
            role: account.role,
            createdAt: account.createdAt,
            isActive: account.isActive
          },
          password // Показываем пароль только при создании
        },
        'Account created successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление аккаунта
   */
  static async update(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function
  ) {
    try {
      // Только админы могут обновлять аккаунты
      if (socket.role !== 'admin') {
        throw new Error('Only admins can update accounts');
      }

      const account = await authManager.updateAccount(data.id, data.updates);

      handleSuccess(
        {
          id: account.id,
          username: account.username,
          role: account.role,
          isActive: account.isActive,
          updatedAt: account.updatedAt
        },
        'Account updated successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление аккаунта
   */
  static async delete(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы могут удалять аккаунты
      if (socket.role !== 'admin') {
        throw new Error('Only admins can delete accounts');
      }

      // Нельзя удалить свой аккаунт
      if (data.id === socket.accountId) {
        throw new Error('Cannot delete your own account');
      }

      await authManager.deleteAccount(data.id);

      handleSuccess(null, 'Account deleted successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение списка аккаунтов
   */
  static async list(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      const response = await paginatePrisma(
        prisma.systemAccount,
        {
          ...params,
          where: data.isActive !== undefined ? { isActive: data.isActive } : undefined
        }
      );

      // Убираем passwordHash из ответа
      const sanitizedData = response.data.map((account: any) => ({
        id: account.id,
        username: account.username,
        role: account.role,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastLogin: account.lastLogin,
        isActive: account.isActive
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
   * Сброс пароля
   */
  static async resetPassword(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы могут сбрасывать пароли
      if (socket.role !== 'admin') {
        throw new Error('Only admins can reset passwords');
      }

      const newPassword = await authManager.resetPassword(data.id);

      console.log(`[AccountController] Reset password for account ${data.id}: ${newPassword}`);

      handleSuccess(
        { password: newPassword },
        'Password reset successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение информации о текущем пользователе
   */
  static async getCurrentUser(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      const account = await authManager.getAccountById(socket.accountId!);
      
      if (!account) {
        throw new Error('Account not found');
      }

      handleSuccess(
        {
          id: account.id,
          username: account.username,
          role: account.role,
          createdAt: account.createdAt,
          lastLogin: account.lastLogin
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Изменение собственного пароля
   */
  static async changePassword(
    socket: AuthenticatedSocket,
    data: { currentPassword: string; newPassword: string },
    callback: Function
  ) {
    try {
      const account = await authManager.getAccountById(socket.accountId!);
      
      if (!account) {
        throw new Error('Account not found');
      }

      // Проверяем текущий пароль
      const { verifyPassword, hashPassword } = await import('../utils/password');
      const isValid = await verifyPassword(data.currentPassword, account.passwordHash);
      
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Хешируем новый пароль
      const newHash = await hashPassword(data.newPassword);

      // Обновляем пароль
      await prisma.systemAccount.update({
        where: { id: account.id },
        data: { passwordHash: newHash }
      });

      // Удаляем все токены кроме текущего
      await prisma.authToken.deleteMany({
        where: {
          accountId: account.id,
          NOT: {
            token: socket.handshake.auth?.token
          }
        }
      });

      handleSuccess(null, 'Password changed successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
}