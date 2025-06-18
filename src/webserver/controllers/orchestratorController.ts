/**
 * Контроллер управления оркестратором и автоматизацией
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();

export class OrchestratorController {
  private static orchestratorInstance: any = null;

  /**
   * Set the orchestrator instance (called from app.ts)
   */
  static setOrchestrator(instance: any) {
    this.orchestratorInstance = instance;
  }

  /**
   * Получение текущего статуса оркестратора
   */
  static async getStatus(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      const { Orchestrator } = await import('../../orchestrator');
      
      if (!this.orchestratorInstance) {
        handleSuccess(
          {
            isRunning: false,
            status: 'stopped',
            message: 'Orchestrator is not initialized'
          },
          undefined,
          callback
        );
        return;
      }

      const status = await this.orchestratorInstance.getStatus();
      const runningTasks = await this.orchestratorInstance.getRunningTasks();
      const scheduledTasks = await this.orchestratorInstance.getScheduledTasks();

      handleSuccess(
        {
          isRunning: status.isRunning,
          status: status.status,
          startedAt: status.startedAt,
          runningTasks: runningTasks.length,
          scheduledTasks: scheduledTasks.length,
          tasks: {
            running: runningTasks,
            scheduled: scheduledTasks
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
   * Запуск оркестратора
   */
  static async start(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      // Только админы и операторы могут запускать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot start orchestrator');
      }

      const { Orchestrator } = await import('../../orchestrator');
      
      if (!this.orchestratorInstance) {
        this.orchestratorInstance = new Orchestrator();
      }

      await this.orchestratorInstance.start();

      // Emit событие о запуске
      socket.broadcast.emit('orchestrator:started', {
        startedBy: socket.userId,
        startedAt: new Date()
      });

      handleSuccess(
        {
          status: 'started',
          message: 'Orchestrator started successfully'
        },
        'Orchestrator started',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Остановка оркестратора
   */
  static async stop(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      // Только админы и операторы могут останавливать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot stop orchestrator');
      }

      if (!this.orchestratorInstance) {
        throw new Error('Orchestrator is not running');
      }

      await this.orchestratorInstance.stop();

      // Emit событие об остановке
      socket.broadcast.emit('orchestrator:stopped', {
        stoppedBy: socket.userId,
        stoppedAt: new Date()
      });

      handleSuccess(
        {
          status: 'stopped',
          message: 'Orchestrator stopped successfully'
        },
        'Orchestrator stopped',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Приостановка оркестратора
   */
  static async pause(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      console.log('[OrchestratorController] Pause request from:', {
        userId: socket.userId,
        accountId: socket.accountId,
        role: socket.role,
        hasOrchestrator: !!this.orchestratorInstance
      });
      
      // Только админы и операторы могут приостанавливать
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot pause orchestrator');
      }

      if (!this.orchestratorInstance) {
        throw new Error('Orchestrator is not running');
      }

      await this.orchestratorInstance.pause();

      // Emit событие о приостановке
      socket.broadcast.emit('orchestrator:paused', {
        pausedBy: socket.userId,
        pausedAt: new Date()
      });

      handleSuccess(
        {
          status: 'paused',
          message: 'Orchestrator paused successfully'
        },
        'Orchestrator paused',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Возобновление работы оркестратора
   */
  static async resume(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      // Только админы и операторы могут возобновлять
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot resume orchestrator');
      }

      if (!this.orchestratorInstance) {
        throw new Error('Orchestrator is not running');
      }

      await this.orchestratorInstance.start(); // start method also resumes

      // Emit событие о возобновлении
      socket.broadcast.emit('orchestrator:resumed', {
        resumedBy: socket.userId,
        resumedAt: new Date()
      });

      handleSuccess(
        {
          status: 'resumed',
          message: 'Orchestrator resumed successfully'
        },
        'Orchestrator resumed',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Перезапуск оркестратора
   */
  static async restart(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      // Только админы могут перезапускать
      if (socket.role !== 'admin') {
        throw new Error('Only admins can restart orchestrator');
      }

      if (this.orchestratorInstance) {
        await this.orchestratorInstance.stop();
      }

      const { Orchestrator } = await import('../../orchestrator');
      this.orchestratorInstance = new Orchestrator();
      await this.orchestratorInstance.start();

      handleSuccess(
        {
          status: 'restarted',
          message: 'Orchestrator restarted successfully'
        },
        'Orchestrator restarted',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение конфигурации автоматизации
   */
  static async getConfig(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      // Получаем настройки из БД
      const settings = await prisma.settings.findMany({
        where: {
          key: {
            startsWith: 'automation.'
          }
        }
      });

      const config: any = {};
      settings.forEach(setting => {
        const key = setting.key.replace('automation.', '');
        config[key] = setting.value;
      });

      // Добавляем дефолтные значения если отсутствуют
      const defaults = {
        chatAutoReply: 'true',
        receiptAutoProcess: 'true',
        orderMonitoringInterval: '5000',
        chatSyncInterval: '2000',
        receiptCheckInterval: '30000',
        maxConcurrentOrders: '10',
        autoConfirmPayment: 'false',
        autoReleasePayment: 'false'
      };

      Object.keys(defaults).forEach(key => {
        if (!(key in config)) {
          config[key] = defaults[key];
        }
      });

      handleSuccess(config, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление конфигурации автоматизации
   */
  static async updateConfig(
    socket: AuthenticatedSocket,
    data: { config: Record<string, string> },
    callback: Function
  ) {
    try {
      // Только админы могут менять конфигурацию
      if (socket.role !== 'admin') {
        throw new Error('Only admins can update automation config');
      }

      // Сохраняем настройки
      for (const [key, value] of Object.entries(data.config)) {
        await prisma.settings.upsert({
          where: { key: `automation.${key}` },
          update: { value },
          create: { key: `automation.${key}`, value }
        });
      }

      // Перезапускаем оркестратор если он работает
      if (this.orchestratorInstance && (await this.orchestratorInstance.getStatus()).isRunning) {
        await this.orchestratorInstance.reload();
      }

      handleSuccess(
        data.config,
        'Configuration updated successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение логов автоматизации
   */
  static async getLogs(
    socket: AuthenticatedSocket,
    data: {
      level?: 'info' | 'warning' | 'error';
      module?: string;
      limit?: number;
      offset?: number;
    },
    callback: Function
  ) {
    try {
      const where: any = {};
      
      if (data.level) {
        where.level = data.level;
      }
      
      if (data.module) {
        where.module = data.module;
      }

      const logs = await prisma.automationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: data.offset || 0,
        take: data.limit || 100
      });

      const total = await prisma.automationLog.count({ where });

      handleSuccess(
        {
          logs,
          pagination: {
            limit: data.limit || 100,
            offset: data.offset || 0,
            total,
            hasMore: (data.offset || 0) + (data.limit || 100) < total
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
   * Очистка логов
   */
  static async clearLogs(
    socket: AuthenticatedSocket,
    data: { olderThan?: string },
    callback: Function
  ) {
    try {
      // Только админы могут очищать логи
      if (socket.role !== 'admin') {
        throw new Error('Only admins can clear logs');
      }

      const where: any = {};
      
      if (data.olderThan) {
        where.createdAt = {
          lt: new Date(data.olderThan)
        };
      }

      const result = await prisma.automationLog.deleteMany({ where });

      handleSuccess(
        {
          deleted: result.count
        },
        `Deleted ${result.count} log entries`,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Ручной запуск задачи
   */
  static async runTask(
    socket: AuthenticatedSocket,
    data: { 
      taskType: 'syncChats' | 'checkReceipts' | 'monitorOrders' | 'processOrders';
      params?: any;
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут запускать задачи
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot run tasks');
      }

      if (!this.orchestratorInstance) {
        throw new Error('Orchestrator is not running');
      }

      let result;
      
      switch (data.taskType) {
        case 'syncChats':
          result = await this.orchestratorInstance.syncAllChats();
          break;
          
        case 'checkReceipts':
          result = await this.orchestratorInstance.checkReceipts();
          break;
          
        case 'monitorOrders':
          result = await this.orchestratorInstance.monitorActiveOrders();
          break;
          
        case 'processOrders':
          result = await this.orchestratorInstance.processOrders();
          break;
          
        default:
          throw new Error(`Unknown task type: ${data.taskType}`);
      }

      handleSuccess(
        {
          taskType: data.taskType,
          result,
          executedAt: new Date()
        },
        'Task executed successfully',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики автоматизации
   */
  static async getStatistics(
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

      // Статистика по логам
      const logStats = await prisma.automationLog.groupBy({
        by: ['level', 'module'],
        where,
        _count: {
          id: true
        }
      });

      // Статистика по автоответам
      const autoReplyStats = await prisma.chatMessage.aggregate({
        where: {
          ...where,
          isAutoReply: true
        },
        _count: {
          id: true
        }
      });

      // Статистика по обработанным чекам
      const receiptStats = await prisma.transaction.aggregate({
        where: {
          ...where,
          status: 'check_received'
        },
        _count: {
          id: true
        }
      });

      // Время работы оркестратора
      let uptimeStats = null;
      if (this.orchestratorInstance) {
        const status = await this.orchestratorInstance.getStatus();
        if (status.isRunning && status.startedAt) {
          uptimeStats = {
            startedAt: status.startedAt,
            uptime: Date.now() - new Date(status.startedAt).getTime()
          };
        }
      }

      handleSuccess(
        {
          logs: logStats,
          autoReplies: autoReplyStats._count.id,
          processedReceipts: receiptStats._count.id,
          uptime: uptimeStats
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Тестирование автоматизации
   */
  static async test(
    socket: AuthenticatedSocket,
    data: {
      testType: 'chatReply' | 'receiptProcessing';
      testData: any;
    },
    callback: Function
  ) {
    try {
      let result;
      
      switch (data.testType) {
        case 'chatReply':
          // Тестируем автоответ
          const { TemplateController } = await import('./templateController');
          const matchResult = await new Promise((resolve, reject) => {
            TemplateController.findMatch(
              socket,
              { message: data.testData.message },
              (response: any) => {
                if (response.success) {
                  resolve(response.data);
                } else {
                  reject(response.error);
                }
              }
            );
          });
          result = matchResult;
          break;
          
        case 'receiptProcessing':
          // Тестируем обработку чека
          const { ReceiptMatcher } = await import('../../services/receiptMatcher');
          const matcher = new ReceiptMatcher();
          const matchedTransaction = await matcher.findMatchingTransaction(
            data.testData.amount,
            data.testData.senderCard || '1234****5678'
          );
          result = {
            found: !!matchedTransaction,
            transaction: matchedTransaction
          };
          break;
          
        default:
          throw new Error(`Unknown test type: ${data.testType}`);
      }

      handleSuccess(
        {
          testType: data.testType,
          testData: data.testData,
          result
        },
        'Test completed',
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
}