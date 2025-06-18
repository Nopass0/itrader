/**
 * Check Verification Service
 * Handles PDF check verification from Gmail
 */

import { db, type Transaction } from '../db';
import { GmailClient } from '../gmail';
import { ReceiptProcessor } from '../ocr/processor';
import { GateClient } from '../gate/client';
import { RateLimiter } from '../gate/utils/rateLimiter';
import { ChatAutomationService } from './chatAutomation';
import { createLogger } from '../logger';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger('CheckVerification');

interface CheckData {
  status: string;
  amount: number;
  bankName?: string;
  cardNumber?: string;
  phoneNumber?: string;
  date: Date;
}

export class CheckVerificationService {
  public gmailClient: GmailClient | null;
  private ocrProcessor: ReceiptProcessor;
  private chatService: ChatAutomationService;
  private rateLimiter: RateLimiter;
  
  constructor(
    gmailClient: GmailClient | null,
    chatService: ChatAutomationService
  ) {
    this.gmailClient = gmailClient;
    this.ocrProcessor = new ReceiptProcessor();
    this.chatService = chatService;
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Process new checks from Gmail
   */
  async processNewChecks(): Promise<void> {
    if (!this.gmailClient) {
      logger.info('Gmail client not initialized');
      return;
    }

    const gmailAccount = await db.getActiveGmailAccount();
    if (!gmailAccount) {
      logger.info('No active Gmail account');
      return;
    }

    // Get transactions waiting for payment
    const waitingTransactions = await db.client.transaction.findMany({
      where: {
        status: 'waiting_payment',
        paymentSentAt: { not: null },
      },
      include: {
        payout: true,
        advertisement: true,
      },
    });

    if (waitingTransactions.length === 0) {
      return;
    }

    logger.info(`Checking for new checks, ${waitingTransactions.length} transactions waiting`);

    // Get emails from Tinkoff from the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const searchResult = await this.gmailClient.getEmailsFromSender(
      'noreply@tinkoff.ru',
      {
        after: thirtyMinutesAgo,
        maxResults: 20
      }
    );
    
    const emails = searchResult.emails;

    for (const email of emails) {
      // Skip if no attachments
      if (!email.attachments || email.attachments.length === 0) continue;

      // Find PDF attachments
      const pdfAttachments = email.attachments.filter(
        att => att.mimeType === 'application/pdf'
      );

      for (const attachment of pdfAttachments) {
        try {
          await this.processCheckAttachment(
            email.id!,
            attachment,
            email.date!,
            waitingTransactions
          );
        } catch (error) {
          logger.error('Error processing attachment:', error);
        }
      }
    }
  }

  /**
   * Process a single check attachment
   */
  private async processCheckAttachment(
    emailId: string,
    attachment: any,
    emailDate: Date,
    waitingTransactions: any[]
  ): Promise<void> {
    // Download attachment
    if (!this.gmailClient) {
      logger.error('Gmail client not available');
      return;
    }
    
    const fullAttachment = await this.gmailClient.downloadAttachment(
      emailId,
      attachment.id
    );
    
    if (!fullAttachment.data) {
      logger.error('No attachment data received');
      return;
    }
    
    const attachmentData = fullAttachment.data;

    if (!attachmentData) {
      logger.error('Failed to download attachment');
      return;
    }

    // Save temporarily
    const tempPath = path.join('data', 'temp', `check_${Date.now()}.pdf`);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, Buffer.from(attachmentData, 'base64'));

