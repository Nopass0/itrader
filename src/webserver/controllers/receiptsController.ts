/**
 * WebSocket controller for receipts functionality
 */

import { AuthenticatedSocket } from '../types/socket';
import { prisma } from '../../../generated/prisma';
import { createLogger } from '../../logger';
import { handleError, handleSuccess, validatePaginationParams, paginatePrisma } from '../utils/response';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('ReceiptsController');

export class ReceiptsController {
  /**
   * Get receipts with pagination and filters
   */
  static async getReceipts(
    socket: AuthenticatedSocket,
    data: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      amountMin?: number;
      amountMax?: number;
      dateFrom?: string;
      dateTo?: string;
      wallet?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    callback?: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      // Build where clause
      const where: any = {};
      
      // Search filter
      if (data.search) {
        where.OR = [
          { senderName: { contains: data.search, mode: 'insensitive' } },
          { recipientName: { contains: data.search, mode: 'insensitive' } },
          { recipientPhone: { contains: data.search, mode: 'insensitive' } },
          { recipientCard: { contains: data.search, mode: 'insensitive' } },
          { reference: { contains: data.search, mode: 'insensitive' } },
        ];
      }
      
      // Status filter
      if (data.status) {
        where.status = data.status;
      }
      
      // Amount filters
      if (data.amountMin !== undefined || data.amountMax !== undefined) {
        where.amount = {};
        if (data.amountMin !== undefined) {
          where.amount.gte = data.amountMin;
        }
        if (data.amountMax !== undefined) {
          where.amount.lte = data.amountMax;
        }
      }
      
      // Date filters
      if (data.dateFrom || data.dateTo) {
        where.transactionDate = {};
        if (data.dateFrom) {
          where.transactionDate.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          where.transactionDate.lte = new Date(data.dateTo);
        }
      }
      
      // Wallet filter
      if (data.wallet) {
        where.OR = where.OR || [];
        where.OR.push(
          { recipientPhone: { contains: data.wallet, mode: 'insensitive' } },
          { recipientCard: { contains: data.wallet, mode: 'insensitive' } }
        );
      }
      
      // Sorting
      const orderBy: any = {};
      const sortField = data.sortBy || 'createdAt';
      orderBy[sortField] = data.sortOrder || 'desc';
      
      const response = await paginatePrisma(
        prisma.receipt,
        {
          ...params,
          where,
          orderBy,
          include: {
            payout: {
              include: {
                gateAccount: {
                  select: {
                    email: true,
                    accountName: true
                  }
                }
              }
            }
          }
        }
      );
      
      handleSuccess(response, 'Receipts fetched successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
  
  /**
   * Get receipt statistics
   */
  static async getReceiptStats(
    socket: AuthenticatedSocket,
    data: any,
    callback?: Function
  ) {
    try {
      const [
        total,
        matched,
        unmatched,
        totalAmountResult,
        recentCount
      ] = await Promise.all([
        // Total receipts
        prisma.receipt.count(),
        
        // Matched receipts
        prisma.receipt.count({
          where: { payoutId: { not: null } }
        }),
        
        // Unmatched receipts
        prisma.receipt.count({
          where: { payoutId: null }
        }),
        
        // Total amount
        prisma.receipt.aggregate({
          _sum: { amount: true }
        }),
        
        // Recent receipts (last 24 hours)
        prisma.receipt.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);
      
      const stats = {
        summary: {
          total,
          matched,
          unmatched,
          totalAmount: totalAmountResult._sum.amount || 0,
          recentCount
        }
      };
      
      handleSuccess(stats, 'Receipt statistics fetched successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
  
  /**
   * Delete a receipt
   */
  static async deleteReceipt(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback?: Function
  ) {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { id: data.id }
      });
      
      if (!receipt) {
        throw new Error('Receipt not found');
      }
      
      // Delete PDF file if exists
      if (receipt.filePath) {
        try {
          await fs.unlink(receipt.filePath);
        } catch (error) {
          logger.warn('Failed to delete PDF file', { filePath: receipt.filePath, error });
        }
      }
      
      // Delete receipt from database
      await prisma.receipt.delete({
        where: { id: data.id }
      });
      
      handleSuccess({ id: data.id }, 'Receipt deleted successfully', callback);
      
      // Emit event
      socket.emit('receipts:deleted', { receiptId: data.id });
    } catch (error) {
      handleError(error, callback);
    }
  }
  
  /**
   * Match unmatched receipts with payouts
   */
  static async matchUnmatchedReceipts(
    socket: AuthenticatedSocket,
    data: any,
    callback?: Function
  ) {
    try {
      logger.info('Starting manual receipt matching');
      
      // Get unmatched receipts
      const unmatchedReceipts = await prisma.receipt.findMany({
        where: {
          payoutId: null,
          status: 'SUCCESS',
          amount: { gt: 0 }
        }
      });
      
      let matchedCount = 0;
      
      for (const receipt of unmatchedReceipts) {
        // Look for matching payout
        const matchingPayout = await prisma.payout.findFirst({
          where: {
            receiptId: null,
            amount: {
              gte: receipt.amount - 100,
              lte: receipt.amount + 100
            },
            createdAt: {
              gte: new Date(receipt.transactionDate.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(receipt.transactionDate.getTime() + 24 * 60 * 60 * 1000)
            },
            OR: [
              { recipientPhone: receipt.recipientPhone },
              { recipientCard: receipt.recipientCard }
            ]
          }
        });
        
        if (matchingPayout) {
          // Update both receipt and payout
          await prisma.$transaction([
            prisma.receipt.update({
              where: { id: receipt.id },
              data: { 
                payoutId: matchingPayout.id,
                isProcessed: true
              }
            }),
            prisma.payout.update({
              where: { id: matchingPayout.id },
              data: { receiptId: receipt.id }
            })
          ]);
          
          matchedCount++;
          logger.info('Receipt matched with payout', {
            receiptId: receipt.id,
            payoutId: matchingPayout.id
          });
          
          // Emit event
          socket.emit('receipts:matched', {
            receiptId: receipt.id,
            payoutId: matchingPayout.id
          });
        }
      }
      
      handleSuccess(
        {
          unmatchedTotal: unmatchedReceipts.length,
          matchedCount
        },
        `Matched ${matchedCount} receipts`,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
  
  /**
   * Download receipt PDF
   */
  static async downloadPDF(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback?: Function
  ) {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { id: data.id }
      });
      
      if (!receipt) {
        throw new Error('Receipt not found');
      }
      
      if (!receipt.filePath) {
        throw new Error('No PDF file associated with this receipt');
      }
      
      // Read PDF file
      const pdfBuffer = await fs.readFile(receipt.filePath);
      const base64 = pdfBuffer.toString('base64');
      
      handleSuccess(
        {
          filename: `receipt_${receipt.id}.pdf`,
          data: base64,
          mimeType: 'application/pdf'
        },
        'PDF downloaded successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
  
  /**
   * Subscribe to receipt updates
   */
  static async subscribeToReceipts(
    socket: AuthenticatedSocket,
    data: any,
    callback?: Function
  ) {
    try {
      socket.join('receipts:updates');
      handleSuccess({}, 'Subscribed to receipt updates', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
  
  /**
   * Unsubscribe from receipt updates
   */
  static async unsubscribeFromReceipts(
    socket: AuthenticatedSocket,
    data: any,
    callback?: Function
  ) {
    try {
      socket.leave('receipts:updates');
      handleSuccess({}, 'Unsubscribed from receipt updates', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
}