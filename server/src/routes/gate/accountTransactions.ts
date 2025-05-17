import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/account/:account_id/transactions
 * @description Get transactions from a specific Gate.cx account
 * @param {Object} params - URL parameters
 * @param {number} params.account_id - Account ID
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=10] - Items per page
 * @query {string} [query.status] - Comma-separated status IDs
 * @query {string} [query.transaction_id] - Transaction ID filter
 * @query {string} [query.wallet] - Wallet filter
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
    
    // Check if the account exists and has an active Gate.cx session
    const session = await prisma.gateSession.findFirst({
      where: {
        userId: accountId,
        isActive: true,
      },
    });
    
    if (!session) {
      set.status = 404;
      return {
        success: false,
        error: 'No active Gate.cx session found for this account',
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
    
    // Initialize Gate service
    const gateService = new GateService();
    
    // Get transactions with filters
    const filters: any = {};
    
    if (statusFilters.length > 0) {
      filters.status = statusFilters;
    }
    
    if (wallet) {
      filters.walletId = wallet;
    }
    
    // Get transactions for this account
    const transactions = await gateService.getTransactions(
      accountId,
      page,
      filters
    );
    
    // Process the response for API format
    const processedTransactions = transactions.data.map((tx: any) => ({
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
      },
    }));
    
    // Filter by transaction ID if provided
    let filteredTransactions = processedTransactions;
    if (transactionId) {
      filteredTransactions = processedTransactions.filter(
        (tx: any) => tx.id.toString() === transactionId
      );
    }
    
    return {
      success: true,
      data: {
        items: filteredTransactions,
        meta: {
          page,
          limit,
          total: transactions.total,
          has_next: transactions.next_page_url !== null,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Gate.cx account transactions error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}