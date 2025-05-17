import { PrismaClient } from '@prisma/client';
import { BybitService } from '../../services/bybitService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /bybit/transactions
 * @description Get transactions from all Bybit accounts
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=50] - Items per page
 * @query {string} [query.status] - Comma-separated status values
 * @query {string} [query.transaction_id] - Transaction ID filter
 * @query {string} [query.category=spot] - Category (spot, linear, etc.)
 * @query {string} [query.symbol] - Symbol filter (e.g., BTCUSDT)
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
    const limit = Number(query.limit) || 50;
    const category = query.category || 'spot';
    const symbol = query.symbol;
    const transactionId = query.transaction_id;
    
    // Get all users with Bybit credentials
    const users = await prisma.user.findMany({
      where: {
        bybitCredentials: {
          isNot: null,
        },
      },
      include: {
        bybitCredentials: true,
      },
    });
    
    // If no users with Bybit credentials, return empty result
    if (users.length === 0) {
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
    
    // Initialize Bybit service
    const bybitService = new BybitService();
    
    // Collect transactions from all users
    let allTransactions: any[] = [];
    let allCursors: Record<number, string> = {};
    
    for (const user of users) {
      try {
        // Skip users without credentials
        if (!user.bybitCredentials) continue;
        
        // Get cursor for this user's page if it exists
        const cursor = allCursors[user.id];
        
        // Get transactions for this user
        const userTransactions = await bybitService.getOrderHistory(
          user.id,
          category,
          symbol,
          limit,
          cursor
        );
        
        // Save cursor for next page
        if (userTransactions.nextPageCursor) {
          allCursors[user.id] = userTransactions.nextPageCursor;
        }
        
        // Filter by transaction ID if provided
        let filteredTransactions = userTransactions.list;
        if (transactionId) {
          filteredTransactions = userTransactions.list.filter(
            (tx: any) => tx.orderId === transactionId
          );
        }
        
        // Process transactions to add user context and transform to unified format
        const processedTransactions = filteredTransactions.map((tx: any) => ({
          id: tx.orderId,
          status: bybitService.transformStatus(tx.orderStatus),
          amount: {
            trader: {
              [tx.symbol.replace(/USDT$/, '')]: Number(tx.qty),
            },
          },
          created_at: new Date(Number(tx.createdTime)).toISOString(),
          updated_at: new Date(Number(tx.updatedTime)).toISOString(),
          additional_fields: {
            symbol: tx.symbol,
            side: tx.side,
            order_type: tx.orderType,
            price: tx.price,
            exec_price: tx.execPrice,
            exec_qty: tx.execQty,
            exec_fee: tx.execFee,
            original_data: tx,
            user_id: user.id,
            user_name: user.username,
          },
        }));
        
        allTransactions = [...allTransactions, ...processedTransactions];
      } catch (error) {
        logger.error(`Error getting Bybit transactions for user ${user.id}:`, error);
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
    logger.error('Bybit transactions error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}