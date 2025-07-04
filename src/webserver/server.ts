/**
 * WebSocket сервер для управления системой
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { authMiddleware, requireAuth } from './middleware/auth';
import { AuthManager } from './auth/authManager';
import { createLogger } from '../logger';
import { getServerURLs } from '../utils/getExternalIP';

// Импорт контроллеров
import { AccountController } from './controllers/accountController';
import { TransactionController } from './controllers/transactionController';
import { PayoutController } from './controllers/payoutController';
import { AdvertisementController } from './controllers/advertisementController';
import { ExchangeRateController } from './controllers/exchangeRateController';
import { ChatController } from './controllers/chatController';
import { TemplateController } from './controllers/templateController';
import { OrchestratorController } from './controllers/orchestratorController';
import { PlatformAccountController } from './controllers/platformAccountController';
import { ReceiptController } from './controllers/receiptController';
import { BybitChatController } from './controllers/bybitChatController';
import { BybitAdvertisementController } from './controllers/bybitAdvertisementController';
import { initLogsController } from './controllers/logsController';
import { MailSlurpController } from './controllers/mailSlurpController';
import { EmailController } from './controllers/emailController';
import { CleanupController } from './controllers/cleanupController';
import { BadReceiptController } from './controllers/badReceiptController';
import { AppealController } from './controllers/appealController';
import { setGlobalIO } from './global';

const logger = createLogger('WebSocketServer');

const authManager = new AuthManager();

export class WebSocketServer {
  private io: Server;
  private httpServer: any;
  private port: number;
  private logsController: any;

  constructor(port: number = 3002) {
    this.port = port;
    this.httpServer = createServer((req, res) => {
      // Health check endpoint
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          service: 'itrader-websocket'
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    
    // Configure CORS
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    const allowedOrigins =
      corsOrigin === '*'
        ? '*'
        : corsOrigin.split(',').map((o) => o.trim());
    // If CORS is set to wildcard, credentials cannot be enabled
    const allowCredentials = corsOrigin !== '*';

    this.io = new Server(this.httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: allowCredentials,
      },
    });
    logger.info('Configured CORS', { allowedOrigins, credentials: allowCredentials });

    this.setupMiddleware();
    this.setupEventHandlers();
  }
  
  /**
   * Get the Socket.IO server instance
   */
  getIO(): Server {
    return this.io;
  }

  /**
   * Настройка middleware
   */
  private setupMiddleware() {
    // Allow all connections, auth will be checked per event
    // this.io.use(authMiddleware);
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected`, { socketId: socket.id });
      
      // Helper function to wrap handlers with auth
      const withAuth = (handler: Function) => {
        return (...args: any[]) => {
          return requireAuth(handler)(socket, ...args);
        };
      };
      
      // Helper function to wrap handlers with auth and user action logging
      const withAuthAndLogging = (handler: Function, action: string, method: string, dataExtractor?: (data: any) => any) => {
        return withAuth(async (socket: any, data: any, callback: any) => {
          const userId = socket.userId || socket.accountId || socket.data?.user?.id;
          const extractedData = dataExtractor ? dataExtractor(data) : data;
          
          logger.userAction(
            `User action: ${action}`,
            {
              userId,
              action,
              method
            },
            extractedData
          );
          
          return handler(socket, data, callback);
        });
      };
      
      // Get logs controller instance
      const logsController = this.logsController;

      // Аутентификация
      socket.on('auth:login', async (data, callback) => {
        try {
          const result = await authManager.login(data);
          logger.userAction(
            'User logged in',
            {
              userId: result.user.id,
              action: 'login',
              method: 'auth:login'
            },
            { username: data.username }
          );
          callback({
            success: true,
            data: {
              token: result.token,
              user: {
                id: result.user.id,
                username: result.user.username,
                role: result.user.role
              }
            }
          });
        } catch (error) {
          logger.userAction({
            userId: null,
            action: 'login_failed',
            method: 'auth:login',
            data: { username: data.username, error: error.message }
          });
          callback({
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: error.message
            }
          });
        }
      });

      socket.on('auth:logout', withAuth(async (socket, callback) => {
        try {
          const userId = socket.userId || socket.accountId || socket.data?.user?.id;
          logger.userAction({
            userId,
            action: 'logout',
            method: 'auth:logout',
            data: {}
          });
          await authManager.logout(socket.handshake.auth?.token);
          callback({ success: true });
        } catch (error) {
          callback({
            success: false,
            error: { message: error.message }
          });
        }
      }));

      // Health check endpoint (no auth required)
      socket.on('health:check', async (callback) => {
        logger.debug('Health check requested', { socketId: socket.id });
        
        if (typeof callback !== 'function') {
          logger.error('Health check callback is not a function', { callbackType: typeof callback, socketId: socket.id });
          return;
        }
        
        const response = {
          success: true,
          data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        
        logger.debug('Sending health check response', { response, socketId: socket.id });
        callback(response);
      });

      // Управление аккаунтами системы
      socket.on('accounts:create', withAuthAndLogging(AccountController.create, 'createAccount', 'accounts:create', (data) => ({ username: data?.username, role: data?.role })));
      socket.on('accounts:update', withAuthAndLogging(AccountController.update, 'updateAccount', 'accounts:update', (data) => ({ accountId: data?.id })));
      socket.on('accounts:delete', withAuthAndLogging(AccountController.delete, 'deleteAccount', 'accounts:delete', (data) => ({ accountId: data?.id })));
      socket.on('accounts:list', withAuthAndLogging(AccountController.list, 'listAccounts', 'accounts:list', (data) => ({ page: data?.page, limit: data?.limit })));
      socket.on('accounts:resetPassword', withAuthAndLogging(AccountController.resetPassword, 'resetPassword', 'accounts:resetPassword', (data) => ({ accountId: data?.id })));
      socket.on('accounts:getCurrentUser', withAuthAndLogging(AccountController.getCurrentUser, 'getCurrentUser', 'accounts:getCurrentUser', () => ({})));
      socket.on('accounts:changePassword', withAuthAndLogging(AccountController.changePassword, 'changePassword', 'accounts:changePassword', () => ({})));

      // Управление платформенными аккаунтами (Gate, Bybit)
      socket.on('accounts:listGateAccounts', withAuth(PlatformAccountController.listGateAccounts));
      socket.on('accounts:createGateAccount', withAuth(PlatformAccountController.createGateAccount));
      socket.on('accounts:updateGateAccount', withAuth(PlatformAccountController.updateGateAccount));
      socket.on('accounts:deleteGateAccount', withAuth(PlatformAccountController.deleteGateAccount));
      socket.on('accounts:getGateAccountStats', withAuth(PlatformAccountController.getGateAccountStats));
      socket.on('accounts:listBybitAccounts', withAuth(PlatformAccountController.listBybitAccounts));
      socket.on('accounts:createBybitAccount', withAuth(PlatformAccountController.createBybitAccount));
      socket.on('accounts:updateBybitAccount', withAuth(PlatformAccountController.updateBybitAccount));
      socket.on('accounts:deleteBybitAccount', withAuth(PlatformAccountController.deleteBybitAccount));
      socket.on('accounts:getBybitAccountStats', withAuth(PlatformAccountController.getBybitAccountStats));
      socket.on('accounts:startGmailOAuth', withAuth(PlatformAccountController.startGmailOAuth));
      socket.on('accounts:completeGmailOAuth', withAuth(PlatformAccountController.completeGmailOAuth));
      socket.on('accounts:listGmailAccounts', withAuth(PlatformAccountController.listGmailAccounts));
      socket.on('accounts:deleteGmailAccount', withAuth(PlatformAccountController.deleteGmailAccount));

      // Управление транзакциями
      socket.on('transactions:list', withAuthAndLogging(TransactionController.list, 'listTransactions', 'transactions:list', (data) => ({ page: data?.page, limit: data?.limit, status: data?.status })));
      socket.on('transactions:get', withAuthAndLogging(TransactionController.get, 'getTransaction', 'transactions:get', (data) => ({ transactionId: data?.id })));
      socket.on('transactions:updateStatus', withAuthAndLogging(TransactionController.updateStatus, 'updateTransactionStatus', 'transactions:updateStatus', (data) => ({ transactionId: data?.id, status: data?.status })));
      socket.on('transactions:addCustomStatus', withAuthAndLogging(TransactionController.addCustomStatus, 'addCustomStatus', 'transactions:addCustomStatus', (data) => ({ code: data?.code, name: data?.name })));
      socket.on('transactions:updateCustomStatus', withAuthAndLogging(TransactionController.updateCustomStatus, 'updateCustomStatus', 'transactions:updateCustomStatus', (data) => ({ statusId: data?.id })));
      socket.on('transactions:deleteCustomStatus', withAuthAndLogging(TransactionController.deleteCustomStatus, 'deleteCustomStatus', 'transactions:deleteCustomStatus', (data) => ({ statusId: data?.id })));
      socket.on('transactions:listStatuses', withAuthAndLogging(TransactionController.listStatuses, 'listStatuses', 'transactions:listStatuses', () => ({})));
      socket.on('transactions:getStatistics', withAuthAndLogging(TransactionController.getStatistics, 'getTransactionStatistics', 'transactions:getStatistics', () => ({})));
      socket.on('transactions:recreateAdvertisement', withAuthAndLogging(TransactionController.recreateAdvertisement, 'recreateAdvertisement', 'transactions:recreateAdvertisement', (data) => ({ transactionId: data?.transactionId })));
      socket.on('transactions:getCancelled', withAuthAndLogging(TransactionController.getCancelledTransactions, 'getCancelledTransactions', 'transactions:getCancelled', (data) => ({ page: data?.page, limit: data?.limit })));
      socket.on('transactions:reissueAdvertisement', withAuthAndLogging(TransactionController.reissueAdvertisement, 'reissueAdvertisement', 'transactions:reissueAdvertisement', (data) => ({ transactionId: data?.transactionId })));
      socket.on('transactions:releaseMoney', withAuthAndLogging(TransactionController.releaseMoney, 'releaseMoney', 'transactions:releaseMoney', (data) => ({ transactionId: data?.transactionId })));

      // Управление апелляциями
      socket.on('appeals:sync', withAuthAndLogging(AppealController.syncAppeals, 'syncAppeals', 'appeals:sync', () => ({})));
      socket.on('appeals:getStatus', withAuth(AppealController.getStatus));

      // Управление выплатами
      socket.on('payouts:list', withAuth(PayoutController.list));
      socket.on('payouts:get', withAuth(PayoutController.get));
      socket.on('payouts:create', withAuth(PayoutController.create));
      socket.on('payouts:updateStatus', withAuth(PayoutController.updateStatus));
      socket.on('payouts:linkToTransaction', withAuth(PayoutController.linkToTransaction));
      socket.on('payouts:cancel', withAuth(PayoutController.cancel));
      socket.on('payouts:retry', withAuth(PayoutController.retry));
      socket.on('payouts:getStatistics', withAuth(PayoutController.getStatistics));
      socket.on('payouts:export', withAuth(PayoutController.export));

      // Управление объявлениями
      socket.on('advertisements:list', withAuth(AdvertisementController.list));
      socket.on('advertisements:get', withAuth(AdvertisementController.get));
      socket.on('advertisements:create', withAuth(AdvertisementController.create));
      socket.on('advertisements:update', withAuth(AdvertisementController.update));
      socket.on('advertisements:toggle', withAuth(AdvertisementController.toggle));
      socket.on('advertisements:delete', withAuth(AdvertisementController.delete));
      socket.on('advertisements:bulkUpdatePrices', withAuth(AdvertisementController.bulkUpdatePrices));
      socket.on('advertisements:getStatistics', withAuth(AdvertisementController.getStatistics));
      socket.on('advertisements:clone', withAuth(AdvertisementController.clone));

      // Управление курсами валют
      socket.on('rates:get', withAuth(ExchangeRateController.get));
      socket.on('rates:setConstant', withAuth(ExchangeRateController.setConstant));
      socket.on('rates:toggleMode', withAuth(ExchangeRateController.toggleMode));
      socket.on('rates:history', withAuth(ExchangeRateController.history));
      socket.on('rates:setMarkup', withAuth(ExchangeRateController.setMarkup));
      socket.on('rates:forceUpdate', withAuth(ExchangeRateController.forceUpdate));
      socket.on('rates:getStatistics', withAuth(ExchangeRateController.getStatistics));
      socket.on('rates:getRules', withAuth(ExchangeRateController.getRules));
      socket.on('rates:createRule', withAuth(ExchangeRateController.createRule));
      socket.on('rates:updateRule', withAuth(ExchangeRateController.updateRule));
      socket.on('rates:deleteRule', withAuth(ExchangeRateController.deleteRule));
      socket.on('rates:testRule', withAuth(ExchangeRateController.testRule));
      socket.on('rates:getBybitStatistics', withAuth(ExchangeRateController.getBybitStatistics));
      socket.on('rates:updateConfig', withAuth(ExchangeRateController.updateConfig));

      // Управление чатами
      socket.on('chats:list', withAuth(ChatController.listChats));
      socket.on('chats:getMessages', withAuth(ChatController.getMessages));
      socket.on('chats:sendMessage', withAuth(ChatController.sendMessage));
      socket.on('chats:markAsRead', withAuth(ChatController.markAsRead));
      socket.on('chats:getUnread', withAuth(ChatController.getUnread));
      socket.on('chats:syncMessages', withAuth(ChatController.syncMessages));
      socket.on('chats:getStatistics', withAuth(ChatController.getChatStatistics));
      socket.on('chats:export', withAuth(ChatController.exportChat));

      // Управление чатами Bybit (прямое API)
      socket.on('bybit:getChatMessages', withAuthAndLogging(BybitChatController.getChatMessages, 'getBybitChatMessages', 'bybit:getChatMessages', (data) => ({ orderId: data?.orderId })));
      socket.on('bybit:sendChatMessage', withAuthAndLogging(BybitChatController.sendChatMessage, 'sendBybitChatMessage', 'bybit:sendChatMessage', (data) => ({ orderId: data?.orderId, messageLength: data?.message?.length })));
      socket.on('bybit:sendChatImage', withAuthAndLogging(BybitChatController.sendChatImage, 'sendBybitChatImage', 'bybit:sendChatImage', (data) => ({ orderId: data?.orderId, hasCaption: !!data?.caption })));
      socket.on('bybit:uploadChatFile', withAuthAndLogging(BybitChatController.uploadChatFile, 'uploadBybitChatFile', 'bybit:uploadChatFile', (data) => ({ fileName: data?.fileName, mimeType: data?.mimeType })));
      socket.on('bybit:getUnreadMessagesCount', withAuth(BybitChatController.getUnreadMessagesCount));
      socket.on('bybit:markMessagesAsRead', withAuth(BybitChatController.markMessagesAsRead));

      // Управление объявлениями Bybit (прямое API)
      socket.on('bybitAdvertisements:list', withAuth(BybitAdvertisementController.list));
      socket.on('bybitAdvertisements:create', withAuth(BybitAdvertisementController.create));
      socket.on('bybitAdvertisements:update', withAuth(BybitAdvertisementController.update));
      socket.on('bybitAdvertisements:toggle', withAuth(BybitAdvertisementController.toggle));
      socket.on('bybitAdvertisements:delete', withAuth(BybitAdvertisementController.delete));
      socket.on('bybit:getBalances', withAuth(BybitAdvertisementController.getBalances));
      socket.on('bybit:refreshBalances', withAuth(BybitAdvertisementController.refreshBalances));

      // Управление MailSlurp
      socket.on('mailslurp:listAccounts', withAuth(MailSlurpController.listAccounts));
      socket.on('mailslurp:createAccount', withAuth(MailSlurpController.createAccount));
      socket.on('mailslurp:deleteAccount', withAuth(MailSlurpController.deleteAccount));
      socket.on('mailslurp:setActive', withAuth(MailSlurpController.setActive));
      socket.on('mailslurp:syncInboxes', withAuth(MailSlurpController.syncInboxes));

      // Управление письмами
      socket.on('emails:list', withAuth(EmailController.list));
      socket.on('emails:get', withAuth(EmailController.get));
      socket.on('emails:downloadAttachment', withAuth(EmailController.downloadAttachment));
      socket.on('emails:markAsRead', withAuth(EmailController.markAsRead));
      socket.on('emails:getStats', withAuth(EmailController.getStats));
      socket.on('emails:getInboxes', withAuth(EmailController.getInboxes));
      socket.on('emails:sendTestEmail', withAuth(EmailController.sendTestEmail));

      // Управление шаблонами
      socket.on('templates:list', withAuth(TemplateController.list));
      socket.on('templates:get', withAuth(TemplateController.get));
      socket.on('templates:create', withAuth(TemplateController.create));
      socket.on('templates:update', withAuth(TemplateController.update));
      socket.on('templates:delete', withAuth(TemplateController.delete));
      socket.on('templates:listGroups', withAuth(TemplateController.listGroups));
      socket.on('templates:createGroup', withAuth(TemplateController.createGroup));
      socket.on('templates:updateGroup', withAuth(TemplateController.updateGroup));
      socket.on('templates:deleteGroup', withAuth(TemplateController.deleteGroup));
      socket.on('templates:findMatch', withAuth(TemplateController.findMatch));
      socket.on('templates:test', withAuth(TemplateController.test));
      socket.on('templates:bulkImport', withAuth(TemplateController.bulkImport));
      socket.on('templates:export', withAuth(TemplateController.export));

      // Управление оркестратором
      // getStatus doesn't require auth - used for health checks
      socket.on('orchestrator:getStatus', async (callback) => {
        await OrchestratorController.getStatus(socket as any, callback);
      });
      socket.on('orchestrator:start', withAuthAndLogging(OrchestratorController.start, 'startOrchestrator', 'orchestrator:start', () => ({})));
      socket.on('orchestrator:stop', withAuthAndLogging(OrchestratorController.stop, 'stopOrchestrator', 'orchestrator:stop', () => ({})));
      socket.on('orchestrator:pause', withAuthAndLogging(OrchestratorController.pause, 'pauseOrchestrator', 'orchestrator:pause', () => ({})));
      socket.on('orchestrator:resume', withAuthAndLogging(OrchestratorController.resume, 'resumeOrchestrator', 'orchestrator:resume', () => ({})));
      socket.on('orchestrator:restart', withAuthAndLogging(OrchestratorController.restart, 'restartOrchestrator', 'orchestrator:restart', () => ({})));
      socket.on('orchestrator:getConfig', withAuthAndLogging(OrchestratorController.getConfig, 'getOrchestratorConfig', 'orchestrator:getConfig', () => ({})));
      socket.on('orchestrator:updateConfig', withAuthAndLogging(OrchestratorController.updateConfig, 'updateOrchestratorConfig', 'orchestrator:updateConfig', (data) => ({ config: data })));
      socket.on('orchestrator:getLogs', withAuthAndLogging(OrchestratorController.getLogs, 'getOrchestratorLogs', 'orchestrator:getLogs', (data) => ({ lines: data?.lines })));
      socket.on('orchestrator:clearLogs', withAuthAndLogging(OrchestratorController.clearLogs, 'clearOrchestratorLogs', 'orchestrator:clearLogs', () => ({})));
      socket.on('orchestrator:runTask', withAuthAndLogging(OrchestratorController.runTask, 'runOrchestratorTask', 'orchestrator:runTask', (data) => ({ taskName: data?.taskName })));
      socket.on('orchestrator:getStatistics', withAuthAndLogging(OrchestratorController.getStatistics, 'getOrchestratorStatistics', 'orchestrator:getStatistics', () => ({})));
      socket.on('orchestrator:test', withAuthAndLogging(OrchestratorController.test, 'testOrchestrator', 'orchestrator:test', () => ({})));

      // Управление чеками
      socket.on('receipts:list', withAuth(ReceiptController.listReceipts));
      socket.on('receipts:get', withAuth(ReceiptController.getReceipt));
      socket.on('receipts:getByPayoutId', withAuth(ReceiptController.getByPayoutId));
      socket.on('receipts:getPDF', withAuth(ReceiptController.getReceiptPDF));
      socket.on('receipts:delete', withAuth(ReceiptController.deleteReceipt));
      socket.on('receipts:getStats', withAuth(ReceiptController.getReceiptStats));
      socket.on('receipts:matchUnmatched', withAuth(ReceiptController.matchUnmatchedReceipts));
      socket.on('receipts:subscribe', withAuth(ReceiptController.subscribe));
      socket.on('receipts:unsubscribe', withAuth(ReceiptController.unsubscribe));
      socket.on('receipts:uploadManual', withAuth(ReceiptController.uploadManual));
      socket.on('receipts:confirmManual', withAuth(ReceiptController.confirmManual));

      // Управление плохими чеками (не от T-Bank)
      socket.on('badReceipts:list', withAuth(BadReceiptController.list));
      socket.on('badReceipts:get', withAuth(BadReceiptController.get));
      socket.on('badReceipts:download', withAuth(BadReceiptController.download));
      socket.on('badReceipts:delete', withAuth(BadReceiptController.delete));
      socket.on('badReceipts:getStats', withAuth(BadReceiptController.getStats));
      socket.on('badReceipts:subscribe', withAuth(BadReceiptController.subscribe));
      socket.on('badReceipts:unsubscribe', withAuth(BadReceiptController.unsubscribe));

      // Управление логами
      socket.on('logs:get', withAuth(async (socket, data, callback) => {
        await logsController.handleGetLogs(socket, data, callback);
      }));
      socket.on('logs:services', withAuth(async (socket, data, callback) => {
        await logsController.handleGetServices(socket, data, callback);
      }));
      socket.on('logs:subscribe', withAuth(async (socket, data) => {
        await logsController.handleSubscribe(socket, data);
      }));
      socket.on('logs:unsubscribe', withAuth(async (socket, data) => {
        await logsController.handleUnsubscribe(socket, data);
      }));
      socket.on('logs:getCleanupConfig', withAuth(async (socket, data, callback) => {
        await logsController.handleGetCleanupConfig(socket, data, callback);
      }));
      socket.on('logs:setCleanupConfig', withAuth(async (socket, data, callback) => {
        await logsController.handleSetCleanupConfig(socket, data, callback);
      }));
      socket.on('logs:cleanupNow', withAuth(async (socket, data, callback) => {
        await logsController.handleCleanupNow(socket, data, callback);
      }));

      // Управление очисткой объявлений
      socket.on('cleanup:getStatus', withAuth(CleanupController.getStatus));
      socket.on('cleanup:forceCleanup', withAuthAndLogging(CleanupController.forceCleanup, 'forceCleanup', 'cleanup:forceCleanup', () => ({})));
      socket.on('cleanup:cleanupTransaction', withAuthAndLogging(CleanupController.cleanupTransaction, 'cleanupTransaction', 'cleanup:cleanupTransaction', (data) => ({ transactionId: data?.transactionId })));

      // Управление аналитикой
      socket.on('analytics:get', withAuth(async (socket, data, callback) => {
        const { setupAnalyticsHandlers } = await import('./controllers/analyticsController');
        const handlers = {
          'analytics:get': async (data: any, cb: any) => {
            try {
              const { analyticsService } = await import('../services/analyticsService');
              const startDate = new Date(data.startDate);
              const endDate = new Date(data.endDate);
              const analytics = await analyticsService.getAnalytics(startDate, endDate);
              cb({ success: true, data: analytics });
            } catch (error: any) {
              cb({ success: false, error: { code: 'ANALYTICS_ERROR', message: error.message } });
            }
          }
        };
        await handlers['analytics:get'](data, callback);
      }));
      
      socket.on('analytics:getHistorical', withAuth(async (socket, data, callback) => {
        try {
          const { analyticsService } = await import('../services/analyticsService');
          const startDate = new Date(data.startDate);
          const endDate = new Date(data.endDate);
          const interval = data.interval || 'day';
          const historicalData = await analyticsService.getHistoricalData(startDate, endDate, interval);
          callback({ success: true, data: historicalData });
        } catch (error: any) {
          callback({ success: false, error: { code: 'HISTORICAL_ERROR', message: error.message } });
        }
      }));
      
      socket.on('analytics:getTransaction', withAuth(async (socket, data, callback) => {
        try {
          const { analyticsService } = await import('../services/analyticsService');
          const analytics = await analyticsService.getTransactionAnalytics(data.transactionId);
          callback({ success: true, data: analytics });
        } catch (error: any) {
          callback({ success: false, error: { code: 'TRANSACTION_ANALYTICS_ERROR', message: error.message } });
        }
      }));

      // Отключение
      socket.on('disconnect', () => {
        logger.info(`Client disconnected`, { socketId: socket.id });
      });
    });
  }

  /**
   * Запуск сервера
   */
  async start() {
    // Set global IO instance
    setGlobalIO(this.io);
    
    // Initialize logs controller
    this.logsController = initLogsController(this.io);
    
    // Очищаем просроченные токены при запуске
    const cleaned = await authManager.cleanupExpiredTokens();
    logger.info(`Cleaned ${cleaned} expired tokens`);

    // Запускаем периодическую очистку токенов
    setInterval(async () => {
      await authManager.cleanupExpiredTokens();
    }, 60 * 60 * 1000); // Каждый час

    return new Promise((resolve) => {
      this.httpServer.listen(this.port, '0.0.0.0', async () => {
        logger.info(`Socket.IO server listening on port ${this.port}`, { port: this.port });
        
        // Get and display server URLs
        const urls = await getServerURLs(this.port);
        console.log('\n' + '='.repeat(60));
        console.log('🚀 WebSocket Server Started Successfully!');
        console.log('='.repeat(60));
        console.log(`📡 Socket.IO API: ${urls.local}`);
        if (urls.external) {
          console.log(`🌐 External API: ${urls.external}`);
        }
        console.log('='.repeat(60));
        console.log('📱 Frontend Panel URLs:');
        console.log(`   Local: http://localhost:3000`);
        if (urls.external) {
          console.log(`   External: http://${urls.external.split(':')[1].replace('//', '')}:3000`);
        }
        console.log('='.repeat(60));
        console.log('💡 Make sure ports 3000 and 3002 are open in your firewall!');
        console.log('='.repeat(60) + '\n');
        
        resolve(undefined);
      });
    });
  }

  /**
   * Остановка сервера
   */
  async stop() {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('Socket.IO server stopped');
        resolve(undefined);
      });
    });
  }

  /**
   * Получение экземпляра Socket.IO
   */
  getIO() {
    return this.io;
  }
}