    try {
      // Process PDF
      const checkData = await this.extractCheckData(tempPath);
      
      if (!checkData || checkData.status !== 'успешно') {
        logger.info('Check status is not successful, skipping');
        return;
      }

      // Find matching transaction
      const matchingTransaction = this.findMatchingTransaction(
        checkData,
        emailDate,
        waitingTransactions
      );

      if (matchingTransaction) {
        await this.processMatchingTransaction(
          matchingTransaction,
          checkData,
          tempPath
        );
      } else {
        logger.info('No matching transaction found for check');
      }
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract check data from PDF
   */
  private async extractCheckData(pdfPath: string): Promise<CheckData | null> {
    try {
      // Read PDF file
      const pdfData = await fs.readFile(pdfPath);
      // Use a dummy expected amount for now (will be matched later)
      const { Decimal } = await import('decimal.js');
      const dummyAmount = new Decimal(0);
      const result = await this.ocrProcessor.processReceipt(pdfData, dummyAmount);
      
      // The processReceipt returns ReceiptData directly
      return {
        status: result.status || '',
        amount: result.amount.toNumber(), // Convert Decimal to number
        bankName: result.bank,
        cardNumber: result.cardNumber,
        phoneNumber: result.phone,
        date: result.timestamp,
      };
    } catch (error) {
      logger.error('Error extracting check data:', error);
      return null;
    }
  }

  /**
   * Find matching transaction for check
   */
  private findMatchingTransaction(
    checkData: CheckData,
    emailDate: Date,
    transactions: any[]
  ): any | null {
    for (const transaction of transactions) {
      // Check if email came after payment details were sent
      if (emailDate < new Date(transaction.paymentSentAt)) {
        continue;
      }

      const payout = transaction.payout;
      const expectedAmount = payout.totalTrader['643'] || 0;
      
      // Check amount (allow small difference due to fees)
      const amountDiff = Math.abs(checkData.amount - expectedAmount);
      if (amountDiff > 10) { // Allow 10 RUB difference
        continue;
      }

      // Check bank name
      if (checkData.bankName && payout.bank?.name) {
        const bankWords = payout.bank.name.toLowerCase().split(/\s+/);
        const checkBankWords = checkData.bankName.toLowerCase().split(/\s+/);
        
        // At least one word should match
        const hasMatchingWord = bankWords.some(word => 
          checkBankWords.includes(word)
        );
        
        if (!hasMatchingWord) {
          continue;
        }
      }

      // Check wallet (card or phone)
      const wallet = payout.wallet;
      
      if (checkData.cardNumber) {
        // Compare last 4 digits
        const walletLast4 = wallet.slice(-4);
        const checkLast4 = checkData.cardNumber.slice(-4);
        
        if (walletLast4 === checkLast4) {
          return transaction;
        }
      }
      
      if (checkData.phoneNumber) {
        // Normalize phone numbers
        const normalizedWallet = wallet.replace(/\D/g, '');
        const normalizedCheck = checkData.phoneNumber.replace(/\D/g, '');
        
        if (normalizedWallet.includes(normalizedCheck) || 
            normalizedCheck.includes(normalizedWallet)) {
          return transaction;
        }
      }
    }

    return null;
  }

  /**
   * Process matching transaction
   */
  private async processMatchingTransaction(
    transaction: any,
    checkData: CheckData,
    checkPath: string
  ): Promise<void> {
    logger.info(`Found matching transaction ${transaction.id}`);

    // Update transaction status
    await db.updateTransaction(transaction.id, {
      status: 'payment_received',
      checkReceivedAt: new Date(),
    });

    // Approve on Gate with check
    const gateAccounts = await db.getActiveGateAccounts();
    const gateAccount = gateAccounts.find(
      acc => acc.accountId === transaction.payout.gateAccount
    );

    if (gateAccount) {
      try {
        const gateClient = new GateClient(this.rateLimiter);
        await gateClient.loadCookies(`data/cookies/${gateAccount.accountId}.json`);
        
        await gateClient.approveTransactionWithReceipt(
          transaction.payout.gatePayoutId.toString(),
          checkPath
        );

        logger.info('Approved transaction on Gate');
      } catch (error) {
        logger.error('Failed to approve on Gate:', error);
      }
    }

    // Send final message to chat
    await this.chatService.sendFinalMessage(transaction.id);
  }
}