import { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();
const logger = createLogger('MailSlurpController');

export class MailSlurpController {
  /**
   * List all MailSlurp accounts
   */
  static async listAccounts(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      const accounts = await prisma.mailSlurpAccount.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const formattedAccounts = accounts.map(account => ({
        id: account.id,
        email: account.email,
        inboxId: account.inboxId,
        isActive: account.isActive,
        createdAt: account.createdAt,
        lastUsed: account.lastUsed
      }));

      handleSuccess({ data: formattedAccounts }, 'MailSlurp accounts retrieved', callback);
    } catch (error) {
      logger.error('Error listing MailSlurp accounts', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Create new MailSlurp account
   */
  static async createAccount(
    socket: AuthenticatedSocket,
    data: { email: string; inboxId: string },
    callback: Function
  ) {
    try {
      // Validate input
      if (!data.email || !data.inboxId) {
        throw new Error('Email and Inbox ID are required');
      }

      // Check if account already exists
      const existing = await prisma.mailSlurpAccount.findFirst({
        where: {
          OR: [
            { email: data.email },
            { inboxId: data.inboxId }
          ]
        }
      });

      if (existing) {
        throw new Error('Account with this email or inbox ID already exists');
      }

      // If this is the first account, make it active
      const accountCount = await prisma.mailSlurpAccount.count();
      const isFirstAccount = accountCount === 0;

      // Create account
      const account = await prisma.mailSlurpAccount.create({
        data: {
          email: data.email,
          inboxId: data.inboxId,
          isActive: isFirstAccount
        }
      });

      logger.info('MailSlurp account created', { 
        email: data.email,
        isActive: account.isActive 
      });

      handleSuccess({ data: account }, 'MailSlurp account created successfully', callback);
    } catch (error) {
      logger.error('Error creating MailSlurp account', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Delete MailSlurp account
   */
  static async deleteAccount(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Check if account exists
      const account = await prisma.mailSlurpAccount.findUnique({
        where: { id: data.id }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Don't allow deleting active account
      if (account.isActive) {
        throw new Error('Cannot delete active account. Please set another account as active first.');
      }

      // Delete account
      await prisma.mailSlurpAccount.delete({
        where: { id: data.id }
      });

      logger.info('MailSlurp account deleted', { id: data.id });

      handleSuccess({}, 'MailSlurp account deleted successfully', callback);
    } catch (error) {
      logger.error('Error deleting MailSlurp account', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Set account as active
   */
  static async setActive(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Check if account exists
      const account = await prisma.mailSlurpAccount.findUnique({
        where: { id: data.id }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Deactivate all other accounts
      await prisma.mailSlurpAccount.updateMany({
        where: { id: { not: data.id } },
        data: { isActive: false }
      });

      // Activate this account
      const updatedAccount = await prisma.mailSlurpAccount.update({
        where: { id: data.id },
        data: { isActive: true }
      });

      logger.info('MailSlurp account set as active', { 
        email: updatedAccount.email 
      });

      // Update environment configuration
      process.env.MAILSLURP_EMAIL = updatedAccount.email;
      process.env.MAILSLURP_INBOX_ID = updatedAccount.inboxId;

      handleSuccess({ data: updatedAccount }, 'MailSlurp account activated successfully', callback);
    } catch (error) {
      logger.error('Error setting active MailSlurp account', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Sync all available MailSlurp inboxes from API
   */
  static async syncInboxes(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      const apiKey = process.env.MAILSLURP_API_KEY;
      if (!apiKey) {
        throw new Error('MAILSLURP_API_KEY not configured');
      }

      // Import MailSlurp client
      const { MailSlurp } = require('mailslurp-client');
      const mailslurp = new MailSlurp({ apiKey });

      // Get all inboxes from MailSlurp API
      const inboxes = await mailslurp.inboxController.getAllInboxes({
        page: 0,
        size: 100
      });

      logger.info(`Found ${inboxes.content?.length || 0} inboxes from MailSlurp API`);

      let syncedCount = 0;
      let updatedCount = 0;

      if (inboxes.content && inboxes.content.length > 0) {
        for (const inbox of inboxes.content) {
          if (!inbox.emailAddress || !inbox.id) continue;

          // Check if this inbox already exists
          const existing = await prisma.mailSlurpAccount.findFirst({
            where: {
              OR: [
                { email: inbox.emailAddress },
                { inboxId: inbox.id }
              ]
            }
          });

          if (existing) {
            // Update existing record
            await prisma.mailSlurpAccount.update({
              where: { id: existing.id },
              data: {
                email: inbox.emailAddress,
                inboxId: inbox.id,
                lastUsed: new Date()
              }
            });
            updatedCount++;
            logger.info('Updated existing MailSlurp account', { 
              email: inbox.emailAddress,
              inboxId: inbox.id 
            });
          } else {
            // Create new record
            const accountCount = await prisma.mailSlurpAccount.count();
            const isFirstAccount = accountCount === 0;

            await prisma.mailSlurpAccount.create({
              data: {
                email: inbox.emailAddress,
                inboxId: inbox.id,
                isActive: isFirstAccount // First account becomes active
              }
            });
            syncedCount++;
            logger.info('Added new MailSlurp account', { 
              email: inbox.emailAddress,
              inboxId: inbox.id,
              isActive: isFirstAccount 
            });
          }
        }
      }

      logger.info('MailSlurp sync completed', { 
        total: inboxes.content?.length || 0,
        synced: syncedCount,
        updated: updatedCount 
      });

      handleSuccess({ 
        synced: syncedCount,
        updated: updatedCount,
        total: inboxes.content?.length || 0
      }, `Synced ${syncedCount} new accounts, updated ${updatedCount} existing`, callback);
    } catch (error) {
      logger.error('Error syncing MailSlurp inboxes', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Get active MailSlurp account
   */
  static async getActiveAccount(): Promise<{ email: string; inboxId: string } | null> {
    try {
      const activeAccount = await prisma.mailSlurpAccount.findFirst({
        where: { isActive: true }
      });

      if (activeAccount) {
        return {
          email: activeAccount.email,
          inboxId: activeAccount.inboxId
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting active MailSlurp account', error as Error);
      return null;
    }
  }
}