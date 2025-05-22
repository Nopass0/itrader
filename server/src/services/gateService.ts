import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class GateService {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: config.gatecx.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': config.gatecx.userAgent,
        'Referer': 'https://panel.gate.cx/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
  }
  
  /**
   * Authenticate with Gate.cx and save session
   */
  async authenticate(email: string, password: string, userId: number): Promise<any> {
    try {
      // Login to Gate.cx
      const loginResponse = await this.client.post('/auth/basic/login', {
        login: email,
        password: password,
      });
      
      // Check if the login was successful
      if (!loginResponse.data.success) {
        throw new Error(`Gate.cx authentication failed: ${loginResponse.data.error || 'Unknown error'}`);
      }
      
      // Extract cookies from response
      const cookies = loginResponse.headers['set-cookie'] || [];
      
      // Extract user data from response
      const userData = loginResponse.data.response.user;
      
      // Find existing session or create new one
      const existingSession = await prisma.gateSession.findFirst({
        where: { userId, isActive: true }
      });

      let session;
      if (existingSession) {
        // Update existing session
        session = await prisma.gateSession.update({
          where: { id: existingSession.id },
          data: {
            cookies: cookies.join('; '),
            userData,
            updatedAt: new Date(),
          }
        });
      } else {
        // Create new session
        session = await prisma.gateSession.create({
          data: {
            userId,
            cookies: cookies.join('; '),
            userData,
            isActive: true,
          }
        });
      }
      
      return session;
    } catch (error) {
      logger.error('Gate.cx authentication error:', error);
      throw error;
    }
  }
  
  /**
   * Get user info from Gate.cx
   */
  async getUserInfo(userId: number): Promise<any> {
    try {
      // Get the active session for this user
      const session = await prisma.gateSession.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });
      
      if (!session) {
        throw new Error('No active Gate.cx session found for this user');
      }
      
      // Set cookies from session
      const response = await this.client.get('/auth/me', {
        headers: {
          Cookie: session.cookies,
        },
      });
      
      if (!response.data.success) {
        throw new Error(`Failed to get user info: ${response.data.error || 'Unknown error'}`);
      }
      
      return response.data.response.user;
    } catch (error) {
      logger.error('Gate.cx getUserInfo error:', error);
      throw error;
    }
  }
  
  /**
   * Get transactions from Gate.cx
   */
  async getTransactions(
    userId: number,
    page = 1,
    filters: { status?: number[], walletId?: string } = {}
  ): Promise<any> {
    try {
      // Get the active session for this user
      const session = await prisma.gateSession.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });
      
      if (!session) {
        throw new Error('No active Gate.cx session found for this user');
      }
      
      // Build query parameters
      let url = `/payments/payouts?page=${page}`;
      
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach(status => {
          url += `&filters[status][]=${status}`;
        });
      }
      
      if (filters.walletId) {
        url += `&search[wallet]=${filters.walletId}`;
      }
      
      // Make the request
      const response = await this.client.get(url, {
        headers: {
          Cookie: session.cookies,
          Referer: 'https://panel.gate.cx/requests?page=1',
        },
      });
      
      if (!response.data.success) {
        throw new Error(`Failed to get transactions: ${response.data.error || 'Unknown error'}`);
      }
      
      // Log the transaction request
      await prisma.transactionLog.create({
        data: {
          platform: 'gate',
          requestPath: url,
          requestData: {},
          responseData: response.data,
        },
      });
      
      return response.data.response.payouts;
    } catch (error) {
      logger.error('Gate.cx getTransactions error:', error);
      throw error;
    }
  }
  
  /**
   * Get SMS messages from Gate.cx
   */
  async getSmsMessages(userId: number, page = 1, status?: number): Promise<any> {
    try {
      // Get the active session for this user
      const session = await prisma.gateSession.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });
      
      if (!session) {
        throw new Error('No active Gate.cx session found for this user');
      }
      
      // Build query parameters
      let url = `/devices/sms?page=${page}`;
      
      if (status !== undefined) {
        url += `&status=${status}`;
      }
      
      // Make the request
      const response = await this.client.get(url, {
        headers: {
          Cookie: session.cookies,
          Referer: 'https://panel.gate.cx/requests',
        },
      });
      
      if (!response.data.success) {
        throw new Error(`Failed to get SMS messages: ${response.data.error || 'Unknown error'}`);
      }
      
      return response.data.response.sms;
    } catch (error) {
      logger.error('Gate.cx getSmsMessages error:', error);
      throw error;
    }
  }
  
  /**
   * Get push notifications from Gate.cx
   */
  async getPushNotifications(userId: number, page = 1, status?: number): Promise<any> {
    try {
      // Get the active session for this user
      const session = await prisma.gateSession.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });
      
      if (!session) {
        throw new Error('No active Gate.cx session found for this user');
      }
      
      // Build query parameters
      let url = `/devices/pushes?page=${page}`;
      
      if (status !== undefined) {
        url += `&status=${status}`;
      }
      
      // Make the request
      const response = await this.client.get(url, {
        headers: {
          Cookie: session.cookies,
          Referer: 'https://panel.gate.cx/requests',
        },
      });
      
      if (!response.data.success) {
        throw new Error(`Failed to get push notifications: ${response.data.error || 'Unknown error'}`);
      }
      
      return response.data.response.pushes;
    } catch (error) {
      logger.error('Gate.cx getPushNotifications error:', error);
      throw error;
    }
  }
}