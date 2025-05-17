import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/account/:account_id/push
 * @description Get push notifications from a specific Gate.cx account
 * @param {Object} params - URL parameters
 * @param {number} params.account_id - Account ID
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=10] - Items per page
 * @query {number} [query.status] - Status filter
 * @returns {Object} Response - Paginated push notifications
 */
export async function accountPushHandler({ params, query, set, isAuthenticated, user, isAdmin }: any) {
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
    
    // Get push notifications for this account
    const pushNotifications = await gateService.getPushNotifications(
      accountId,
      page,
      status
    );
    
    // Process the response for API format
    const processedPushNotifications = pushNotifications.data.map((push: any) => ({
      id: push.id,
      package_name: push.package_name,
      title: push.title,
      text: push.text,
      status: push.status,
      received_at: push.received_at,
      created_at: push.created_at,
      device_id: push.device.id,
      device_name: push.device.name,
      has_parsed_data: !!push.parsed,
      additional_fields: {
        parsed: push.parsed,
      },
    }));
    
    return {
      success: true,
      data: {
        items: processedPushNotifications,
        meta: {
          page,
          limit,
          total: pushNotifications.total,
          has_next: pushNotifications.next_page_url !== null,
        },
      },
      error: null,
    };
  } catch (error) {
    logger.error('Gate.cx account push notifications error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}