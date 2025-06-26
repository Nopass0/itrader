import { PrismaClient } from '../../generated/prisma';
import { createLogger } from '../logger';

const logger = createLogger('AnalyticsService');
const prisma = new PrismaClient();

export interface AnalyticsData {
  // Volume metrics
  totalRevenueUSDT: number; // Total USDT received on Gate (валовая выручка)
  totalExpenseUSDT: number; // Total USDT spent on Bybit (валовый расход)
  grossProfitUSDT: number; // Revenue - Expense (валовая прибыль)
  spreadPercentage: number; // ((Revenue * 100 / Expense) - 100)
  averageSpreadUSDT: number; // Average spread in USDT per transaction
  
  // Average order metrics
  averageOrderValueRUB: number;
  averageOrderValueUSDT: number;
  
  // Order counts
  publishedAdvertisements: number; // Total ads published (опубликованные заявки)
  totalOrders: number; // Total orders created (ордера на которые откликнулись)
  cancelledOrders: number; // Cancelled orders (отмененные заявки)
  completedOrdersGate: number; // Completed on Gate
  completedOrdersBybit: number; // Completed on Bybit
  
  // Time period
  startDate: Date;
  endDate: Date;
}

export interface TransactionAnalytics {
  transactionId: string;
  spreadUSDT: number;
  spreadPercentage: number;
  profitUSDT: number;
  exchangeRate: number;
}

