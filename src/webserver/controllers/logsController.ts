import { Server, Socket } from "socket.io";
import { createLogger, LogLevel } from "../../logger";
import { authSocket } from "../middleware/auth";

const logger = createLogger('LogsController');

export class LogsController {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async handleGetLogs(socket: Socket, data: any, callback: Function) {
    try {
      logger.info('Getting logs', { filters: data });
      const filters = {
        level: data?.level as LogLevel,
        service: data?.service,
        module: data?.module,
        userId: data?.userId,
        isSystem: data?.isSystem,
        startDate: data?.startDate ? new Date(data.startDate) : undefined,
        endDate: data?.endDate ? new Date(data.endDate) : undefined,
        search: data?.search,
        limit: data?.limit || 100,
        offset: data?.offset || 0
      };

      const result = await logger.getLogs(filters);
      
      callback({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to get logs', error as Error);
      callback({
        success: false,
        error: 'Failed to get logs'
      });
    }
  }

  async handleGetServices(socket: Socket, data: any, callback: Function) {
    try {
      const services = await logger.getServices();
      
      callback({
        success: true,
        data: services
      });
    } catch (error) {
      logger.error('Failed to get services', error as Error);
      callback({
        success: false,
        error: 'Failed to get services'
      });
    }
  }

  async handleSubscribe(socket: Socket, data: any, callback?: Function) {
    const user = (socket as any).user;
    const room = data?.service ? `logs:${data.service}` : 'logs:all';
    socket.join(room);
    logger.info(`User subscribed to logs`, { userId: user?.id, room });
    if (callback) {
      callback({ success: true });
    }
  }

  async handleUnsubscribe(socket: Socket, data: any, callback?: Function) {
    const user = (socket as any).user;
    const room = data?.service ? `logs:${data.service}` : 'logs:all';
    socket.leave(room);
    logger.info(`User unsubscribed from logs`, { userId: user?.id, room });
    if (callback) {
      callback({ success: true });
    }
  }

  // Method to emit real-time logs
  emitLog(log: any) {
    // Emit to all logs room
    this.io.to('logs:all').emit('logs:new', log);
    
    // Emit to service-specific room if applicable
    if (log.service) {
      this.io.to(`logs:${log.service}`).emit('logs:new', log);
    }
  }

  async handleGetCleanupConfig(socket: Socket, data: any, callback?: Function) {
    try {
      const { getLogCleanupService } = await import('../../services/logCleanupService');
      const service = getLogCleanupService();
      const config = service.getConfig();
      
      if (callback) {
        callback({
          success: true,
          data: config
        });
      }
    } catch (error) {
      logger.error('Failed to get cleanup config', error as Error);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to get cleanup config'
        });
      }
    }
  }

  async handleSetCleanupConfig(socket: Socket, data: any, callback?: Function) {
    try {
      // Only admins can change cleanup settings
      const user = (socket as any).user;
      if (user?.role !== 'admin') {
        if (callback) {
          callback({
            success: false,
            error: 'Only admins can change cleanup settings'
          });
        }
        return;
      }
      
      const { getLogCleanupService } = await import('../../services/logCleanupService');
      const service = getLogCleanupService();
      await service.saveConfig(data);
      
      if (callback) {
        callback({
          success: true,
          data: service.getConfig()
        });
      }
    } catch (error) {
      logger.error('Failed to set cleanup config', error as Error);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to set cleanup config'
        });
      }
    }
  }

  async handleCleanupNow(socket: Socket, data: any, callback?: Function) {
    try {
      // Only admins can trigger manual cleanup
      const user = (socket as any).user;
      if (user?.role !== 'admin') {
        if (callback) {
          callback({
            success: false,
            error: 'Only admins can trigger manual cleanup'
          });
        }
        return;
      }
      
      const { getLogCleanupService } = await import('../../services/logCleanupService');
      const service = getLogCleanupService();
      await service.performCleanup();
      
      if (callback) {
        callback({
          success: true,
          message: 'Cleanup completed'
        });
      }
    } catch (error) {
      logger.error('Failed to perform cleanup', error as Error);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to perform cleanup'
        });
      }
    }
  }
}

// Export singleton instance
let logsController: LogsController | null = null;

export function initLogsController(io: Server): LogsController {
  if (!logsController) {
    logsController = new LogsController(io);
  }
  return logsController;
}

export function getLogsController(): LogsController | null {
  return logsController;
}