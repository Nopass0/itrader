import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /bybit/accounts
 * @description Get all Bybit accounts
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @returns {Object} Response - List of Bybit accounts
 */
export async function accountsHandler({ query, set, isAuthenticated, isAdmin }: any) {
  try {
    // Only admin users can access all accounts
    if (!isAuthenticated || !isAdmin) {
      set.status = 403;
      return {
        success: false,
        error: 'Forbidden: Admin privileges required',
        data: null,
      };
    }
    
    // Get all users with Bybit credentials
    const users = await prisma.user.findMany({
      where: {
        bybitCredentials: {
          isNot: null,
        },
      },
      include: {
        bybitCredentials: {
          select: {
            id: true,
            apiKey: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        bybitSessions: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    
    // Format the response data
    const accounts = users.map(user => ({
      id: user.id,
      username: user.username,
      apiKey: `${user.bybitCredentials?.apiKey.substring(0, 4)}...${user.bybitCredentials?.apiKey.substring(user.bybitCredentials?.apiKey.length - 4)}`,
      hasActiveSession: user.bybitSessions.length > 0,
      session: user.bybitSessions[0] || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    return {
      success: true,
      data: accounts,
      error: null,
    };
  } catch (error) {
    logger.error('Bybit accounts error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}