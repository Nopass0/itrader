/**
 * Контроллер управления чатами и сообщениями
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();

export class ChatController {
  /**
   * Получение списка чатов (активных транзакций с сообщениями)
   */
  static async listChats(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      // Формируем where условие для транзакций с активными чатами
      const where: any = {
        status: {
          in: ['chat_started', 'waiting_payment', 'payment_received', 'check_received']
        }
      };
      
      if (data.orderId) {
        where.orderId = data.orderId;
      }
      
      if (data.advertisementId) {
        where.advertisementId = data.advertisementId;
      }

      const response = await paginatePrisma(
        prisma.transaction,
        {
          ...params,
          where,
          sortBy: params.sortBy || 'updatedAt'
        },
        {
          advertisement: {
            include: {
              bybitAccount: true
            }
          },
          payout: true,
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Последнее сообщение
          },
          _count: {
            select: { chatMessages: true }
          }
        }
      );

      // Форматируем ответ для удобства
      const chats = response.data.map((transaction: any) => ({
        transactionId: transaction.id,
        orderId: transaction.orderId,
        status: transaction.status,
        amount: transaction.amount,
        counterparty: transaction.counterpartyName,
        lastMessage: transaction.chatMessages[0],
        messageCount: transaction._count.chatMessages,
        advertisement: transaction.advertisement,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      }));

      handleSuccess(
        {
          ...response,
          data: chats
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение сообщений чата
   */
  static async getMessages(
    socket: AuthenticatedSocket,
    data: { 
      transactionId: string;
      limit?: number;
      offset?: number;
    },
    callback: Function
  ) {
    try {
      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const messages = await prisma.chatMessage.findMany({
        where: { transactionId: data.transactionId },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit
      });

      const total = await prisma.chatMessage.count({
        where: { transactionId: data.transactionId }
      });

      handleSuccess(
        {
          messages,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
          }
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Отправка сообщения в чат
   */
  static async sendMessage(
    socket: AuthenticatedSocket,
    data: {
      transactionId: string;
      message: string;
      isAutoReply?: boolean;
    },
    callback: Function
  ) {
    try {
      // Проверяем существование транзакции
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

      // Проверяем что чат активен
      const activeChatStatuses = ['chat_started', 'waiting_payment', 'payment_received', 'check_received'];
      if (!activeChatStatuses.includes(transaction.status)) {
        throw new Error('Chat is not active for this transaction');
      }

      // Создаем сообщение в БД
      const chatMessage = await prisma.chatMessage.create({
        data: {
          transactionId: data.transactionId,
          sender: 'seller',
          message: data.message,
          isAutoReply: data.isAutoReply || false,
          metadata: JSON.stringify({
            sentBy: socket.userId,
            sentAt: new Date()
          })
        }
      });

      // Отправляем через Bybit API
      try {
        // Получаем полный объект Bybit аккаунта
        const bybitAccount = await prisma.bybitAccount.findUnique({
          where: { id: transaction.advertisement.bybitAccountId }
        });
        
        if (!bybitAccount) {
          throw new Error('Bybit account not found');
        }
        
        // Используем глобальный BybitP2PManagerService
        const context = global.appContext;
        if (!context?.bybitManager) {
          throw new Error('Bybit manager not initialized');
        }
        
        const manager = context.bybitManager.getManager(bybitAccount.accountId);
        if (!manager) {
          throw new Error('P2P Manager not found for this account');
        }
        
        await manager.sendChatMessage({
          orderId: transaction.orderId,
          message: data.message,
          messageType: 'TEXT'
        });

        // Обновляем статус отправки
        await prisma.chatMessage.update({
          where: { id: chatMessage.id },
          data: { 
            sentAt: new Date(),
            metadata: JSON.stringify({
              ...JSON.parse(chatMessage.metadata || '{}'),
              sentSuccessfully: true
            })
          }
        });
      } catch (error) {
        // Помечаем как неотправленное
        await prisma.chatMessage.update({
          where: { id: chatMessage.id },
          data: { 
            metadata: JSON.stringify({
              ...JSON.parse(chatMessage.metadata || '{}'),
              sentSuccessfully: false,
              error: error.message
            })
          }
        });
        throw new Error(`Failed to send message via Bybit: ${error.message}`);
      }

      // Emit событие о новом сообщении
      socket.broadcast.emit('chat:message', {
        transactionId: data.transactionId,
        message: chatMessage
      });

      handleSuccess(chatMessage, 'Message sent successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Пометка сообщений как прочитанных
   */
  static async markAsRead(
    socket: AuthenticatedSocket,
    data: { transactionId: string },
    callback: Function
  ) {
    try {
      await prisma.chatMessage.updateMany({
        where: {
          transactionId: data.transactionId,
          sender: 'buyer',
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      handleSuccess(null, 'Messages marked as read', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение непрочитанных сообщений
   */
  static async getUnread(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      const unreadMessages = await prisma.$queryRaw`
        SELECT 
          transactionId,
          COUNT(*) as unreadCount,
          MAX(createdAt) as lastMessageAt
        FROM ChatMessage
        WHERE sender = 'buyer' AND readAt IS NULL
        GROUP BY transactionId
      `;

      // Получаем детали транзакций
      const transactionIds = (unreadMessages as any[]).map(m => m.transactionId);
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: transactionIds } },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      const result = (unreadMessages as any[]).map(unread => {
        const transaction = transactions.find(t => t.id === unread.transactionId);
        return {
          ...unread,
          transaction
        };
      });

      handleSuccess(result, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Синхронизация сообщений с Bybit
   */
  static async syncMessages(
    socket: AuthenticatedSocket,
    data: { transactionId: string },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут синхронизировать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot sync messages');
      }

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

      // Синхронизируем через Bybit API
      const { BybitP2PManager } = await import('../../bybit/p2pManager');
      const manager = new BybitP2PManager(transaction.advertisement.bybitAccount);
      
      const chatHistory = await manager.getChatMessages(transaction.orderId);
      
      // Сохраняем новые сообщения
      let newMessagesCount = 0;
      
      for (const msg of chatHistory.messages) {
        // Проверяем существует ли сообщение
        const existing = await prisma.chatMessage.findFirst({
          where: {
            transactionId: data.transactionId,
            messageId: msg.id
          }
        });

        if (!existing) {
          await prisma.chatMessage.create({
            data: {
              transactionId: data.transactionId,
              messageId: msg.id,
              sender: msg.sender === 'seller' ? 'seller' : 'buyer',
              message: msg.content,
              createdAt: new Date(msg.timestamp)
            }
          });
          newMessagesCount++;
        }
      }

      handleSuccess(
        {
          synced: newMessagesCount,
          total: chatHistory.messages.length
        },
        `Synced ${newMessagesCount} new messages`,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики по чатам
   */
  static async getChatStatistics(
    socket: AuthenticatedSocket,
    data: {
      dateFrom?: string;
      dateTo?: string;
    },
    callback: Function
  ) {
    try {
      const where: any = {};
      
      if (data.dateFrom || data.dateTo) {
        where.createdAt = {};
        if (data.dateFrom) {
          where.createdAt.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          where.createdAt.lte = new Date(data.dateTo);
        }
      }

      // Общая статистика
      const totalMessages = await prisma.chatMessage.count({ where });
      const autoReplies = await prisma.chatMessage.count({
        where: { ...where, isAutoReply: true }
      });

      // Статистика по отправителям
      const senderStats = await prisma.chatMessage.groupBy({
        by: ['sender'],
        where,
        _count: {
          id: true
        }
      });

      // Активные чаты
      const activeChats = await prisma.transaction.count({
        where: {
          status: {
            in: ['chat_started', 'waiting_payment', 'payment_received', 'check_received']
          },
          chatMessages: {
            some: where
          }
        }
      });

      // Среднее время ответа
      const avgResponseTime = await prisma.$queryRaw`
        SELECT 
          AVG(TIMESTAMPDIFF(SECOND, buyer_msg.createdAt, seller_msg.createdAt)) as avgResponseSeconds
        FROM ChatMessage buyer_msg
        JOIN ChatMessage seller_msg ON 
          seller_msg.transactionId = buyer_msg.transactionId
          AND seller_msg.sender = 'seller'
          AND seller_msg.createdAt > buyer_msg.createdAt
        WHERE 
          buyer_msg.sender = 'buyer'
          ${data.dateFrom ? `AND buyer_msg.createdAt >= '${data.dateFrom}'` : ''}
          ${data.dateTo ? `AND buyer_msg.createdAt <= '${data.dateTo}'` : ''}
        LIMIT 1000
      `;

      // Почасовая активность
      const hourlyActivity = await prisma.$queryRaw`
        SELECT 
          HOUR(createdAt) as hour,
          COUNT(*) as messageCount
        FROM ChatMessage
        WHERE 1=1
          ${data.dateFrom ? `AND createdAt >= '${data.dateFrom}'` : ''}
          ${data.dateTo ? `AND createdAt <= '${data.dateTo}'` : ''}
        GROUP BY HOUR(createdAt)
        ORDER BY hour
      `;

      handleSuccess(
        {
          overview: {
            totalMessages,
            autoReplies,
            manualReplies: totalMessages - autoReplies,
            activeChats
          },
          senderStats,
          avgResponseTime: (avgResponseTime as any[])[0]?.avgResponseSeconds || 0,
          hourlyActivity
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Экспорт истории чата
   */
  static async exportChat(
    socket: AuthenticatedSocket,
    data: {
      transactionId: string;
      format: 'txt' | 'json' | 'csv';
    },
    callback: Function
  ) {
    try {
      const messages = await prisma.chatMessage.findMany({
        where: { transactionId: data.transactionId },
        orderBy: { createdAt: 'asc' }
      });

      const transaction = await prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: {
          advertisement: true
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      let exportData: any;

      switch (data.format) {
        case 'txt':
          exportData = messages.map(m => 
            `[${m.createdAt.toISOString()}] ${m.sender.toUpperCase()}: ${m.message}`
          ).join('\n');
          break;
          
        case 'csv':
          const csvHeader = 'Timestamp,Sender,Message,IsAutoReply';
          const csvRows = messages.map(m => 
            `"${m.createdAt.toISOString()}","${m.sender}","${m.message.replace(/"/g, '""')}","${m.isAutoReply}"`
          );
          exportData = [csvHeader, ...csvRows].join('\n');
          break;
          
        case 'json':
        default:
          exportData = {
            transaction: {
              id: transaction.id,
              orderId: transaction.orderId,
              amount: transaction.amount,
              status: transaction.status
            },
            messages: messages.map(m => ({
              id: m.id,
              timestamp: m.createdAt,
              sender: m.sender,
              message: m.message,
              isAutoReply: m.isAutoReply
            }))
          };
      }

      handleSuccess(
        {
          format: data.format,
          data: exportData,
          messageCount: messages.length
        },
        'Chat exported successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
}