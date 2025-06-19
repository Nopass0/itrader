import { MailSlurpService } from './mailslurpService';
import { PrismaClient } from '../../generated/prisma';
import { createLogger } from '../logger';

const logger = createLogger('EnhancedMailSlurp');
const prisma = new PrismaClient();

export class EnhancedMailslurpService {
  private mailslurpService: MailSlurpService;
  
  constructor(mailslurpService: MailSlurpService) {
    this.mailslurpService = mailslurpService;
  }
  
  /**
   * Ensure we have multiple receipt emails created
   */
  async ensureMultipleEmails() {
    const desiredCount = 6;
    const currentEmails = this.mailslurpService.getEmailAddresses();
    const existingCount = currentEmails.length;
    
    if (existingCount >= desiredCount) {
      logger.info(`Already have ${existingCount} emails`);
      return;
    }
    
    logger.info(`Creating ${desiredCount - existingCount} more emails...`);
    
    for (let i = existingCount + 1; i <= desiredCount; i++) {
      try {
        const emailName = `receipts_itrader${i}`;
        const email = await this.mailslurpService.addInbox(emailName);
        
        logger.info(`Created email: ${email} (${emailName})`);
        
      } catch (error) {
        logger.error(`Failed to create email ${i}`, error);
      }
    }
  }
  
  /**
   * Get appropriate email for transaction
   * Ensures no duplicate transactions on same email
   */
  async getEmailForTransaction(amount: number, wallet: string, bankName: string): Promise<string> {
    // Parse bank name from JSON if needed
    let parsedBankName = bankName;
    try {
      const bankData = JSON.parse(bankName);
      parsedBankName = bankData.name || bankData.label || bankName;
    } catch (e) {
      // bankName is already a string
    }
    
    // Find active transactions with same parameters
    const activeTransactions = await prisma.transaction.findMany({
      where: {
        status: {
          in: ['pending', 'chat_started', 'waiting_payment']
        }
      },
      include: {
        payout: true
      }
    });
    
    // Filter by amount, wallet, and bank
    const matchingTransactions = activeTransactions.filter(tx => {
      if (!tx.payout) return false;
      
      // Check wallet
      if (tx.payout.wallet !== wallet) return false;
      
      // Check bank
      try {
        const bankData = typeof tx.payout.bank === 'string' ? JSON.parse(tx.payout.bank) : tx.payout.bank;
        const payoutBankName = bankData.name || bankData.label || '';
        if (!payoutBankName.toLowerCase().includes(parsedBankName.toLowerCase()) && 
            !payoutBankName.toLowerCase().includes(bankName.toLowerCase())) {
          return false;
        }
      } catch (e) {
        return false;
      }
      
      // Check amount
      try {
        const amountData = JSON.parse(tx.payout.amountTrader);
        return amountData['643'] === amount;
      } catch (e) {
        return false;
      }
    });
    
    // Get used emails from active transactions
    const usedEmails = new Set<string>();
    for (const tx of matchingTransactions) {
      if (tx.payout && tx.payout.meta && typeof tx.payout.meta === 'object' && 'receiptEmail' in tx.payout.meta) {
        usedEmails.add((tx.payout.meta as any).receiptEmail);
      }
    }
    
    const availableEmails = this.mailslurpService.getEmailAddresses();
    
    // Check if we have any emails available
    if (availableEmails.length === 0) {
      logger.error('No MailSlurp emails available!');
      throw new Error('No MailSlurp emails available for receipt');
    }
    
    // Find first unused email
    for (const email of availableEmails) {
      if (!usedEmails.has(email)) {
        logger.info('Selected email for transaction', {
          email,
          amount,
          wallet,
          bankName: parsedBankName,
          usedEmails: Array.from(usedEmails)
        });
        return email;
      }
    }
    
    // If all emails are used, use the one with least active transactions
    const emailUsageCount = new Map<string, number>();
    availableEmails.forEach(email => emailUsageCount.set(email, 0));
    
    for (const tx of matchingTransactions) {
      if (tx.payout && tx.payout.meta && typeof tx.payout.meta === 'object' && 'receiptEmail' in tx.payout.meta) {
        const email = (tx.payout.meta as any).receiptEmail;
        if (emailUsageCount.has(email)) {
          emailUsageCount.set(email, emailUsageCount.get(email)! + 1);
        }
      }
    }
    
    // Sort by usage count and return least used
    const sortedEmails = Array.from(emailUsageCount.entries())
      .sort((a, b) => a[1] - b[1]);
    
    if (sortedEmails.length === 0) {
      logger.error('No emails in usage count map!');
      throw new Error('No MailSlurp emails available');
    }
    
    const selectedEmail = sortedEmails[0][0];
    
    logger.warn('All emails have similar transactions, using least used', {
      selectedEmail,
      amount,
      wallet,
      bankName: parsedBankName,
      emailUsage: Object.fromEntries(emailUsageCount)
    });
    
    return selectedEmail;
  }
}

// Export helper functions
export async function ensureMultipleMailslurpEmails(mailslurpService: MailSlurpService) {
  const enhanced = new EnhancedMailslurpService(mailslurpService);
  await enhanced.ensureMultipleEmails();
}

export async function getReceiptEmailForTransaction(
  mailslurpService: MailSlurpService,
  amount: number,
  wallet: string,
  bankName: string
): Promise<string> {
  const enhanced = new EnhancedMailslurpService(mailslurpService);
  return enhanced.getEmailForTransaction(amount, wallet, bankName);
}