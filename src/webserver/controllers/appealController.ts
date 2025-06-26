/**
 * Controller for managing appeal sync operations
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';

const logger = createLogger('AppealController');

export class AppealController {
  /**
   * Manually trigger appeal sync
   */
  static async syncAppeals(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      // Only admins can trigger manual sync
      if (socket.role !== 'admin') {
        throw new Error('Only admins can trigger appeal sync');
      }

      logger.info('Manual appeal sync triggered by admin', {
        userId: socket.userId,
        username: socket.username
      });

      // Get appeal sync service from global context
      const appealSyncService = (global as any).appContext?.appealSyncService;
      
      if (!appealSyncService) {
        throw new Error('Appeal sync service not initialized');
      }

      // Trigger sync
      const result = await appealSyncService.syncNow();

      logger.info('Appeal sync completed', result);

      handleSuccess({
        ...result,
        message: `Synced ${result.totalAppeals} appeals, updated ${result.updatedTransactions} transactions`
      }, 'Appeal sync completed', callback);

    } catch (error) {
      logger.error('Error in appeal sync', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Get appeal sync status
   */
  static async getStatus(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      const appealSyncService = (global as any).appContext?.appealSyncService;
      
      const status = {
        initialized: !!appealSyncService,
        running: appealSyncService?.isRunning || false,
        lastSync: null // Could track this in the service
      };

      handleSuccess(status, undefined, callback);

    } catch (error) {
      handleError(error, callback);
    }
  }
}