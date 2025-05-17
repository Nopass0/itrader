import { Elysia } from 'elysia';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Authentication middleware for Elysia
export const authMiddleware = new Elysia()
  .onError(({ code, error, set }) => {
    logger.error(`Auth middleware error ${code}:`, error);

    // Handle different error types
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        success: false,
        error: 'Route not found',
        code
      };
    } else if (code === 'VALIDATION') {
      set.status = 400;
    } else {
      set.status = 500;
    }

    return {
      success: false,
      error: error.message || 'Internal server error',
      code
    };
  })
  .derive(async ({ jwt, headers, path, request }) => {
    // Skip authentication for certain paths
    const publicPaths = [
      '/',
      '/health',
      '/auth/login',
      '/auth/register',
    ];

    // Allow all Swagger-related paths
    if (path.startsWith('/swagger') ||
        path.startsWith('/docs') ||
        path.includes('swagger') ||
        path.includes('openapi.json')) {
      logger.debug(`Allowing access to API docs path: ${path}`);
      return {
        user: null,
        isAuthenticated: true, // Mark as authenticated to avoid the auth check
        isSwagger: true
      };
    }

    // Check if we're in mock mode (for testing)
    const useMockData = process.env.USE_MOCK_DATA === 'true';

    if (useMockData) {
      logger.info(`Using mock authentication for path: ${path}`);
      return {
        user: { id: 0, username: 'mock_user', role: 'admin' },
        isAuthenticated: true,
        isAdmin: true,
        isMock: true,
      };
    }

    // Check if path starts with any public path
    const isPublicPath = publicPaths.some(publicPath =>
      path === publicPath ||
      (publicPath !== '/' && path.startsWith(publicPath))
    );

    if (isPublicPath) {
      logger.debug(`Access to public path: ${path}`);
      return {
        user: null,
        isAuthenticated: true, // Mark as authenticated to avoid the auth check
      };
    }

    // Check for token in different places
    let token: string | null = null;

    // 1. Authorization header (Bearer token)
    const authHeader = headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      logger.debug('Token found in Authorization header');
    }

    // 2. X-API-Token header
    if (!token && headers['x-api-token']) {
      token = headers['x-api-token'];
      logger.debug('Token found in X-API-Token header');
    }

    // 3. Token query parameter
    if (!token && headers.url) {
      try {
        const url = new URL(headers.url);
        token = url.searchParams.get('token');
        if (token) {
          logger.debug('Token found in query parameter');
        }
      } catch (error) {
        logger.warn(`Error parsing URL from headers: ${error}`);
      }
    }

    // 4. Admin token from config for special access
    const adminToken = config.adminToken;
    const isAdminToken = adminToken && token === adminToken;

    // 5. Development mode - if no token and we're in development, allow access with admin privileges
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowDevAccess = isDevelopment && config.allowDevAccess === true;

    if (!token) {
      if (allowDevAccess) {
        logger.warn(`Development mode: Granting admin access to ${path} without token`);
        return {
          user: { id: 0, username: 'dev_admin', role: 'admin' },
          isAuthenticated: true,
          isAdmin: true,
          isDev: true,
        };
      }

      logger.info(`Access denied to ${path}: No token provided`);
      return {
        user: null,
        isAuthenticated: false,
      };
    }

    // For admin token, provide special admin access
    if (isAdminToken) {
      logger.info(`Admin token access to ${path}`);
      return {
        user: { id: 0, username: 'system', role: 'admin' },
        isAuthenticated: true,
        isAdmin: true,
      };
    }

    // Verify JWT token
    try {
      const payload = await jwt.verify(token);

      if (!payload || !payload.userId) {
        logger.warn(`Invalid JWT payload for path ${path}`);
        return {
          user: null,
          isAuthenticated: false,
        };
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: {
          id: payload.userId,
        },
      });

      if (!user) {
        logger.warn(`User not found for ID ${payload.userId}`);
        return {
          user: null,
          isAuthenticated: false,
        };
      }

      logger.info(`User ${user.username} (ID: ${user.id}) authenticated for ${path}`);
      return {
        user,
        isAuthenticated: true,
        isAdmin: false,
      };
    } catch (error) {
      logger.warn(`JWT verification failed: ${error}`);
      return {
        user: null,
        isAuthenticated: false,
      };
    }
  })
  .onBeforeHandle(({ isAuthenticated, isMock, isDev, path, set }) => {
    // Skip authentication check for mock mode or dev mode
    if (isMock || isDev) {
      return;
    }

    // If route requires authentication and user is not authenticated
    if (!isAuthenticated) {
      logger.warn(`Authentication required for path: ${path}`);
      set.status = 401;
      return {
        success: false,
        error: 'Unauthorized: Authentication required',
        data: null,
      };
    }
  });