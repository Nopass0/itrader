import { Socket } from 'socket.io';
import { analyticsService } from '../../services/analyticsService';
import { createLogger } from '../../logger';

const logger = createLogger('AnalyticsController');

export function setupAnalyticsHandlers(socket: Socket) {
  // Get analytics for a date range
  socket.on('analytics:get', async (data: { startDate: string; endDate: string }, callback) => {
    try {
      logger.info('Getting analytics', data);
      
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      
      const analytics = await analyticsService.getAnalytics(startDate, endDate);
      
      logger.info('Analytics result:', {
        totalRevenueUSDT: analytics.totalRevenueUSDT,
        totalExpenseUSDT: analytics.totalExpenseUSDT,
        completedOrdersGate: analytics.completedOrdersGate,
        completedOrdersBybit: analytics.completedOrdersBybit,
        totalOrders: analytics.totalOrders
      });
      
      callback({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      logger.error('Failed to get analytics', error);
      callback({
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error.message
        }
      });
    }
  });
  
  // Get historical data for charts
  socket.on('analytics:getHistorical', async (data: { 
    startDate: string; 
    endDate: string;
    interval?: 'hour' | 'day' | 'week';
  }, callback) => {
    try {
      logger.info('Getting historical analytics', data);
      
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const interval = data.interval || 'day';
      
      const historicalData = await analyticsService.getHistoricalData(startDate, endDate, interval);
      
      callback({
        success: true,
        data: historicalData
      });
    } catch (error: any) {
      logger.error('Failed to get historical analytics', error);
      callback({
        success: false,
        error: {
          code: 'HISTORICAL_ERROR',
          message: error.message
        }
      });
    }
  });
  
  // Get analytics for a specific transaction
  socket.on('analytics:getTransaction', async (data: { transactionId: string }, callback) => {
    try {
      logger.info('Getting transaction analytics', data);
      
      const analytics = await analyticsService.getTransactionAnalytics(data.transactionId);
      
      callback({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      logger.error('Failed to get transaction analytics', error);
      callback({
        success: false,
        error: {
          code: 'TRANSACTION_ANALYTICS_ERROR',
          message: error.message
        }
      });
    }
  });
}