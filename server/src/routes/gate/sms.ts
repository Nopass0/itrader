import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/sms
 * @description Get SMS messages from all Gate.cx accounts
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=10] - Items per page
 * @query {number} [query.status] - Status filter
 * @returns {Object} Response - Paginated SMS messages
 */
export async function smsHandler({ query, set, isAuthenticated, isAdmin }: any) {
  try {
    // Only admin users can access all SMS messages
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
    const status = query.status ? Number(query.status) : undefined;
    
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
    
    // Collect SMS messages from all users
    let allSmsMessages: any[] = [];
    
    for (const session of sessions) {
      try {
        // Get SMS messages for this user
        const userSmsMessages = await gateService.getSmsMessages(
          session.userId,
          page,
          status
        );
        
        // Process SMS messages to add user context
        const processedSmsMessages = userSmsMessages.data.map((sms: any) => ({
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
            user_id: session.userId,
            user_name: session.user.username,
          },
        }));
        
        allSmsMessages = [...allSmsMessages, ...processedSmsMessages];
      } catch (error) {
        logger.error(`Error getting Gate.cx SMS messages for user ${session.userId}:`, error);
        // Continue with next user
      }
    }
    
    // Sort SMS messages by received_at date in descending order
    allSmsMessages.sort((a, b) => {
      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedSmsMessages = allSmsMessages.slice(startIndex, endIndex);
    
    // Calculate pagination metadata
    const totalItems = allSmsMessages.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    
    return {
      success: true,
      data: {
        items: paginatedSmsMessages,
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
    logger.error('Gate.cx SMS messages error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}