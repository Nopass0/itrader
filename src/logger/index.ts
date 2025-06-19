import { PrismaClient } from '../../generated/prisma';
import { hostname } from 'os';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface LogData {
  [key: string]: any;
}

export interface LogVariables {
  [key: string]: any;
}

export interface LogContext {
  userId?: string;
  action?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

class Logger {
  private prisma: PrismaClient;
  private serviceName: string;
  private moduleName?: string;
  private hostname: string;
  private projectRoot: string;

  constructor(serviceName: string, moduleName?: string) {
    this.prisma = new PrismaClient();
    this.serviceName = serviceName;
    this.moduleName = moduleName;
    this.hostname = hostname();
    this.projectRoot = join(__dirname, '../../..');
  }

  private getCallerInfo(): { file: string; line: number; function: string } {
    const error = new Error();
    const stack = error.stack?.split('\n') || [];
    
    for (let i = 3; i < stack.length; i++) {
      const line = stack[i];
      if (line.includes('node_modules')) continue;
      
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
      if (match) {
        const functionName = match[1] || 'anonymous';
        const filePath = match[2];
        const lineNumber = parseInt(match[3], 10);
        const relativePath = relative(this.projectRoot, filePath);
        
        return {
          file: relativePath,
          line: lineNumber,
          function: functionName
        };
      }
    }
    
    return { file: 'unknown', line: 0, function: 'unknown' };
  }

  private async log(
    level: LogLevel,
    message: string,
    data?: LogData,
    variables?: LogVariables,
    context?: LogContext,
    error?: Error,
    isSystem: boolean = true
  ) {
    const callerInfo = this.getCallerInfo();
    const timestamp = new Date();

    const logEntry = {
      level,
      service: this.serviceName,
      module: this.moduleName || callerInfo.file,
      message,
      timestamp,
      userId: context?.userId,
      action: context?.action,
      method: context?.method,
      path: context?.path,
      statusCode: context?.statusCode,
      duration: context?.duration,
      ip: context?.ip,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...error
      } : undefined,
      stack: error?.stack,
      data: data ? {
        ...data,
        _caller: callerInfo
      } : { _caller: callerInfo },
      variables,
      isSystem
    };

    try {
      const savedLog = await this.prisma.systemLog.create({
        data: logEntry
      });
      
      // Emit to WebSocket clients
      try {
        // Lazy import to avoid circular dependency
        const globalModule = await import('../webserver/global');
        if (globalModule && globalModule.getGlobalIO) {
          const io = globalModule.getGlobalIO();
          if (io) {
            // Emit to all logs room
            io.to('logs:all').emit('logs:new', savedLog);
            
            // Emit to service-specific room if applicable
            if (savedLog.service) {
              io.to(`logs:${savedLog.service}`).emit('logs:new', savedLog);
            }
          }
        }
      } catch (error) {
        // Ignore errors if WebSocket server is not initialized yet
      }
    } catch (dbError) {
      console.error('Failed to write log to database:', dbError);
      console.log(JSON.stringify(logEntry, null, 2));
    }
  }

  debug(message: string, data?: LogData, variables?: LogVariables) {
    return this.log(LogLevel.DEBUG, message, data, variables);
  }

  info(message: string, data?: LogData, variables?: LogVariables) {
    return this.log(LogLevel.INFO, message, data, variables);
  }

  warn(message: string, data?: LogData, variables?: LogVariables) {
    return this.log(LogLevel.WARN, message, data, variables);
  }

  error(message: string, error?: Error | unknown, data?: LogData, variables?: LogVariables) {
    const err = error instanceof Error ? error : new Error(String(error));
    return this.log(LogLevel.ERROR, message, data, variables, undefined, err);
  }

  fatal(message: string, error?: Error | unknown, data?: LogData, variables?: LogVariables) {
    const err = error instanceof Error ? error : new Error(String(error));
    return this.log(LogLevel.FATAL, message, data, variables, undefined, err);
  }

  userAction(
    message: string,
    context: LogContext,
    data?: LogData,
    variables?: LogVariables
  ) {
    return this.log(LogLevel.INFO, message, data, variables, context, undefined, false);
  }

  async getLogs(filters?: {
    level?: LogLevel;
    service?: string;
    module?: string;
    userId?: string;
    isSystem?: boolean;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.level) where.level = filters.level;
    if (filters?.service) where.service = filters.service;
    if (filters?.module) where.module = filters.module;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.isSystem !== undefined) where.isSystem = filters.isSystem;
    
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    if (filters?.search) {
      where.OR = [
        { message: { contains: filters.search } },
        { service: { contains: filters.search } },
        { module: { contains: filters.search } },
        { action: { contains: filters.search } }
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0
      }),
      this.prisma.systemLog.count({ where })
    ]);

    return { logs, total };
  }

  async getServices() {
    const services = await this.prisma.systemLog.groupBy({
      by: ['service'],
      _count: {
        service: true
      }
    });

    return services.map(s => ({
      name: s.service,
      count: s._count.service
    }));
  }

  async cleanOldLogs(daysToKeep: number = 1): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await this.prisma.systemLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });
    
    return result.count;
  }
}

export function createLogger(serviceName: string, moduleName?: string): Logger {
  return new Logger(serviceName, moduleName);
}

export default Logger;