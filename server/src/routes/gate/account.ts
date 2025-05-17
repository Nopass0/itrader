import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/account/:account_id
 * @description Get a specific Gate.cx account
 * @param {Object} params - URL parameters
 * @param {number} params.account_id - Account ID
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @returns {Object} Response - Gate.cx account details
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
    
    // Get user with Gate.cx credentials and session
    const accountUser = await prisma.user.findUnique({
      where: {
        id: accountId,
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
    
    if (!accountUser) {
      set.status = 404;
      return {
        success: false,
        error: 'Account not found',
        data: null,
      };
    }
    
    // Check if the user has Gate.cx credentials
    if (!accountUser.gateCredentials) {
      set.status = 404;
      return {
        success: false,
        error: 'No Gate.cx credentials found for this account',
        data: null,
      };
    }
    
    // Try to get user info from Gate.cx if there's an active session
    let gateUserInfo = null;
    if (accountUser.gateSessions.length > 0) {
      try {
        const gateService = new GateService();
        gateUserInfo = await gateService.getUserInfo(accountId);
      } catch (error) {
        logger.warn(`Failed to get Gate.cx user info for account ${accountId}:`, error);
        // Continue without Gate.cx user info
      }
    }
    
    // Format the account data
    const accountData = {
      id: accountUser.id,
      username: accountUser.username,
      email: accountUser.gateCredentials.email,
      hasActiveSession: accountUser.gateSessions.length > 0,
      session: accountUser.gateSessions[0] || null,
      gateUserInfo: gateUserInfo,
      createdAt: accountUser.createdAt,
      updatedAt: accountUser.updatedAt,
    };
    
    return {
      success: true,
      data: accountData,
      error: null,
    };
  } catch (error) {
    logger.error('Gate.cx account error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}