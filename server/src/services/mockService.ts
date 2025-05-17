import { logger } from '../utils/logger';

/**
 * Mock service for testing purposes
 * This service provides mock data for testing when real external APIs are not available
 */
export class MockService {
  /**
   * Provides mock data for Gate.cx
   */
  static getMockGateData() {
    logger.info('Using mock data for Gate.cx');
    
    return {
      user: {
        id: 12345,
        name: 'Mock User',
        email: 'mock@example.com',
        role: 'trader',
        created_at: '2023-01-01T00:00:00.000000Z',
        updated_at: '2023-01-01T00:00:00.000000Z'
      },
      transactions: {
        data: Array(10).fill(null).map((_, i) => ({
          id: 100000 + i,
          status: [1, 2, 7][Math.floor(Math.random() * 3)],
          wallet: `1234567890${i}`,
          method: {
            id: 1,
            label: 'Bank Transfer'
          },
          amount: {
            trader: {
              '643': Math.random() * 10000
            }
          },
          total: {
            trader: {
              '643': Math.random() * 10000
            }
          },
          meta: {
            bank: 'Mock Bank',
            card_number: '1234 **** **** 5678'
          },
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          updated_at: new Date(Date.now() - i * 86400000).toISOString(),
          tooltip: 'Mock transaction'
        })),
        total: 100,
        current_page: 1,
        per_page: 10,
        last_page: 10,
        first_page_url: 'https://mock/api/v1/payments/payouts?page=1',
        last_page_url: 'https://mock/api/v1/payments/payouts?page=10',
        next_page_url: 'https://mock/api/v1/payments/payouts?page=2',
        prev_page_url: null,
        path: 'https://mock/api/v1/payments/payouts',
        from: 1,
        to: 10
      },
      sms: {
        data: Array(10).fill(null).map((_, i) => ({
          id: 200000 + i,
          from: '+7912345678' + i,
          text: `Mock SMS message ${i} with amount 1000р.`,
          status: 1,
          received_at: new Date(Date.now() - i * 86400000).toISOString(),
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          device: {
            id: 100 + i,
            name: 'Mock Device ' + i
          },
          parsed: {
            amount: 1000,
            currency: 'RUB',
            balance: 5000
          }
        })),
        total: 50,
        current_page: 1,
        per_page: 10,
        last_page: 5,
        first_page_url: 'https://mock/api/v1/devices/sms?page=1',
        last_page_url: 'https://mock/api/v1/devices/sms?page=5',
        next_page_url: 'https://mock/api/v1/devices/sms?page=2',
        prev_page_url: null,
        path: 'https://mock/api/v1/devices/sms',
        from: 1,
        to: 10
      },
      pushes: {
        data: Array(10).fill(null).map((_, i) => ({
          id: 300000 + i,
          package_name: 'ru.sberbankmobile',
          title: 'Mock Push',
          text: `Mock push notification ${i} with amount 1000р`,
          status: 1,
          received_at: new Date(Date.now() - i * 86400000).toISOString(),
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          device: {
            id: 100 + i,
            name: 'Mock Device ' + i
          },
          parsed: {
            amount: 1000,
            currency: 'RUB'
          }
        })),
        total: 50,
        current_page: 1,
        per_page: 10,
        last_page: 5,
        first_page_url: 'https://mock/api/v1/devices/pushes?page=1',
        last_page_url: 'https://mock/api/v1/devices/pushes?page=5',
        next_page_url: 'https://mock/api/v1/devices/pushes?page=2',
        prev_page_url: null,
        path: 'https://mock/api/v1/devices/pushes',
        from: 1,
        to: 10
      }
    };
  }
  
  /**
   * Provides mock data for Bybit
   */
  static getMockBybitData() {
    logger.info('Using mock data for Bybit');
    
    return {
      walletBalance: {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: [
            {
              accountType: 'UNIFIED',
              accountIMRate: '0.015',
              accountMMRate: '0.003',
              totalEquity: '10000',
              totalWalletBalance: '10000',
              totalMarginBalance: '10000',
              totalAvailableBalance: '10000',
              totalPerpUPL: '0',
              totalInitialMargin: '0',
              totalMaintenanceMargin: '0',
              coin: [
                {
                  coin: 'USDT',
                  equity: '10000',
                  walletBalance: '10000',
                  marginBalance: '10000',
                  availableBalance: '10000',
                  marginBalanceWithoutConvert: '10000',
                  availableBalanceWithoutConvert: '10000',
                  borrowAmount: '0',
                  unrealisedPnl: '0',
                  cumRealisedPnl: '0'
                }
              ]
            }
          ]
        }
      },
      orderHistory: {
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: Array(10).fill(null).map((_, i) => ({
            orderId: '1271059595344191' + i,
            orderLinkId: '1621845' + i,
            symbol: 'BTCUSDT',
            side: i % 2 === 0 ? 'Buy' : 'Sell',
            orderType: 'Market',
            price: '38000',
            qty: (0.001 + i * 0.0001).toString(),
            timeInForce: 'IOC',
            orderStatus: ['Filled', 'PartiallyFilled', 'Created'][Math.floor(Math.random() * 3)],
            execType: 'Trade',
            lastExecQty: (0.001 + i * 0.0001).toString(),
            execQty: (0.001 + i * 0.0001).toString(),
            execFee: (0.00000075 + i * 0.00000001).toString(),
            execPrice: '38000',
            leavesQty: '0',
            cumExecQty: (0.001 + i * 0.0001).toString(),
            cumExecValue: (38 + i * 0.38).toString(),
            cumExecFee: (0.00000075 + i * 0.00000001).toString(),
            createdTime: (1676360000000 + i * 100000).toString(),
            updatedTime: (1676360000500 + i * 100000).toString()
          })),
          nextPageCursor: 'page_cursor_string',
          category: 'spot'
        }
      },
      depositRecord: {
        retCode: 0,
        retMsg: 'OK',
        result: {
          rows: Array(5).fill(null).map((_, i) => ({
            id: '456' + i,
            coin: 'USDT',
            amount: '1000',
            status: 1,
            address: '0x123abc...',
            txID: 'tx_' + i,
            createTime: Date.now() - i * 86400000,
            network: 'ETH'
          })),
          nextPageCursor: 'mock_cursor'
        }
      },
      withdrawRecord: {
        retCode: 0,
        retMsg: 'OK',
        result: {
          rows: Array(5).fill(null).map((_, i) => ({
            id: '789' + i,
            coin: 'USDT',
            amount: '500',
            status: 2,
            address: '0x123abc...',
            txID: 'tx_withdrawal_' + i,
            createTime: Date.now() - i * 86400000,
            network: 'ETH'
          })),
          nextPageCursor: 'mock_cursor'
        }
      }
    };
  }
}