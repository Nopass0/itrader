/**
 * Middleware аутентификации для Socket.IO
 */

import type { Socket } from 'socket.io';
import { AuthManager } from '../auth/authManager';
import type { AuthenticatedSocket } from '../types';
import { createLogger } from '../../logger';

const authManager = new AuthManager();
const logger = createLogger('AuthMiddleware');

/**
 * Middleware для проверки аутентификации
 */
export async function authMiddleware(
  socket: Socket, 
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const account = await authManager.verifyToken(token);
    if (!account) {
      return next(new Error('Invalid or expired token'));
    }

    // Добавляем данные пользователя в socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = account.id;
    authSocket.accountId = account.id;
    authSocket.role = account.role;

    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
}

/**
 * Проверяет роль пользователя
 */
export function requireRole(roles: string[]) {
  return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    if (!socket.role || !roles.includes(socket.role)) {
      return next(new Error('Insufficient permissions'));
    }
    next();
  };
}

/**
 * Middleware для отдельных событий - проверяет аутентификацию
 */
export function requireAuth(handler: Function) {
  return async (socket: Socket, ...args: any[]) => {
    logger.debug('Checking authentication', { socketId: socket.id });
    
    // Check if socket already has auth info (from connection middleware)
    const authSocket = socket as AuthenticatedSocket;
    if (authSocket.userId) {
      logger.debug('Socket already authenticated', { userId: authSocket.userId, socketId: socket.id });
      return handler(authSocket, ...args);
    }
    
    // Check if socket and handshake exist
    if (!socket || !socket.handshake) {
      logger.error('Invalid socket or handshake', { socketId: socket?.id });
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid socket connection'
          }
        });
      }
      return;
    }
    
    // Otherwise, check auth from handshake
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    logger.debug('Token from handshake', { hasToken: !!token, socketId: socket.id });
    
    if (!token) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }
      return;
    }
    
    try {
      logger.debug('Verifying token', { socketId: socket.id });
      const account = await authManager.verifyToken(token);
      if (!account) {
        logger.error('Token verification failed - no account', { socketId: socket.id });
        throw new Error('Invalid token');
      }
      
      logger.debug('Token verified', { username: account.username, role: account.role, userId: account.id, socketId: socket.id });
      
      // Set auth info on socket for future requests
      authSocket.userId = account.id;
      authSocket.accountId = account.id;
      authSocket.role = account.role;
      
      return handler(authSocket, ...args);
    } catch (error) {
      logger.error('Token verification error', { error: error.message, socketId: socket.id });
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return callback({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }
      return;
    }
  };
}

/**
 * Middleware для отдельных событий - проверяет роль
 */
export function requireEventRole(roles: string[]) {
  return (handler: Function) => {
    return requireAuth(async (socket: AuthenticatedSocket, ...args: any[]) => {
      if (!socket.role || !roles.includes(socket.role)) {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions'
            }
          });
        }
        return;
      }

      return handler(socket, ...args);
    });
  };
}

/**
 * Обработчик ошибок
 */
export function handleError(error: any, callback?: Function) {
  logger.error('WebServer error', { error: error.message, stack: error.stack });

  const response = {
    success: false as const,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };

  if (callback && typeof callback === 'function') {
    callback(response);
  }

  return response;
}

/**
 * Обработчик успешного ответа
 */
export function handleSuccess(data?: any, message?: string, callback?: Function) {
  const response = {
    success: true as const,
    data,
    message
  };

  if (callback && typeof callback === 'function') {
    callback(response);
  }

  return response;
}