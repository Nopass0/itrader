import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/transactions
 * @description Get transactions from all Gate.cx accounts
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=10] - Items per page
 * @query {string} [query.status] - Comma-separated status IDs
 * @query {string} [query.transaction_id] - Transaction ID filter
 * @query {string} [query.wallet] - Wallet filter
 * @returns {Object} Response - Paginated transactions
 */
export async function transactionsHandler({ query, set, isAuthenticated, isAdmin }: any) {
  try {
    // Only admin users can access all transactions
    if (!isAuthenticated || !isAdmin) {
      set.status = 403;
      return {
        success: false,
        error: 'Forbidden: Admin privileges required',
        data: null,
      };
    }
    
    // Parse query parameters
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const statusString = query.status || '';
    const transactionId = query.transaction_id;
    const wallet = query.wallet;
    
    // Parse status array if provided
    let statusFilters: number[] = [];
    if (statusString) {
      statusFilters = statusString.split(',').map(Number).filter(Boolean);
    }
    
    // Get all users with Gate.cx sessions
    const sessions = await prisma.gateSession.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: true,
      },
    });
    
    // If no sessions, return empty result
    if (sessions.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          meta: {
            page,
            limit,
            total: 0,
            has_next: false,
          },
        },
        error: null,
      };
    }
    
    // Initialize Gate service
    const gateService = new GateService();
    
    // Collect transactions from all users
    let allTransactions: any[] = [];
    
    for (const session of sessions) {
      try {
        const filters: any = {};
        
        if (statusFilters.length > 0) {
          filters.status = statusFilters;
        }
        
        if (wallet) {
          filters.walletId = wallet;
        }
        
        // Get transactions for this user
        const userTransactions = await gateService.getTransactions(
          session.userId,
          page,
          filters
        );
        
        // Process transactions to add user context
        const processedTransactions = userTransactions.data.map((tx: any) => ({
          id: tx.id,
          status: tx.status,
          amount: tx.amount,
          created_at: tx.created_at,
          updated_at: tx.updated_at,
          additional_fields: {
            wallet: tx.wallet,
            method: tx.method,
            total: tx.total,
            meta: tx.meta,
            user_id: session.userId,
            user_name: session.user.username,
          },
        }));
        
        // Filter by transaction ID if provided
        if (transactionId) {
          const filteredTransactions = processedTransactions.filter(
            (tx: any) => tx.id.toString() === transactionId
          );
          allTransactions = [...allTransactions, ...filteredTransactions];
        } else {
          allTransactions = [...allTransactions, ...processedTransactions];
        }
      } catch (error) {
        logger.error(`Error getting Gate.cx transactions for user ${session.userId}:`, error);
        // Continue with next user
      }
    }
    
    // Sort transactions by created_at date in descending order
    allTransactions.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTransactions = allTransactions.slice(startIndex, endIndex);
    
    // Calculate pagination metadata
    const totalItems = allTransactions.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    
    return {
      success: true,
      data: {
        items: paginatedTransactions,
        meta: {
          page,
          limit,
          total: totalItems,
          has_next: hasNextPage,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Gate.cx transactions error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}