import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/account/:account_id/sms
 * @description Get SMS messages from a specific Gate.cx account
 * @param {Object} params - URL parameters
 * @param {number} params.account_id - Account ID
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=10] - Items per page
 * @query {number} [query.status] - Status filter
 * @returns {Object} Response - Paginated SMS messages
 */
export async function accountSmsHandler({ params, query, set, isAuthenticated, user, isAdmin }: any) {
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
    const status = query.status ? Number(query.status) : undefined;
    
    // Initialize Gate service
    const gateService = new GateService();
    
    // Get SMS messages for this account
    const smsMessages = await gateService.getSmsMessages(
      accountId,
      page,
      status
    );
    
    // Process the response for API format
    const processedSmsMessages = smsMessages.data.map((sms: any) => ({
      id: sms.id,
      from: sms.from,
      text: sms.text,
      status: sms.status,
      received_at: sms.received_at,
      created_at: sms.created_at,
      device_id: sms.device.id,
      device_name: sms.device.name,
      additional_fields: {
        parsed: sms.parsed,
      },
    }));
    
    return {
      success: true,
      data: {
        items: processedSmsMessages,
        meta: {
          page,
          limit,
          total: smsMessages.total,
          has_next: smsMessages.next_page_url !== null,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Gate.cx account SMS messages error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}