export class AnalyticsService {
  async getAnalytics(startDate: Date, endDate: Date): Promise<AnalyticsData> {
    try {
      logger.info('Fetching analytics data', { startDate, endDate });
      
      // Get ALL transactions first to debug
      const allTransactions = await prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          payout: true,
          advertisement: true
        }
      });
      
      logger.info('All transactions count:', allTransactions.length);
      logger.info('Transaction statuses:', allTransactions.map(tx => ({ id: tx.id, status: tx.status, hasPayoutId: !!tx.payoutId })));
      
      // Get Gate transactions (revenue) - all payouts with status 7
      const gateTransactionsWithCompletedPayouts = allTransactions.filter(tx => {
        return tx.payout && tx.payout.status === 7;
      });
      
      logger.info('Gate transactions (payout status 7):', gateTransactionsWithCompletedPayouts.length);
      
      // Get Bybit transactions (expense) - all transactions with status completed
      const bybitTransactions = allTransactions.filter(tx => {
        return tx.status === 'completed';
      });
      
      logger.info('Bybit transactions count:', bybitTransactions.length);
      
      // Calculate total revenue (Gate USDT received) - only from completed payouts
      const totalRevenueUSDT = gateTransactionsWithCompletedPayouts.reduce((sum, tx) => {
        if (tx.payout?.amount) {
          // If payout has direct amount in USDT
          return sum + tx.payout.amount;
        } else if (tx.payout?.amountTrader && typeof tx.payout.amountTrader === 'object') {
          // amountTrader is a JSON object with currency codes as keys
          // "000001" is USDT, "643" is RUB
          const amountTrader = tx.payout.amountTrader as Record<string, number>;
          const usdtAmount = amountTrader['000001'] || 0;
          logger.debug('Gate transaction USDT amount from amountTrader:', { 
            transactionId: tx.id, 
            amountTrader, 
            usdtAmount 
          });
          return sum + usdtAmount;
        }
        return sum;
      }, 0);
      
      // Calculate total expense (Bybit USDT spent) - all completed transactions
      const totalExpenseUSDT = bybitTransactions.reduce((sum, tx) => {
        // Use transaction amount in RUB and convert to USDT
        if (tx.amount && tx.advertisement?.price) {
          const exchangeRate = parseFloat(tx.advertisement.price) || 95;
          const usdtAmount = tx.amount / exchangeRate;
          logger.debug('Bybit transaction expense:', { 
            transactionId: tx.id, 
            amountRUB: tx.amount,
            exchangeRate,
            usdtAmount 
          });
          return sum + usdtAmount;
        } else if (tx.amount) {
          // Fallback - use default exchange rate
          const usdtAmount = tx.amount / 95;
          return sum + usdtAmount;
        }
        return sum;
      }, 0);
      
      // Calculate gross profit
      const grossProfitUSDT = totalRevenueUSDT - totalExpenseUSDT;
      
      // Calculate spread percentage using the formula: (Revenue * 100 / Expense) - 100
      const spreadPercentage = totalExpenseUSDT > 0 
        ? ((totalRevenueUSDT * 100 / totalExpenseUSDT) - 100)
        : 0;
      
      // Calculate average spread in USDT
      const completedTransactions = Math.min(gateTransactionsWithCompletedPayouts.length, bybitTransactions.length);
      const averageSpreadUSDT = completedTransactions > 0 
        ? grossProfitUSDT / completedTransactions 
        : 0;
      
      // Calculate average order value - use ALL successful transactions
      const allSuccessfulTransactions = allTransactions.filter(tx => 
        tx.status === 'completed' || 
        tx.status === 'check_received' ||
        tx.status === 'payment_received' ||
        (tx.payout && (tx.payout.status === 5 || tx.payout.status === 7))
      );
      
      const totalOrdersRUB = allSuccessfulTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const totalOrdersUSDT = allSuccessfulTransactions.reduce((sum, tx) => {
        if (tx.payout?.amount) {
          // Gate transaction with USDT amount
          return sum + tx.payout.amount;
        } else if (tx.payout?.amountTrader && typeof tx.payout.amountTrader === 'object') {
          // Gate transaction with amountTrader
          const amountTrader = tx.payout.amountTrader as Record<string, number>;
          const usdtAmount = amountTrader['000001'] || 0;
          return sum + usdtAmount;
        } else if (tx.amount && tx.advertisement?.price) {
          // Bybit transaction - convert RUB to USDT using advertisement price
          const exchangeRate = parseFloat(tx.advertisement.price) || 95;
          return sum + (tx.amount / exchangeRate);
        } else if (tx.amount) {
          // Fallback - use default exchange rate
          return sum + (tx.amount / 95);
        }
        return sum;
      }, 0);
      
      const averageOrderValueRUB = allSuccessfulTransactions.length > 0 
        ? totalOrdersRUB / allSuccessfulTransactions.length 
        : 0;
      const averageOrderValueUSDT = allSuccessfulTransactions.length > 0
        ? totalOrdersUSDT / allSuccessfulTransactions.length
        : 0;
      
      // Get advertisement counts
      const advertisements = await prisma.advertisement.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      // Count cancelled orders
      const cancelledOrders = allTransactions.filter(tx => 
        tx.status === 'cancelled' || 
        tx.status === 'failed' ||
        tx.status === 'cancelled_by_counterparty'
      ).length;
      
      // Count completed orders by platform
      // For Gate - count payouts with status 7
      const completedOrdersGate = gateTransactionsWithCompletedPayouts.length;
      // For Bybit - count all completed transactions
      const completedOrdersBybit = bybitTransactions.length;
      
      logger.info('Analytics summary:', {
        totalTransactions: allTransactions.length,
        gateCompletedPayouts: gateTransactionsWithCompletedPayouts.length,
        bybitTransactions: bybitTransactions.length,
        cancelledOrders,
        totalRevenueUSDT,
        totalExpenseUSDT,
        grossProfitUSDT,
        spreadPercentage,
        averageOrderValueRUB,
        averageOrderValueUSDT
      });
      
      return {
        totalRevenueUSDT,
        totalExpenseUSDT,
        grossProfitUSDT,
        spreadPercentage,
        averageSpreadUSDT,
        averageOrderValueRUB,
        averageOrderValueUSDT,
        publishedAdvertisements: advertisements.length,
        totalOrders: allTransactions.length,
        cancelledOrders,
        completedOrdersGate,
        completedOrdersBybit,
        startDate,
        endDate
      };
    } catch (error) {
      logger.error('Failed to get analytics', error);
      throw error;
    }
  }
  
  async getTransactionAnalytics(transactionId: string): Promise<TransactionAnalytics | null> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          payout: true
        }
      });
      
      if (!transaction || transaction.status !== 'completed') {
        return null;
      }
      
      // For transactions with payouts (Gate), calculate spread
      if (transaction.payout) {
        const revenueUSDT = transaction.payout.amount || 0;
        // Estimate expense based on transaction amount and rate
        const exchangeRate = 95; // Default rate, should get from system
        const expenseUSDT = transaction.amount / exchangeRate;
        const spreadUSDT = revenueUSDT - expenseUSDT;
        const spreadPercentage = expenseUSDT > 0
          ? ((revenueUSDT * 100 / expenseUSDT) - 100)
          : 0;
        
        return {
          transactionId,
          spreadUSDT,
          spreadPercentage,
          profitUSDT: spreadUSDT,
          exchangeRate: exchangeRate
        };
      }
      
      // For Bybit transactions, we need the corresponding Gate transaction
      // This is a simplified version - in reality you'd need to match transactions
      return {
        transactionId,
        spreadUSDT: 0,
        spreadPercentage: 0,
        profitUSDT: 0,
        exchangeRate: transaction.exchangeRate || 0
      };
    } catch (error) {
      logger.error('Failed to get transaction analytics', error);
      return null;
    }
  }
  
  async getHistoricalData(startDate: Date, endDate: Date, interval: 'hour' | 'day' | 'week' = 'day') {
    try {
      // This would return data points for charts
      // Implementation depends on your specific requirements
      const dataPoints = [];
      
      // Generate time intervals
      const current = new Date(startDate);
      while (current <= endDate) {
        const intervalEnd = new Date(current);
        if (interval === 'hour') {
          intervalEnd.setHours(intervalEnd.getHours() + 1);
        } else if (interval === 'day') {
          intervalEnd.setDate(intervalEnd.getDate() + 1);
        } else if (interval === 'week') {
          intervalEnd.setDate(intervalEnd.getDate() + 7);
        }
        
        const analytics = await this.getAnalytics(current, intervalEnd);
        dataPoints.push({
          timestamp: current.toISOString(),
          ...analytics
        });
        
        current.setTime(intervalEnd.getTime());
      }
      
      return dataPoints;
    } catch (error) {
      logger.error('Failed to get historical data', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();