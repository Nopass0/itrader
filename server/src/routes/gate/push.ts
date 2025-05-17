import { PrismaClient } from '@prisma/client';
import { GateService } from '../../services/gateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * @route GET /gate/push
 * @description Get push notifications from all Gate.cx accounts
 * @query {Object} query - Query parameters
 * @query {string} [query.token] - API token
 * @query {number} [query.page=1] - Page number
 * @query {number} [query.limit=10] - Items per page
 * @query {number} [query.status] - Status filter
 * @returns {Object} Response - Paginated push notifications
 */
export async function pushHandler({ query, set, isAuthenticated, isAdmin }: any) {
  try {
    // Only admin users can access all push notifications
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
    
    // Collect push notifications from all users
    let allPushNotifications: any[] = [];
    
    for (const session of sessions) {
      try {
        // Get push notifications for this user
        const userPushNotifications = await gateService.getPushNotifications(
          session.userId,
          page,
          status
        );
        
        // Process push notifications to add user context
        const processedPushNotifications = userPushNotifications.data.map((push: any) => ({
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
            user_id: session.userId,
            user_name: session.user.username,
          },
        }));
        
        allPushNotifications = [...allPushNotifications, ...processedPushNotifications];
      } catch (error) {
        logger.error(`Error getting Gate.cx push notifications for user ${session.userId}:`, error);
        // Continue with next user
      }
    }
    
    // Sort push notifications by received_at date in descending order
    allPushNotifications.sort((a, b) => {
      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPushNotifications = allPushNotifications.slice(startIndex, endIndex);
    
    // Calculate pagination metadata
    const totalItems = allPushNotifications.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    
    return {
      success: true,
      data: {
        items: paginatedPushNotifications,
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
    logger.error('Gate.cx push notifications error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}