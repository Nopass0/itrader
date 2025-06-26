/**
 * Контроллер для работы с чатом Bybit P2P
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { createLogger } from '../../logger';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();
const logger = createLogger('BybitChatController');

export class BybitChatController {
  /**
   * Получение сообщений чата напрямую из Bybit API
   */
  static async getChatMessages(
    socket: AuthenticatedSocket,
    data: { orderId: string; transactionId?: string },
    callback: Function
  ) {
    try {
      logger.info('Getting chat messages', { orderId: data.orderId });

      // Получаем транзакцию для определения аккаунта
      let bybitAccountId: string | null = null;
      
      if (data.transactionId) {
        const transaction = await prisma.transaction.findUnique({
          where: { id: data.transactionId },
          include: {
            advertisement: {
              include: {
                bybitAccount: true
              }
            }
          }
        });

        if (transaction?.advertisement?.bybitAccount) {
          bybitAccountId = transaction.advertisement.bybitAccount.accountId;
        }
      }

      // Если не нашли по транзакции, пробуем найти по orderId
      if (!bybitAccountId) {
        const transaction = await prisma.transaction.findFirst({
          where: { orderId: data.orderId },
          include: {
            advertisement: {
              include: {
                bybitAccount: true
              }
            }
          }
        });

        if (transaction?.advertisement?.bybitAccount) {
          bybitAccountId = transaction.advertisement.bybitAccount.accountId;
        }
      }

      if (!bybitAccountId) {
        throw new Error('Bybit account not found for this order');
      }

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${bybitAccountId}`);
      }

      // Получаем сообщения из Bybit
      const messagesResponse = await client.getChatMessages(data.orderId, 1, 100);
      logger.info('Raw messages response from Bybit:', { 
        orderId: data.orderId, 
        responseType: typeof messagesResponse,
        isArray: Array.isArray(messagesResponse),
        response: messagesResponse 
      });

      // Извлекаем массив сообщений из ответа
      let messages: any[] = [];
      if (Array.isArray(messagesResponse)) {
        messages = messagesResponse;
      } else if (messagesResponse && typeof messagesResponse === 'object') {
        // Если это объект, попробуем найти массив сообщений
        if (Array.isArray(messagesResponse.messages)) {
          messages = messagesResponse.messages;
        } else if (Array.isArray(messagesResponse.data)) {
          messages = messagesResponse.data;
        } else if (Array.isArray(messagesResponse.result)) {
          messages = messagesResponse.result;
        }
      }

      logger.info('Extracted messages:', { count: messages.length });

      // Получаем детали ордера для определения нашего userId
      const httpClient = (client as any).httpClient;
      const orderInfo = await httpClient.post("/v5/p2p/order/info", {
        orderId: data.orderId
      });
      
      let ourUserId: string | null = null;
      if (orderInfo.retCode === 0 && orderInfo.result) {
        ourUserId = orderInfo.result.userId;
      }

      // Форматируем сообщения
      const formattedMessages = messages.map((msg: any) => {
        // Определяем отправителя
        let sender = 'them';
        if (msg.userId === ourUserId) {
          // Проверяем, является ли это системным сообщением
          if (msg.msgType === 0 || 
              msg.message?.includes("Be careful not to be fooled") ||
              msg.message?.includes("A buyer has submitted an order") ||
              msg.message?.includes("‼️ЧИТАЕМ‼️")) {
            sender = 'system';
          } else {
            sender = 'us';
          }
        } else if (msg.msgType === 0) {
          sender = 'system';
        }

        return {
          id: msg.id,
          messageId: msg.id,
          message: msg.message || '',
          content: msg.message || '',  // Keep for backwards compatibility with frontend
          sender: sender,
          timestamp: new Date(parseInt(msg.createDate || '0')),
          type: msg.contentType === 'pic' || msg.message?.includes('/fiat/p2p/oss/') ? 'image' : 'text',
          imageUrl: msg.imageUrl || (msg.message?.includes('/fiat/p2p/oss/') ? msg.message : undefined),
          userId: msg.userId,
          nickName: msg.nickName
        };
      });

      // Сохраняем новые сообщения в БД
      if (data.transactionId) {
        for (const msg of formattedMessages) {
          try {
            const existing = await prisma.chatMessage.findFirst({
              where: { messageId: msg.messageId }
            });

            if (!existing) {
              await prisma.chatMessage.create({
                data: {
                  transactionId: data.transactionId,
                  messageId: msg.messageId,
                  sender: msg.sender,
                  message: msg.message,  // Используем поле message
                  messageType: msg.type,
                  isProcessed: msg.sender === 'us',
                  sentAt: msg.timestamp
                }
              });
            }
          } catch (error) {
            logger.error('Error saving message to DB', error as Error);
          }
        }
      }

      handleSuccess({
        messages: formattedMessages,
        orderId: data.orderId,
        accountId: bybitAccountId
      }, undefined, callback);

    } catch (error) {
      logger.error('Error getting chat messages', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Отправка сообщения в чат через Bybit API
   */
  static async sendChatMessage(
    socket: AuthenticatedSocket,
    data: { orderId: string; transactionId: string; message: string },
    callback: Function
  ) {
    try {
      logger.info('Sending chat message', { 
        orderId: data.orderId,
        messageLength: data.message?.length,
        data: data  // Log the full data object to debug
      });

      // Получаем транзакцию и аккаунт
      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (!transaction.advertisement?.bybitAccount) {
        throw new Error('Bybit account not found for this transaction');
      }

      const bybitAccountId = transaction.advertisement.bybitAccount.accountId;

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${bybitAccountId}`);
      }

      // Отправляем сообщение через правильный метод с объектом параметров
      await client.sendChatMessage({
        orderId: data.orderId,
        message: data.message,
        messageType: 'TEXT'
      });

      // Сохраняем в БД с правильным полем message
      const chatMessage = await prisma.chatMessage.create({
        data: {
          transactionId: data.transactionId,
          messageId: `sent-${Date.now()}`,
          sender: 'us',
          message: data.message,  // Используем поле message вместо content
          messageType: 'TEXT',
          isProcessed: true,
          sentAt: new Date()
        }
      });

      logger.info('Chat message sent successfully', { 
        orderId: data.orderId,
        messageId: chatMessage.id 
      });

      handleSuccess({
        messageId: chatMessage.id,
        timestamp: chatMessage.sentAt
      }, 'Message sent successfully', callback);

    } catch (error) {
      logger.error('Error sending chat message', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Получение количества непрочитанных сообщений
   */
  static async getUnreadMessagesCount(
    socket: AuthenticatedSocket,
    data: { transactionId: string },
    callback: Function
  ) {
    try {
      logger.info('Getting unread messages count', { transactionId: data.transactionId });

      // Получаем количество непрочитанных сообщений из БД
      const unreadCount = await prisma.chatMessage.count({
        where: {
          transactionId: data.transactionId,
          sender: 'them',
          readAt: null
        }
      });

      handleSuccess({ count: unreadCount }, 'Unread count retrieved', callback);
    } catch (error) {
      logger.error('Error getting unread messages count', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Отметить сообщения как прочитанные
   */
  static async markMessagesAsRead(
    socket: AuthenticatedSocket,
    data: { transactionId: string },
    callback: Function
  ) {
    try {
      logger.info('Marking messages as read', { transactionId: data.transactionId });

      // Обновляем все непрочитанные сообщения
      const result = await prisma.chatMessage.updateMany({
        where: {
          transactionId: data.transactionId,
          sender: 'them',
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      logger.info('Messages marked as read', { 
        transactionId: data.transactionId,
        count: result.count 
      });

      handleSuccess({ updatedCount: result.count }, 'Messages marked as read', callback);
    } catch (error) {
      logger.error('Error marking messages as read', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Отправка изображения в чат
   */
  static async sendChatImage(
    socket: AuthenticatedSocket,
    data: { orderId: string; transactionId: string; imageBase64: string; caption?: string },
    callback: Function
  ) {
    try {
      logger.info('Sending chat image', { 
        orderId: data.orderId,
        hasCaption: !!data.caption 
      });

      // Получаем транзакцию и аккаунт
      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (!transaction.advertisement?.bybitAccount) {
        throw new Error('Bybit account not found for this transaction');
      }

      const bybitAccountId = transaction.advertisement.bybitAccount.accountId;

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${bybitAccountId}`);
      }

      // Конвертируем base64 в Buffer
      const imageBuffer = Buffer.from(data.imageBase64, 'base64');

      // Отправляем изображение
      await client.sendChatImage(data.orderId, imageBuffer, data.caption);

      // Сохраняем в БД
      const chatMessage = await prisma.chatMessage.create({
        data: {
          transactionId: data.transactionId,
          messageId: `img-${Date.now()}`,
          sender: 'us',
          message: data.caption || '[Изображение]',  // Используем поле message вместо content
          messageType: 'IMAGE',
          isProcessed: true,
          sentAt: new Date()
        }
      });

      logger.info('Chat image sent successfully', { 
        orderId: data.orderId,
        messageId: chatMessage.id 
      });

      handleSuccess({
        messageId: chatMessage.id,
        timestamp: chatMessage.sentAt
      }, 'Image sent successfully', callback);

    } catch (error) {
      logger.error('Error sending chat image', error as Error);
      handleError(error, callback);
    }
  }

  /**
   * Upload file to Bybit chat
   */
  static async uploadChatFile(
    socket: AuthenticatedSocket,
    data: { 
      fileData: string; // Base64 encoded file
      fileName: string;
      mimeType: string;
      transactionId: string;
    },
    callback: Function
  ) {
    try {
      logger.info('Uploading chat file', { 
        fileName: data.fileName,
        mimeType: data.mimeType,
        transactionId: data.transactionId
      });

      // Check user permissions
      if (socket.user?.role !== 'admin' && socket.user?.role !== 'operator') {
        throw new Error('Insufficient permissions to upload files');
      }

      // Получаем транзакцию и аккаунт
      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (!transaction.advertisement?.bybitAccount) {
        throw new Error('Bybit account not found for this transaction');
      }

      const bybitAccountId = transaction.advertisement.bybitAccount.accountId;

      // Получаем BybitP2PManager
      const { getBybitP2PManager } = require('../../app');
      const bybitManager = getBybitP2PManager();
      
      if (!bybitManager) {
        throw new Error('BybitP2PManager not initialized');
      }

      // Получаем клиент для аккаунта
      const client = bybitManager.getClient(bybitAccountId);
      if (!client) {
        throw new Error(`Bybit client not found for account ${bybitAccountId}`);
      }

      // Конвертируем base64 в Buffer
      const fileBuffer = Buffer.from(data.fileData, 'base64');

      // Загружаем файл через Bybit API
      const uploadResult = await client.uploadChatFile(fileBuffer, data.fileName, data.mimeType);

      logger.info('File uploaded successfully', { 
        url: uploadResult.url,
        type: uploadResult.type,
        fileName: data.fileName
      });

      handleSuccess({
        url: uploadResult.url,
        type: uploadResult.type,
        fileName: data.fileName
      }, 'File uploaded successfully', callback);

    } catch (error) {
      logger.error('Error uploading chat file', error as Error);
      handleError(error, callback);
    }
  }
}