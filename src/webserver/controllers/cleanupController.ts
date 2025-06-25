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
      // Service is disabled
      const status = {
        status: 'disabled',
        message: 'Cleanup service is disabled (marks completed transactions as cancelled incorrectly)'
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
      // Service is disabled
      throw new Error('Cleanup service is disabled (marks completed transactions as cancelled incorrectly)');
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
      // Service is disabled
      throw new Error('Cleanup service is disabled (marks completed transactions as cancelled incorrectly)');
    } catch (error) {
      handleError(error, callback);
    }
  }
}