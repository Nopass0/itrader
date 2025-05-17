import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/accounts
 * @description Get all Gate.cx accounts
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @returns {Object} Response - List of Gate.cx accounts
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
    
    // Get all users with Gate.cx credentials
    const users = await prisma.user.findMany({
      where: {
        gateCredentials: {
          isNot: null,
        },
      },
      include: {
        gateCredentials: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        gateSessions: {
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
      email: user.gateCredentials?.email,
      hasActiveSession: user.gateSessions.length > 0,
      session: user.gateSessions[0] || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    return {
      success: true,
      data: accounts,
      error: null,
    };
  } catch (error) {
    logger.error('Gate.cx accounts error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}