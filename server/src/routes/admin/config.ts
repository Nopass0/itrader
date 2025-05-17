import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * @route GET /admin/config
 * @description Get server configuration information
 * @returns {Object} Response - Server configuration
 */
export async function configHandler({ set, isAuthenticated, isAdmin }: any) {
  try {
    // Only admin users can access server configuration
    if (!isAuthenticated || !isAdmin) {
      set.status = 403;
      return {
        success: false,
        error: 'Forbidden: Admin privileges required',
        data: null,
      };
    }
    
    // Return a safe subset of the configuration
    // Don't include sensitive information like secrets or tokens
    const safeConfig = {
      environment: config.environment,
      port: config.port,
      corsOrigins: config.corsOrigins,
      gatecx: {
        apiUrl: config.gatecx.apiUrl,
        // Don't include userAgent as it could be used for fingerprinting
      },
      bybit: {
        apiUrl: config.bybit.apiUrl,
        testnetApiUrl: config.bybit.testnetApiUrl,
        useTestnet: config.bybit.useTestnet,
        // Don't include recvWindow as it could be used for timing attacks
      },
      logger: {
        level: config.logger.level,
      },
      sessionRefreshInterval: config.sessionRefreshInterval,
    };
    
    return {
      success: true,
      data: safeConfig,
      error: null,
    };
  } catch (error) {
    logger.error('Admin config error:', error);
    set.status = 500;
    return {
      success: false,
      error: 'Internal server error',
      data: null,
    };
  }
}