/**
 * Bad Receipt Service
 * Handles non-T-Bank receipts and other invalid receipts
 */

import { db } from '../db';
import { createLogger } from '../logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const logger = createLogger('BadReceiptService');

export class BadReceiptService {
  private readonly storagePath: string;

  constructor(storagePath: string = 'data/bad-receipts') {
    this.storagePath = storagePath;
    this.ensureStorageExists();
  }

  private async ensureStorageExists() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      logger.info('Bad receipts storage directory ensured', { path: this.storagePath });
    } catch (error) {
      logger.error('Failed to create bad receipts storage directory', error);
    }
  }

  /**
   * Process an email that contains a non-T-Bank receipt
   */
  async processNonTBankReceipt(email: any, attachment?: any): Promise<any> {
    try {
      logger.info('Processing non-T-Bank receipt', {
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        hasAttachment: !!attachment
      });

      // Calculate file hash if attachment exists
      let fileHash: string | undefined;
      let filePath: string | undefined;
      let rawText: string | undefined;

      if (attachment && attachment.content) {
        // Generate hash from content
        fileHash = crypto.createHash('sha256')
          .update(attachment.content)
          .digest('hex');

        // Check if already processed
        const existing = await db.prisma.badReceipt.findUnique({
          where: { fileHash }
        });

        if (existing) {
          logger.info('Bad receipt already processed', { 
            emailId: email.id,
            fileHash 
          });
          return existing;
        }

        // Save attachment to disk
        const filename = `${email.id}_${attachment.name || 'attachment'}`;
        filePath = path.join(this.storagePath, filename);
        
        // Convert base64 to buffer if needed
        const buffer = Buffer.isBuffer(attachment.content) 
          ? attachment.content 
          : Buffer.from(attachment.content, 'base64');
          
        await fs.writeFile(filePath, buffer);
        logger.info('Saved bad receipt file', { filePath });

        // Try to extract text from PDF
        if (attachment.contentType?.includes('pdf')) {
          try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdfParse(dataBuffer);
            rawText = pdfData.text;
          } catch (error) {
            logger.warn('Failed to parse PDF text', error);
          }
        }
      }

      // Determine reason why it's a bad receipt
      let reason = 'Not from T-Bank';
      if (email.from && !email.from.includes('tinkoff')) {
        reason = `Not from T-Bank (from: ${email.from})`;
      }

      // Try to extract amount from subject or body
      let amount: number | undefined;
      const amountMatch = (email.subject || '').match(/(\d+(?:\.\d+)?)\s*(?:руб|RUB)/i) ||
                         (email.body || '').match(/(\d+(?:\.\d+)?)\s*(?:руб|RUB)/i);
      if (amountMatch) {
        amount = parseFloat(amountMatch[1]);
      }

      // Check if already exists by emailId
      const existingByEmailId = await db.prisma.badReceipt.findUnique({
        where: { emailId: email.id }
      });

      if (existingByEmailId) {
        logger.info('Bad receipt already exists for this email', { 
          emailId: email.id,
          badReceiptId: existingByEmailId.id
        });
        return existingByEmailId;
      }

      // Create bad receipt record
      let badReceipt;
      try {
        badReceipt = await db.prisma.badReceipt.create({
          data: {
            emailId: email.id,
            emailFrom: email.from || 'unknown',
            emailSubject: email.subject,
            attachmentName: attachment?.name,
            filePath,
            fileHash,
            amount,
            rawText,
            rawEmailData: email,
            reason,
            receivedAt: email.createdAt ? new Date(email.createdAt) : new Date(),
            processed: true
          }
        });
      } catch (error: any) {
        // Handle unique constraint violation
        if (error.code === 'P2002') {
          logger.warn('Bad receipt already exists (race condition)', { 
            emailId: email.id,
            error: error.message
          });
          // Try to fetch the existing record
          const existing = await db.prisma.badReceipt.findUnique({
            where: { emailId: email.id }
          });
          if (existing) {
            return existing;
          }
        }
        throw error;
      }

      logger.info('Created bad receipt record', {
        id: badReceipt.id,
        emailId: email.id,
        reason,
        amount
      });

      return badReceipt;
    } catch (error) {
      logger.error('Failed to process bad receipt', error, {
        emailId: email.id
      });
      throw error;
    }
  }

  /**
   * Get all bad receipts with pagination
   */
  async getBadReceipts(params: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc' 
      } = params;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { emailFrom: { contains: search, mode: 'insensitive' } },
          { emailSubject: { contains: search, mode: 'insensitive' } },
          { reason: { contains: search, mode: 'insensitive' } },
          { attachmentName: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Get total count
      const total = await db.prisma.badReceipt.count({ where });

      // Get bad receipts
      const badReceipts = await db.prisma.badReceipt.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder }
      });

      return {
        items: badReceipts,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to get bad receipts', error);
      throw error;
    }
  }

  /**
   * Get bad receipt by ID
   */
  async getBadReceiptById(id: string) {
    try {
      const badReceipt = await db.prisma.badReceipt.findUnique({
        where: { id }
      });

      if (!badReceipt) {
        throw new Error('Bad receipt not found');
      }

      return badReceipt;
    } catch (error) {
      logger.error('Failed to get bad receipt by ID', error, { id });
      throw error;
    }
  }

  /**
   * Download bad receipt file
   */
  async downloadBadReceipt(id: string): Promise<{ filePath: string; filename: string }> {
    try {
      const badReceipt = await this.getBadReceiptById(id);
      
      if (!badReceipt.filePath) {
        throw new Error('No file associated with this bad receipt');
      }

      // Check if file exists
      await fs.access(badReceipt.filePath);

      return {
        filePath: badReceipt.filePath,
        filename: badReceipt.attachmentName || path.basename(badReceipt.filePath)
      };
    } catch (error) {
      logger.error('Failed to download bad receipt', error, { id });
      throw error;
    }
  }

  /**
   * Delete bad receipt
   */
  async deleteBadReceipt(id: string) {
    try {
      const badReceipt = await this.getBadReceiptById(id);
      
      // Delete file if exists
      if (badReceipt.filePath) {
        try {
          await fs.unlink(badReceipt.filePath);
          logger.info('Deleted bad receipt file', { filePath: badReceipt.filePath });
        } catch (error) {
          logger.warn('Failed to delete bad receipt file', error);
        }
      }

      // Delete from database
      await db.prisma.badReceipt.delete({
        where: { id }
      });

      logger.info('Deleted bad receipt', { id });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete bad receipt', error, { id });
      throw error;
    }
  }

  /**
   * Get statistics for bad receipts
   */
  async getStatistics() {
    try {
      const total = await db.prisma.badReceipt.count();
      const processed = await db.prisma.badReceipt.count({
        where: { processed: true }
      });
      const unprocessed = total - processed;

      // Group by email sender
      const bySender = await db.prisma.badReceipt.groupBy({
        by: ['emailFrom'],
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 10
      });

      // Group by reason
      const byReason = await db.prisma.badReceipt.groupBy({
        by: ['reason'],
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } }
      });

      // Calculate total amount
      const amountAggregation = await db.prisma.badReceipt.aggregate({
        _sum: { amount: true },
        _avg: { amount: true },
        _count: { amount: true }
      });

      return {
        total,
        processed,
        unprocessed,
        totalAmount: amountAggregation._sum.amount || 0,
        averageAmount: amountAggregation._avg.amount || 0,
        receiptsWithAmount: amountAggregation._count.amount || 0,
        topSenders: bySender.map(s => ({
          sender: s.emailFrom,
          count: s._count._all
        })),
        byReason: byReason.map(r => ({
          reason: r.reason || 'Unknown',
          count: r._count._all
        }))
      };
    } catch (error) {
      logger.error('Failed to get bad receipts statistics', error);
      throw error;
    }
  }
}

// Export singleton instance
let badReceiptService: BadReceiptService | null = null;

export function getBadReceiptService(): BadReceiptService {
  if (!badReceiptService) {
    badReceiptService = new BadReceiptService();
  }
  return badReceiptService;
}