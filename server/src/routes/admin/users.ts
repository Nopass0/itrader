import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /admin/users
 * @description Get all users
 * @returns {Object} Response - List of users
 */
export async function usersHandler({ set, isAuthenticated, isAdmin }: any) {
  try {
    // Only admin users can access all users
    if (!isAuthenticated || !isAdmin) {
      set.status = 403;
      return {
        success: false,
        error: 'Forbidden: Admin privileges required',
        data: null,
      };
    }
    
    // Get all users with their credentials
    const users = await prisma.user.findMany({
      include: {
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
        gateCredentials: {
          select: {
            id: true,
            email: true,
          },
        },
        bybitCredentials: {
          select: {
            id: true,
            apiKey: true,
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
    
    // Format the user data to hide sensitive info
    const usersData = users.map(user => ({
      id: user.id,
      username: user.username,
      createdBy: {
        id: user.admin.id,
        username: user.admin.username,
      },
      gateCredentials: user.gateCredentials ? {
        id: user.gateCredentials.id,
        email: user.gateCredentials.email,
      } : null,
      bybitCredentials: user.bybitCredentials ? {
        id: user.bybitCredentials.id,
        apiKey: `${user.bybitCredentials.apiKey.substring(0, 4)}...${user.bybitCredentials.apiKey.substring(user.bybitCredentials.apiKey.length - 4)}`,
      } : null,
      sessions: {
        gate: user.gateSessions.length > 0,
        bybit: user.bybitSessions.length > 0,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    return {
      success: true,
      data: usersData,
      error: null,
    };
  } catch (error) {
    logger.error('Admin users error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}