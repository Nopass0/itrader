import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class BybitService {
  private client: AxiosInstance;
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = config.bybit.useTestnet 
      ? config.bybit.testnetApiUrl 
      : config.bybit.apiUrl;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  /**
   * Generate signature for Bybit API
   */
  private generateSignature(apiKey: string, apiSecret: string, timestamp: number, params: Record<string, any> = {}): string {
    // Convert params to query string if it's a GET request
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Create the string to sign: timestamp + api_key + recv_window + query_string
    const recvWindow = config.bybit.recvWindow;
    const stringToSign = `${timestamp}${apiKey}${recvWindow}${queryString}`;
    
    // Generate the signature
    return crypto
      .createHmac('sha256', apiSecret)
      .update(stringToSign)
      .digest('hex');
  }
  
  /**
   * Make an authenticated request to Bybit API
   */
  private async makeAuthenticatedRequest(
    apiKey: string,
    apiSecret: string,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    params: Record<string, any> = {}
  ): Promise<any> {
    const timestamp = Date.now();
    const signature = this.generateSignature(apiKey, apiSecret, timestamp, params);
    
    const headers = {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp.toString(),
      'X-BAPI-RECV-WINDOW': config.bybit.recvWindow.toString(),
      'X-BAPI-SIGN': signature,
    };
    
    try {
      let response;
      
      if (method === 'GET') {
        response = await this.client.get(endpoint, {
          params,
          headers,
        });
      } else {
        response = await this.client.post(endpoint, params, {
          headers,
        });
      }
      
      if (response.data.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.data.retMsg || 'Unknown error'}`);
      }
      
      return response.data;
    } catch (error) {
      logger.error(`Bybit API request error (${endpoint}):`, error);
      throw error;
    }
  }
  
  /**
   * Verify API key and save account information
   */
  async verifyApiKey(apiKey: string, apiSecret: string, userId: number): Promise<any> {
    try {
      // Check wallet balance to verify the API key
      const response = await this.makeAuthenticatedRequest(
        apiKey,
        apiSecret,
        '/v5/account/wallet-balance',
        'GET',
        { accountType: 'UNIFIED' }
      );
      
      // Extract account information
      const accountInfo = response.result;
      
      // Save or update the session
      const session = await prisma.bybitSession.upsert({
        where: {
          userId_isActive: {
            userId,
            isActive: true,
          },
        },
        update: {
          accountInfo,
          updatedAt: new Date(),
        },
        create: {
          userId,
          accountInfo,
          isActive: true,
        },
      });
      
      return session;
    } catch (error) {
      logger.error('Bybit API key verification error:', error);
      throw error;
    }
  }
  
  /**
   * Get order history from Bybit
   */
  async getOrderHistory(
    userId: number,
    category: string = 'spot', 
    symbol?: string,
    limit: number = 50,
    cursor?: string
  ): Promise<any> {
    try {
      // Get user's Bybit credentials
      const credentials = await prisma.bybitCredentials.findUnique({
        where: {
          userId,
        },
      });
      
      if (!credentials) {
        throw new Error('No Bybit credentials found for this user');
      }
      
      // Build query parameters
      const params: Record<string, any> = {
        category,
        limit,
      };
      
      if (symbol) {
        params.symbol = symbol;
      }
      
      if (cursor) {
        params.cursor = cursor;
      }
      
      // Make the request
      const response = await this.makeAuthenticatedRequest(
        credentials.apiKey,
        credentials.apiSecret,
        '/v5/order/history',
        'GET',
        params
      );
      
      // Log the transaction request
      await prisma.transactionLog.create({
        data: {
          platform: 'bybit',
          requestPath: '/v5/order/history',
          requestData: params,
          responseData: response,
        },
      });
      
      return response.result;
    } catch (error) {
      logger.error('Bybit getOrderHistory error:', error);
      throw error;
    }
  }
  
  /**
   * Get deposit history from Bybit
   */
  async getDepositHistory(
    userId: number,
    coin?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 50,
    cursor?: string
  ): Promise<any> {
    try {
      // Get user's Bybit credentials
      const credentials = await prisma.bybitCredentials.findUnique({
        where: {
          userId,
        },
      });
      
      if (!credentials) {
        throw new Error('No Bybit credentials found for this user');
      }
      
      // Build query parameters
      const params: Record<string, any> = {
        limit,
      };
      
      if (coin) {
        params.coin = coin;
      }
      
      if (startTime) {
        params.startTime = startTime;
      }
      
      if (endTime) {
        params.endTime = endTime;
      }
      
      if (cursor) {
        params.cursor = cursor;
      }
      
      // Make the request
      const response = await this.makeAuthenticatedRequest(
        credentials.apiKey,
        credentials.apiSecret,
        '/v5/asset/deposit/query-record',
        'GET',
        params
      );
      
      return response.result;
    } catch (error) {
      logger.error('Bybit getDepositHistory error:', error);
      throw error;
    }
  }
  
  /**
   * Get withdrawal history from Bybit
   */
  async getWithdrawalHistory(
    userId: number,
    coin?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 50,
    cursor?: string
  ): Promise<any> {
    try {
      // Get user's Bybit credentials
      const credentials = await prisma.bybitCredentials.findUnique({
        where: {
          userId,
        },
      });
      
      if (!credentials) {
        throw new Error('No Bybit credentials found for this user');
      }
      
      // Build query parameters
      const params: Record<string, any> = {
        limit,
      };
      
      if (coin) {
        params.coin = coin;
      }
      
      if (startTime) {
        params.startTime = startTime;
      }
      
      if (endTime) {
        params.endTime = endTime;
      }
      
      if (cursor) {
        params.cursor = cursor;
      }
      
      // Make the request
      const response = await this.makeAuthenticatedRequest(
        credentials.apiKey,
        credentials.apiSecret,
        '/v5/asset/withdraw/query-record',
        'GET',
        params
      );
      
      return response.result;
    } catch (error) {
      logger.error('Bybit getWithdrawalHistory error:', error);
      throw error;
    }
  }
  
  /**
   * Transform Bybit status to unified status format
   */
  transformStatus(bybitStatus: string): number {
    const statusMap: Record<string, number> = {
      'COMPLETED': 7,
      'DONE': 7,
      'SUCCESS': 7,
      'PENDING': 1,
      'PROCESSING': 2,
      'FAILED': 6,
      'CANCELED': 6,
    };
    
    return statusMap[bybitStatus] || 1; // Default to pending if unknown
  }
}