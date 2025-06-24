/**
 * Контроллер для управления очисткой объявлений
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';

const logger = createLogger('CleanupController');

export class CleanupController {
  /**
   * Получение статуса сервиса очистки
   */
  static async getStatus(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      const context = (global as any).appContext;
      const cleanupService = context?.cleanupAdvertisementsService;
      
      if (!cleanupService) {
        handleSuccess({
          status: 'not_initialized',
          message: 'Cleanup service is not initialized'
        }, undefined, callback);
        return;
      }

      const status = {
        status: 'running',
        message: 'Cleanup service is running'
      };

      handleSuccess(status, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Запуск принудительной очистки
   */
  static async forceCleanup(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      // Только админы могут запускать принудительную очистку
      if (socket.role !== 'admin') {
        throw new Error('Only admins can force cleanup');
      }

      const context = (global as any).appContext;
      const cleanupService = context?.cleanupAdvertisementsService;
      
      if (!cleanupService) {
        throw new Error('Cleanup service is not initialized');
      }

      logger.info('Force cleanup requested', { userId: socket.accountId });
      
      await cleanupService.forceCleanup();

      handleSuccess(null, 'Force cleanup completed', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Очистка объявления для конкретной транзакции
   */
  static async cleanupTransaction(
    socket: AuthenticatedSocket,
    data: { transactionId: string },
    callback: Function
  ) {
    try {
      // Только админы могут очищать транзакции
      if (socket.role !== 'admin') {
        throw new Error('Only admins can cleanup transactions');
      }

      const context = (global as any).appContext;
      const cleanupService = context?.cleanupAdvertisementsService;
      
      if (!cleanupService) {
        throw new Error('Cleanup service is not initialized');
      }

      logger.info('Cleanup transaction requested', { 
        transactionId: data.transactionId,
        userId: socket.accountId 
      });
      
      await cleanupService.cleanupSingleTransaction(data.transactionId);

      handleSuccess(null, 'Transaction cleaned up successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
}