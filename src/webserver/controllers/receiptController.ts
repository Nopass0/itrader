/**
 * Контроллер управления чеками
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

export class ReceiptController {
  /**
   * Subscribe to receipt updates
   */
  static async subscribe(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
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
  static async unsubscribe(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      socket.leave('receipts:updates');
      handleSuccess({}, 'Unsubscribed from receipt updates', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
  /**
   * Получить список всех чеков с фильтрацией
   */
  static async listReceipts(
    socket: AuthenticatedSocket,
    data: {
      page?: number;
      limit?: number;
      search?: string;
      transactionId?: string;
      status?: string;
      amountMin?: number;
      amountMax?: number;
      dateFrom?: string;
      dateTo?: string;
      sender?: string;
      wallet?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      // Build where clause for filters
      const where: any = {};
      
      // Search filter
      if (data.search) {
        where.OR = [
          { senderName: { contains: data.search } },
          { recipientName: { contains: data.search } },
          { recipientPhone: { contains: data.search } },
          { recipientCard: { contains: data.search } },
          { reference: { contains: data.search } },
          { rawText: { contains: data.search } }
        ];
      }
      
      // Specific filters
      if (data.transactionId) {
        where.transactionId = data.transactionId;
      }
      
      if (data.status) {
        where.status = data.status;
      }
      
      if (data.sender) {
        where.senderName = { contains: data.sender };
      }
      
      if (data.wallet) {
        where.OR = [
          { recipientPhone: { contains: data.wallet } },
          { recipientCard: { contains: data.wallet } }
        ];
      }
      
      // Amount range
      if (data.amountMin !== undefined || data.amountMax !== undefined) {
        where.amount = {};
        if (data.amountMin !== undefined) {
          where.amount.gte = data.amountMin;
        }
        if (data.amountMax !== undefined) {
          where.amount.lte = data.amountMax;
        }
      }
      
      // Date range
      if (data.dateFrom || data.dateTo) {
        where.transactionDate = {};
        if (data.dateFrom) {
          where.transactionDate.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          where.transactionDate.lte = new Date(data.dateTo);
        }
      }
      
      const response = await paginatePrisma(
        prisma.receipt,
        {
          ...params,
          where,
          sortBy: data.sortBy || 'createdAt',
          sortOrder: data.sortOrder || 'desc'
        }
      );

      // Fetch payout data for receipts with payoutId
      const receiptsWithPayouts = await Promise.all(
        response.data.map(async (receipt: any) => {
          if (receipt.payoutId) {
            const payout = await prisma.payout.findUnique({
              where: { id: receipt.payoutId },
              select: {
                id: true,
                gatePayoutId: true,
                gateAccount: true,
                status: true,
                amount: true
              }
            });
            return { ...receipt, payout };
          }
          return receipt;
        })
      );

      // Format response to match frontend expectations
      handleSuccess({
        data: receiptsWithPayouts,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
        page: response.pagination.page,
        limit: response.pagination.limit
      }, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получить детали чека
   */
  static async getReceipt(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { id: data.id }
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      handleSuccess(receipt, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получить PDF файл чека
   */
  static async getReceiptPDF(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { id: data.id }
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (!receipt.filePath) {
        throw new Error('PDF file not available');
      }

      const pdfPath = path.resolve(receipt.filePath);
      
      // Check if file exists
      try {
        await fs.access(pdfPath);
      } catch {
        throw new Error('PDF file not found on disk');
      }

      // Read file
      const pdfBuffer = await fs.readFile(pdfPath);
      const base64 = pdfBuffer.toString('base64');

      handleSuccess({
        filename: path.basename(pdfPath),
        contentType: 'application/pdf',
        data: base64
      }, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удалить чек
   */
  static async deleteReceipt(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
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
          await fs.unlink(path.resolve(receipt.filePath));
        } catch (error) {
          console.error('Failed to delete PDF file:', error);
        }
      }

      // Delete receipt from database
      await prisma.receipt.delete({
        where: { id: data.id }
      });

      handleSuccess(null, 'Receipt deleted successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получить статистику по чекам
   */
  static async getReceiptStats(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const [
        totalCount,
        matchedCount,
        unmatchedCount,
        totalAmount,
        recentReceipts
      ] = await Promise.all([
        // Total receipts
        prisma.receipt.count(),
        
        // Matched receipts
        prisma.receipt.count({
          where: { transactionId: { not: null } }
        }),
        
        // Unmatched receipts
        prisma.receipt.count({
          where: { transactionId: null }
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

      // Get status breakdown
      const statusBreakdown = await prisma.receipt.groupBy({
        by: ['status'],
        _count: true
      });

      // Get daily stats for last 7 days
      const dailyStats = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', "createdAt") as date,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM "Receipt"
        WHERE "createdAt" >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date DESC
      `;

      handleSuccess({
        summary: {
          total: totalCount,
          matched: matchedCount,
          unmatched: unmatchedCount,
          totalAmount: totalAmount._sum.amount || 0,
          recentCount: recentReceipts
        },
        statusBreakdown: statusBreakdown.map(item => ({
          status: item.status,
          count: item._count
        })),
        dailyStats
      }, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Попытаться сопоставить непривязанные чеки
   */
  static async matchUnmatchedReceipts(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      // Get unmatched receipts
      const unmatchedReceipts = await prisma.receipt.findMany({
        where: { transactionId: null }
      });

      let matchedCount = 0;

      for (const receipt of unmatchedReceipts) {
        // Try to find matching payout by amount and wallet
        const matchingPayout = await prisma.payout.findFirst({
          where: {
            status: 5,
            wallet: receipt.recipientPhone || receipt.recipientCard,
            amount: {
              gte: receipt.amount - 10, // Allow 10 RUB tolerance
              lte: receipt.amount + 10
            }
          }
        });

        if (matchingPayout) {
          // Find or create transaction
          let transaction = await prisma.transaction.findUnique({
            where: { payoutId: matchingPayout.id }
          });

          if (!transaction) {
            // Find active advertisement
            const advertisement = await prisma.advertisement.findFirst({
              where: { isActive: true }
            });

            if (advertisement) {
              transaction = await prisma.transaction.create({
                data: {
                  payoutId: matchingPayout.id,
                  advertisementId: advertisement.id,
                  amount: receipt.amount,
                  status: 'payment_received',
                  checkReceivedAt: new Date()
                }
              });
            }
          }

          if (transaction) {
            // Update receipt
            await prisma.receipt.update({
              where: { id: receipt.id },
              data: { transactionId: transaction.id }
            });

            matchedCount++;
          }
        }
      }

      handleSuccess({
        unmatchedTotal: unmatchedReceipts.length,
        matchedCount,
        remainingUnmatched: unmatchedReceipts.length - matchedCount
      }, `Matched ${matchedCount} receipts`, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }
}