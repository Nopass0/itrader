/**
 * Контроллер для работы с письмами MailSlurp
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';

const logger = createLogger('EmailController');

export class EmailController {
  /**
   * Получение списка писем из всех MailSlurp аккаунтов
   */
  static async list(
    socket: AuthenticatedSocket,
    data: { 
      limit?: number;
      search?: string;
      inboxId?: string;
    },
    callback: Function
  ) {
    try {
      logger.info('EmailController.list called', { 
        limit: data.limit,
        search: data.search,
        inboxId: data.inboxId,
        socketId: socket.id
      });

      // Получаем MailSlurp сервис
      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      logger.info('MailSlurp service status', { 
        hasService: !!mailSlurpService,
        type: typeof mailSlurpService,
        hasGetAllEmails: mailSlurpService ? typeof mailSlurpService.getAllEmails === 'function' : false,
        fromContext: !!appContext?.mailslurpService
      });
      
      if (!mailSlurpService) {
        logger.error('MailSlurp service not initialized');
        // Return empty list instead of throwing error
        handleSuccess({
          emails: [],
          total: 0,
          warning: 'MailSlurp service not initialized. Please check if MAILSLURP_API_KEY is configured.'
        }, 'No emails available', callback);
        return;
      }

      // Check if service has inboxes and initialize if needed
      let inboxes = mailSlurpService.getInboxes();
      logger.info('MailSlurp inboxes status before init', {
        inboxCount: inboxes?.length || 0,
        inboxes: inboxes?.map(i => ({ id: i.id, email: i.emailAddress }))
      });

      // If no inboxes, try to initialize the service
      if (!inboxes || inboxes.length === 0) {
        logger.info('No inboxes found, attempting to initialize MailSlurp...');
        try {
          await mailSlurpService.initialize();
          inboxes = mailSlurpService.getInboxes();
          logger.info('MailSlurp initialized, inboxes after init', {
            inboxCount: inboxes?.length || 0,
            inboxes: inboxes?.map(i => ({ id: i.id, email: i.emailAddress }))
          });
        } catch (initError) {
          logger.error('Failed to initialize MailSlurp during email list', initError);
        }
      }

      logger.info('Calling getAllEmails...', {
        params: {
          limit: data.limit || 100,
          search: data.search,
          inboxId: data.inboxId
        }
      });
      
      // Получаем все письма
      console.log('[EmailController] Calling getAllEmails with params:', {
        limit: data.limit || 100,
        search: data.search,
        inboxId: data.inboxId
      });
      
      const emails = await mailSlurpService.getAllEmails({
        limit: data.limit || 100,
        search: data.search,
        inboxId: data.inboxId
      });
      
      console.log('[EmailController] getAllEmails returned:', {
        count: emails?.length || 0,
        type: typeof emails,
        isArray: Array.isArray(emails),
        sample: emails?.[0]
      });

      logger.info('Got emails from MailSlurp', { 
        emailCount: emails?.length || 0,
        firstEmail: emails?.[0] ? {
          id: emails[0].id,
          subject: emails[0].subject,
          from: emails[0].from
        } : null,
        hasEmails: Array.isArray(emails),
        emailsType: typeof emails
        firstEmail: emails?.length > 0 ? {
          id: emails[0].id,
          subject: emails[0].subject,
          from: emails[0].from
        } : null
      });

      handleSuccess({
        emails: emails || [],
        total: emails?.length || 0
      }, 'Emails loaded successfully', callback);

    } catch (error) {
      logger.error('Error getting emails', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Получение подробной информации о письме
   */
  static async get(
    socket: AuthenticatedSocket,
    data: { 
      emailId: string;
      inboxId: string;
    },
    callback: Function
  ) {
    try {
      logger.info('Getting email details', { 
        emailId: data.emailId,
        inboxId: data.inboxId
      });

      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      if (!mailSlurpService) {
        throw new Error('MailSlurp service not initialized');
      }

      const email = await mailSlurpService.getEmail(data.inboxId, data.emailId);

      handleSuccess(email, 'Email details loaded', callback);

    } catch (error) {
      logger.error('Error getting email details', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Скачивание вложения
   */
  static async downloadAttachment(
    socket: AuthenticatedSocket,
    data: { 
      emailId: string;
      attachmentId: string;
      inboxId?: string;
    },
    callback: Function
  ) {
    try {
      logger.info('Downloading email attachment', { 
        emailId: data.emailId,
        attachmentId: data.attachmentId
      });

      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      if (!mailSlurpService) {
        throw new Error('MailSlurp service not initialized');
      }

      const downloadData = await mailSlurpService.downloadAttachment(
        data.emailId, 
        data.attachmentId
      );

      handleSuccess({
        downloadUrl: downloadData.downloadUrl,
        fileName: downloadData.fileName,
        contentType: downloadData.contentType,
        size: downloadData.size
      }, 'Attachment download prepared', callback);

    } catch (error) {
      logger.error('Error downloading attachment', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Отметка письма как прочитанного
   */
  static async markAsRead(
    socket: AuthenticatedSocket,
    data: { 
      emailId: string;
      inboxId: string;
    },
    callback: Function
  ) {
    try {
      logger.info('Marking email as read', { 
        emailId: data.emailId,
        inboxId: data.inboxId
      });

      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      if (!mailSlurpService) {
        throw new Error('MailSlurp service not initialized');
      }

      await mailSlurpService.markEmailAsRead(data.inboxId, data.emailId);

      handleSuccess({}, 'Email marked as read', callback);

    } catch (error) {
      logger.error('Error marking email as read', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики по письмам
   */
  static async getStats(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('Getting email statistics');

      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      if (!mailSlurpService) {
        throw new Error('MailSlurp service not initialized');
      }

      const stats = await mailSlurpService.getEmailStats();

      handleSuccess(stats, 'Email statistics loaded', callback);

    } catch (error) {
      logger.error('Error getting email statistics', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Получение списка инбоксов
   */
  static async getInboxes(
    socket: AuthenticatedSocket,
    data: {},
    callback: Function
  ) {
    try {
      logger.info('Getting MailSlurp inboxes');

      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      if (!mailSlurpService) {
        throw new Error('MailSlurp service not initialized');
      }

      // Check if service has inboxes and initialize if needed
      let inboxes = mailSlurpService.getInboxes();
      
      // If no inboxes, try to initialize the service
      if (!inboxes || inboxes.length === 0) {
        logger.info('No inboxes found in getInboxes, attempting to initialize MailSlurp...');
        try {
          await mailSlurpService.initialize();
          inboxes = mailSlurpService.getInboxes();
          logger.info('MailSlurp initialized in getInboxes', {
            inboxCount: inboxes?.length || 0
          });
        } catch (initError) {
          logger.error('Failed to initialize MailSlurp during getInboxes', initError);
        }
      }

      handleSuccess({
        inboxes: inboxes || [],
        total: inboxes?.length || 0
      }, 'Inboxes loaded successfully', callback);

    } catch (error) {
      logger.error('Error getting inboxes', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Send test email (for debugging)
   */
  static async sendTestEmail(
    socket: AuthenticatedSocket,
    data: { inboxId?: string },
    callback: Function
  ) {
    try {
      logger.info('Sending test email', { inboxId: data.inboxId });

      const { getMailSlurpService } = require('../../services/mailslurpService');
      
      // Try to get from app context first
      const appContext = (global as any).appContext;
      let mailSlurpService = appContext?.mailslurpService;
      
      // If not in context, try to get singleton
      if (!mailSlurpService) {
        mailSlurpService = await getMailSlurpService();
      }
      
      if (!mailSlurpService) {
        throw new Error('MailSlurp service not initialized');
      }

      // Check inboxes before sending
      const inboxes = mailSlurpService.getInboxes();
      if (!inboxes || inboxes.length === 0) {
        throw new Error('No inboxes available to send test email');
      }

      await mailSlurpService.sendTestEmail(data.inboxId);

      handleSuccess({
        message: 'Test email sent successfully',
        inboxCount: inboxes.length,
        sentTo: inboxes[0].emailAddress
      }, 'Test email sent successfully', callback);

    } catch (error) {
      logger.error('Error sending test email', error as Error);
      handleError(error, callback);
    }
  }
}