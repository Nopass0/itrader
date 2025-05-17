import { PrismaClient } from '@prisma/client';
import { BybitService } from '../../services/bybitService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /bybit/account/:account_id
 * @description Get a specific Bybit account
 * @param {Object} params - URL parameters
 * @param {number} params.account_id - Account ID
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @returns {Object} Response - Bybit account details
 */
export async function accountHandler({ params, query, set, isAuthenticated, user, isAdmin }: any) {
  try {
    if (!isAuthenticated) {
      set.status = 401;
      return {
        success: false,
        error: 'Unauthorized: Authentication required',
        data: null,
      };
    }
    
    const accountId = Number(params.account_id);
    
    // Check if the user has access to this account
    if (!isAdmin && user.id !== accountId) {
      set.status = 403;
      return {
        success: false,
        error: 'Forbidden: Access denied to this account',
        data: null,
      };
    }
    
    // Get user with Bybit credentials and session
    const accountUser = await prisma.user.findUnique({
      where: {
        id: accountId,
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
            accountInfo: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    
    if (!accountUser) {
      set.status = 404;
      return {
        success: false,
        error: 'Account not found',
        data: null,
      };
    }
    
    // Check if the user has Bybit credentials
    if (!accountUser.bybitCredentials) {
      set.status = 404;
      return {
        success: false,
        error: 'No Bybit credentials found for this account',
        data: null,
      };
    }
    
    // Format the account data
    const accountData = {
      id: accountUser.id,
      username: accountUser.username,
      apiKey: `${accountUser.bybitCredentials.apiKey.substring(0, 4)}...${accountUser.bybitCredentials.apiKey.substring(accountUser.bybitCredentials.apiKey.length - 4)}`,
      hasActiveSession: accountUser.bybitSessions.length > 0,
      session: accountUser.bybitSessions[0] ? {
        id: accountUser.bybitSessions[0].id,
        isActive: accountUser.bybitSessions[0].isActive,
        createdAt: accountUser.bybitSessions[0].createdAt,
        updatedAt: accountUser.bybitSessions[0].updatedAt,
      } : null,
      accountInfo: accountUser.bybitSessions[0] ? accountUser.bybitSessions[0].accountInfo : null,
      createdAt: accountUser.createdAt,
      updatedAt: accountUser.updatedAt,
    };
    
    return {
      success: true,
      data: accountData,
      error: null,
    };
  } catch (error) {
    logger.error('Bybit account error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}