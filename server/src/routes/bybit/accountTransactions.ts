import { PrismaClient } from '@prisma/client';
import { BybitService } from '../../services/bybitService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /bybit/account/:account_id/transactions
 * @description Get transactions from a specific Bybit account
 * @param {Object} params - URL parameters
 * @param {number} params.account_id - Account ID
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=50] - Items per page
 * @query {string} [query.category=spot] - Category (spot, linear, etc.)
 * @query {string} [query.symbol] - Symbol filter (e.g., BTCUSDT)
 * @returns {Object} Response - Paginated transactions
 */
export async function accountTransactionsHandler({ params, query, set, isAuthenticated, user, isAdmin }: any) {
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
    
    // Get user with Bybit credentials
    const accountUser = await prisma.user.findUnique({
      where: {
        id: accountId,
      },
      include: {
        bybitCredentials: true,
      },
    });
    
    if (!accountUser || !accountUser.bybitCredentials) {
      set.status = 404;
      return {
        success: false,
        error: 'No Bybit credentials found for this account',
        data: null,
      };
    }
    
    // Parse query parameters
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const category = query.category || 'spot';
    const symbol = query.symbol;
    
    // Initialize Bybit service
    const bybitService = new BybitService();
    
    // Get order history for this account
    const transactions = await bybitService.getOrderHistory(
      accountId,
      category,
      symbol,
      limit
    );
    
    // Process transactions to unified format
    const processedTransactions = transactions.list.map((tx: any) => ({
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
      },
    }));
    
    return {
      success: true,
      data: {
        items: processedTransactions,
        meta: {
          page,
          limit,
          total: processedTransactions.length,
          has_next: transactions.nextPageCursor !== null,
          next_cursor: transactions.nextPageCursor,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Bybit account transactions error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}