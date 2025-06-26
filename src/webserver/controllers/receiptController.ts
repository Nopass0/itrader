/**
 * Контроллер управления чеками
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createLogger } from '../../logger';

const logger = createLogger('ReceiptController');
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
   * Получить чек по payoutId
   */
  static async getByPayoutId(
    socket: AuthenticatedSocket,
    data: { payoutId: string },
    callback: Function
  ) {
    try {
      const receipt = await prisma.receipt.findFirst({
        where: { payoutId: data.payoutId }
      });

      if (!receipt) {
        handleSuccess(null, 'No receipt found', callback);
        return;
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

  /**
   * Upload and parse receipt manually
   */
  static async uploadManual(
    socket: AuthenticatedSocket,
    data: {
      payoutId: string;
      transactionId: string;
      fileData: string;
      fileName: string;
      mimeType: string;
    },
    callback: Function
  ) {
    try {
      logger.info('Manual receipt upload requested', {
        payoutId: data.payoutId,
        transactionId: data.transactionId,
        fileName: data.fileName
      });

      // Validate inputs
      if (!data.fileData || !data.fileName || data.mimeType !== 'application/pdf') {
        throw new Error('Invalid file data or type');
      }

      // Get transaction and payout details
      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: {
          payout: true
        }
      });

      if (!transaction || !transaction.payout) {
        throw new Error('Transaction or payout not found');
      }

      if (transaction.payout.id !== data.payoutId) {
        throw new Error('Payout ID mismatch');
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(data.fileData, 'base64');
      
      // Generate file hash
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      // Check if receipt already exists
      const existingReceipt = await prisma.receipt.findFirst({
        where: {
          OR: [
            { transactionId: data.transactionId },
            { payoutId: data.payoutId }
          ]
        }
      });

      if (existingReceipt) {
        throw new Error('Receipt already exists for this transaction');
      }

      // Create receipts directory if not exists
      const receiptsDir = path.join(process.cwd(), 'data', 'receipts', 'manual');
      await fs.mkdir(receiptsDir, { recursive: true });

      // Save file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `manual_${timestamp}_${data.fileName}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filepath = path.join(receiptsDir, filename);
      await fs.writeFile(filepath, buffer);

      logger.info('Receipt file saved', { filepath, size: buffer.length });

      // Parse PDF using OCR
      let parsedData: any = {};
      try {
        const { TinkoffReceiptParser } = await import('../../ocr');
        const parser = new TinkoffReceiptParser();
        parsedData = await parser.parseReceiptPDF(filepath);
        
        logger.info('Receipt parsed successfully', {
          amount: parsedData.amount,
          senderName: parsedData.senderName,
          recipientCard: parsedData.recipientCard
        });
      } catch (parseError) {
        logger.error('Failed to parse receipt', parseError);
        parsedData = {
          error: 'Failed to parse PDF',
          rawText: ''
        };
      }

      // Return parsed data for confirmation
      handleSuccess({
        parsedData: {
          amount: parsedData.amount,
          senderName: parsedData.senderName,
          recipientName: parsedData.recipientName,
          recipientCard: parsedData.recipientCard,
          transactionDate: parsedData.transactionDate,
          rawText: parsedData.rawText
        },
        tempFilePath: filepath,
        fileHash
      }, 'Receipt uploaded and parsed', callback);

    } catch (error) {
      logger.error('Error uploading manual receipt', error);
      handleError(error, callback);
    }
  }

  /**
   * Confirm and save manually uploaded receipt
   */
  static async confirmManual(
    socket: AuthenticatedSocket,
    data: {
      payoutId: string;
      transactionId: string;
      parsedData: any;
    },
    callback: Function
  ) {
    try {
      logger.info('Confirming manual receipt', {
        payoutId: data.payoutId,
        transactionId: data.transactionId
      });

      // Get transaction and payout
      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: {
          payout: true
        }
      });

      if (!transaction || !transaction.payout) {
        throw new Error('Transaction or payout not found');
      }

      // Create receipt record
      const receipt = await prisma.receipt.create({
        data: {
          emailId: `manual_${Date.now()}_${data.transactionId}`,
          filename: `manual_receipt_${data.transactionId}.pdf`,
          filePath: `data/receipts/manual/confirmed_${data.transactionId}.pdf`,
          emailFrom: 'manual@upload.local',
          emailSubject: `Ручная загрузка чека для транзакции ${data.transactionId}`,
          receivedAt: new Date(),
          isProcessed: true,
          amount: data.parsedData.amount || transaction.amount,
          senderName: data.parsedData.senderName,
          recipientName: data.parsedData.recipientName,
          recipientCard: data.parsedData.recipientCard,
          recipientPhone: transaction.payout.wallet,
          transactionDate: data.parsedData.transactionDate ? new Date(data.parsedData.transactionDate) : new Date(),
          status: 'matched',
          parsedData: data.parsedData,
          rawText: data.parsedData.rawText || '',
          rawEmailData: {
            source: 'manual_upload',
            uploadedBy: socket.userId,
            uploadedAt: new Date()
          },
          transactionId: data.transactionId,
          payoutId: data.payoutId
        }
      });

      logger.info('Receipt created', { receiptId: receipt.id });

      // Update transaction status if needed
      if (transaction.status === 'waiting_payment' || transaction.status === 'payment_sent') {
        await prisma.transaction.update({
          where: { id: data.transactionId },
          data: {
            status: 'payment_received',
            checkReceivedAt: new Date()
          }
        });

        logger.info('Transaction status updated to payment_received');
      }

      // Emit receipt update
      socket.to('receipts:updates').emit('receipt:created', receipt);

      handleSuccess({
        receiptId: receipt.id,
        receipt
      }, 'Receipt confirmed and saved', callback);

    } catch (error) {
      logger.error('Error confirming manual receipt', error);
      handleError(error, callback);
    }
  }
}