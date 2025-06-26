// Frontend logger service
export function createLogger(service: string, module?: string) {
  const log = (level: string, message: string, data?: any, variables?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      level,
      service,
      module,
      message,
      timestamp,
      data,
      variables,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const color = getConsoleColor(level);
      console.log(
        `%c[${timestamp}] [${level}] [${service}${module ? `:${module}` : ''}] ${message}`,
        color,
        data || '',
        variables || ''
      );
    }

    // Send to backend via WebSocket if available
    if (typeof window !== 'undefined' && (window as any).socket?.connected) {
      (window as any).socket.emit('logs:create', {
        level,
        service,
        module,
        message,
        data,
        variables,
        isSystem: true,
      });
    }
  };

  return {
    debug: (message: string, data?: any, variables?: any) => 
      log('DEBUG', message, data, variables),
    
    info: (message: string, data?: any, variables?: any) => 
      log('INFO', message, data, variables),
    
    warn: (message: string, data?: any, variables?: any) => 
      log('WARN', message, data, variables),
    
    error: (message: string, error?: any, data?: any) => {
      const errorData = {
        ...data,
        error: error?.message || error,
        stack: error?.stack,
      };
      log('ERROR', message, errorData);
    },
    
    fatal: (message: string, error?: any, data?: any) => {
      const errorData = {
        ...data,
        error: error?.message || error,
        stack: error?.stack,
      };
      log('FATAL', message, errorData);
    },

    userAction: (
      message: string,
      actionData: {
        userId?: string;
        action?: string;
        method?: string;
        path?: string;
        statusCode?: number;
        duration?: number;
        ip?: string;
        userAgent?: string;
      },
      data?: any,
      variables?: any
    ) => {
      if (typeof window !== 'undefined' && (window as any).socket?.connected) {
        (window as any).socket.emit('logs:create', {
          level: 'INFO',
          service,
          module,
          message,
          ...actionData,
          data,
          variables,
          isSystem: false,
        });
      }
    },
  };
}

function getConsoleColor(level: string): string {
  switch (level) {
    case 'DEBUG':
      return 'color: #gray';
    case 'INFO':
      return 'color: #3b82f6';
    case 'WARN':
      return 'color: #f59e0b';
    case 'ERROR':
      return 'color: #ef4444';
    case 'FATAL':
      return 'color: #dc2626; font-weight: bold';
    default:
      return 'color: #6b7280';
  }
}