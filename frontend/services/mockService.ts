import { User, Transaction, SmsMessage, PushNotification } from '@/types';

/**
 * Mock service for the frontend when API is offline
 * This provides mock data to ensure the app can work in development/demo mode
 */
export class MockService {
  /**
   * Mock login functionality
   * @param username Username for mock user
   * @param password Password (not validated in mock mode)
   */
  static async login(username: string, password: string): Promise<{ user: User; token: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Create mock user data
    const user: User = {
      id: 1,
      username: username
    };
    
    // Create a mock token
    const token = 'mock_token_' + Math.random().toString(36).substring(2, 15);
    
    return { user, token };
  }
  
  /**
   * Mock registration functionality
   * @param username Username for new user
   * @param password Password for new user
   * @param adminToken Admin token for authorization (only 'demo' is accepted in mock mode)
   */
  static async register(username: string, password: string, adminToken: string): Promise<{ success: boolean; message?: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Only accept 'demo' as a valid admin token in mock mode
    if (adminToken !== 'demo') {
      return {
        success: false,
        message: 'Неверный токен администратора. В демо-режиме используйте токен "demo"'
      };
    }
    
    return {
      success: true
    };
  }
  
  /**
   * Get mock transactions data
   */
  static getTransactions(): Transaction[] {
    return Array(10).fill(null).map((_, i) => ({
      id: 100000 + i,
      status: [1, 2, 7][Math.floor(Math.random() * 3)],
      amount: {
        trader: {
          '643': Math.random() * 10000
        }
      },
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      updated_at: new Date(Date.now() - i * 86400000).toISOString(),
      additional_fields: {
        wallet: `1234567890${i}`,
        method: {
          id: 1,
          label: 'Bank Transfer'
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
        user_id: 1,
        user_name: 'Demo User'
      }
    }));
  }
  
  /**
   * Get mock SMS messages
   */
  static getSmsMessages(): SmsMessage[] {
    return Array(10).fill(null).map((_, i) => ({
      id: 200000 + i,
      from: '+7912345678' + i,
      text: `Mock SMS message ${i} with amount 1000р.`,
      status: 1,
      received_at: new Date(Date.now() - i * 86400000).toISOString(),
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      device_id: 100 + i,
      device_name: 'Mock Device ' + i,
      additional_fields: {
        parsed: {
          amount: 1000,
          currency: 'RUB',
          balance: 5000
        },
        user_id: 1,
        user_name: 'Demo User'
      }
    }));
  }
  
  /**
   * Get mock push notifications
   */
  static getPushNotifications(): PushNotification[] {
    return Array(10).fill(null).map((_, i) => ({
      id: 300000 + i,
      package_name: 'ru.sberbankmobile',
      title: 'Mock Push',
      text: `Mock push notification ${i} with amount 1000р`,
      status: 1,
      received_at: new Date(Date.now() - i * 86400000).toISOString(),
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      device_id: 100 + i,
      device_name: 'Mock Device ' + i,
      has_parsed_data: true,
      additional_fields: {
        parsed: {
          amount: 1000,
          currency: 'RUB'
        },
        user_id: 1,
        user_name: 'Demo User'
      }
    }));
  }
  
  /**
   * Get mock account data
   */
  static getAccountData() {
    return {
      stats: {
        transactions_count: 157,
        total_volume: 1250000,
        active_accounts: 3
      },
      balances: {
        RUB: 865320.45,
        USD: 7540.25,
        EUR: 2130.80
      },
      activity: Array(7).fill(null).map((_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        transactions: Math.floor(Math.random() * 20) + 5,
        volume: Math.floor(Math.random() * 100000) + 50000
      }))
    };
  }
  
  /**
   * Get mock user profile data
   */
  static getUserProfile(userId: number) {
    return {
      id: userId,
      username: 'DemoUser',
      created_at: '2023-01-01T00:00:00.000Z',
      accounts: [
        {
          id: 1,
          type: 'gate',
          is_active: true,
          created_at: '2023-01-02T00:00:00.000Z'
        },
        {
          id: 2,
          type: 'bybit',
          is_active: true,
          created_at: '2023-01-03T00:00:00.000Z'
        }
      ],
      permissions: ['read', 'write', 'trade'],
      settings: {
        theme: 'system',
        notifications: true,
        trading_enabled: true
      }
    };
  }
}