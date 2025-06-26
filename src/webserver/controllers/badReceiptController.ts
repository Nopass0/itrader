/**
 * Bad Receipt Controller
 * Handles WebSocket endpoints for non-T-Bank receipts
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';
import { getBadReceiptService } from '../../services/badReceiptService';
import * as fs from 'fs/promises';

const logger = createLogger('BadReceiptController');

export class BadReceiptController {
  /**
   * Get list of bad receipts
   */
  static async list(
    socket: AuthenticatedSocket,
    data: {
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    callback: Function
  ) {
    try {
      logger.info('Getting bad receipts list', {
        userId: socket.accountId,
        params: data
      });

      const badReceiptService = getBadReceiptService();
      const result = await badReceiptService.getBadReceipts(data);

      handleSuccess(result, 'Bad receipts loaded successfully', callback);
    } catch (error) {
      logger.error('Failed to get bad receipts', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Get bad receipt by ID
   */
  static async get(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      logger.info('Getting bad receipt details', {
        userId: socket.accountId,
        receiptId: data.id
      });

      const badReceiptService = getBadReceiptService();
      const badReceipt = await badReceiptService.getBadReceiptById(data.id);

      handleSuccess(badReceipt, 'Bad receipt loaded successfully', callback);
    } catch (error) {
      logger.error('Failed to get bad receipt', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Download bad receipt file
   */
  static async download(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      logger.info('Downloading bad receipt', {
        userId: socket.accountId,
        receiptId: data.id
      });

      const badReceiptService = getBadReceiptService();
      const { filePath, filename } = await badReceiptService.downloadBadReceipt(data.id);

      // Read file content
      const fileContent = await fs.readFile(filePath);
      const base64Content = fileContent.toString('base64');

      handleSuccess({
        filename,
        content: base64Content,
        contentType: 'application/pdf'
      }, 'Bad receipt file ready for download', callback);
    } catch (error) {
      logger.error('Failed to download bad receipt', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Delete bad receipt
   */
  static async delete(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      logger.info('Deleting bad receipt', {
        userId: socket.accountId,
        receiptId: data.id
      });

      // Check if user is admin
      if (socket.role !== 'admin') {
        throw new Error('Only administrators can delete bad receipts');
      }

      const badReceiptService = getBadReceiptService();
      const result = await badReceiptService.deleteBadReceipt(data.id);

      handleSuccess(result, 'Bad receipt deleted successfully', callback);
    } catch (error) {
      logger.error('Failed to delete bad receipt', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Get bad receipts statistics
   */
  static async getStats(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('Getting bad receipts statistics', {
        userId: socket.accountId
      });

      const badReceiptService = getBadReceiptService();
      const stats = await badReceiptService.getStatistics();

      handleSuccess(stats, 'Bad receipts statistics loaded', callback);
    } catch (error) {
      logger.error('Failed to get bad receipts statistics', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Subscribe to bad receipt updates
   */
  static async subscribe(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('User subscribed to bad receipt updates', {
        userId: socket.accountId
      });

      // Join bad receipts room
      socket.join('badReceipts');

      handleSuccess({}, 'Subscribed to bad receipt updates', callback);
    } catch (error) {
      logger.error('Failed to subscribe to bad receipts', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Unsubscribe from bad receipt updates
   */
  static async unsubscribe(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('User unsubscribed from bad receipt updates', {
        userId: socket.accountId
      });

      // Leave bad receipts room
      socket.leave('badReceipts');

      handleSuccess({}, 'Unsubscribed from bad receipt updates', callback);
    } catch (error) {
      logger.error('Failed to unsubscribe from bad receipts', error as Error);
      handleError(error, callback);
    }
  }
}