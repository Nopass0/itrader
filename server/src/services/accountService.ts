import { PrismaClient } from '@prisma/client';
import { realGateService } from './realGateService.js';
import { websocketService } from './websocketService.js';

const prisma = new PrismaClient();

export interface AccountStatus {
  id: number;
  platform: 'gate' | 'bybit';
  status: 'initializing' | 'active' | 'error' | 'disabled';
  credentials: any;
  errorMessage?: string;
  lastCheckAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class BaseAccountService {
  protected platform: 'gate' | 'bybit';

  constructor(platform: 'gate' | 'bybit') {
    this.platform = platform;
  }

  abstract initialize(credentials: any): Promise<{ success: boolean; error?: string }>;
  abstract checkStatus(credentials: any): Promise<{ success: boolean; error?: string }>;
  abstract getAccountInfo(credentials: any): Promise<any>;

  async updateStatus(
    credentialsId: number, 
    status: 'initializing' | 'active' | 'error' | 'disabled',
    errorMessage?: string
  ): Promise<void> {
    if (this.platform === 'gate') {
      await prisma.gateCredentials.update({
        where: { id: credentialsId },
        data: {
          status,
          errorMessage,
          lastCheckAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      await prisma.bybitCredentials.update({
        where: { id: credentialsId },
        data: {
          status,
          errorMessage,
          lastCheckAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // Emit WebSocket event for status change
    websocketService.emitAccountStatusChange(credentialsId, this.platform, status, errorMessage);
  }
}

export class GateAccountService extends BaseAccountService {
  constructor() {
    super('gate');
  }

  async initialize(credentials: { email: string; password: string }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[GateAccountService] Initializing Gate account for ${credentials.email}`);
      
      // Use real Gate.cx API
      const authResult = await realGateService.authenticate(credentials.email, credentials.password);
      
      if (authResult.success) {
        return { success: true };
      } else {
        return { success: false, error: authResult.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async checkStatus(credentials: { email: string; password: string }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[GateAccountService] Checking Gate account status for ${credentials.email}`);
      
      // Try to authenticate to check if credentials still work
      const authResult = await realGateService.authenticate(credentials.email, credentials.password);
      
      if (authResult.success) {
        return { success: true };
      } else {
        return { success: false, error: authResult.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getAccountInfo(credentials: { email: string; password: string }): Promise<any> {
    try {
      // Get session for the user (userId 1 for demo)
      const sessionResult = await realGateService.getActiveSession(1);
      
      if (!sessionResult.success) {
        // If no active session, try to authenticate
        const authResult = await realGateService.authenticate(credentials.email, credentials.password);
        if (!authResult.success) {
          return {
            email: credentials.email,
            error: authResult.error
          };
        }
        
        return {
          email: credentials.email,
          userData: authResult.userData,
          lastAuth: new Date().toISOString()
        };
      }

      // Return session data
      return {
        email: credentials.email,
        userData: sessionResult.userData,
        sessionActive: true
      };
    } catch (error: any) {
      return {
        email: credentials.email,
        error: error.message
      };
    }
  }
}

export class BybitAccountService extends BaseAccountService {
  constructor() {
    super('bybit');
  }

  async initialize(credentials: { apiKey: string; apiSecret: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate Bybit API call
      console.log(`Initializing Bybit account with API key ${credentials.apiKey.substring(0, 8)}...`);
      
      // In real implementation, make actual API call to Bybit
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (Math.random() > 0.3) { // 70% success rate for demo
        return { success: true };
      } else {
        return { success: false, error: 'Invalid API key or insufficient permissions' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async checkStatus(credentials: { apiKey: string; apiSecret: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate status check
      console.log(`Checking Bybit account status for API key ${credentials.apiKey.substring(0, 8)}...`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (Math.random() > 0.1) { // 90% success rate for status check
        return { success: true };
      } else {
        return { success: false, error: 'API rate limit exceeded' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getAccountInfo(credentials: { apiKey: string; apiSecret: string }): Promise<any> {
    // Simulate getting account info
    return {
      apiKey: credentials.apiKey.substring(0, 8) + '...',
      balance: {
        USDT: Math.floor(Math.random() * 15000) + 500,
        BTC: Math.random() * 1.2,
        ETH: Math.random() * 15
      },
      positions: Math.floor(Math.random() * 10),
      orders: Math.floor(Math.random() * 30)
    };
  }
}

export class AccountManager {
  private gateService = new GateAccountService();
  private bybitService = new BybitAccountService();

  async initializeAccount(platform: 'gate' | 'bybit', credentialsId: number, credentials: any): Promise<void> {
    try {
      if (platform === 'gate') {
        // Use the real Gate.cx service for initialization
        await realGateService.initializeAccount(credentialsId, credentials.email, credentials.password);
      } else {
        // Use the existing Bybit service
        const service = this.bybitService;
        const result = await service.initialize(credentials);
        
        if (result.success) {
          await service.updateStatus(credentialsId, 'active');
        } else {
          await service.updateStatus(credentialsId, 'error', result.error);
        }
      }
    } catch (error: any) {
      console.error(`Error initializing ${platform} account ${credentialsId}:`, error.message);
      
      if (platform === 'gate') {
        await prisma.gateCredentials.update({
          where: { id: credentialsId },
          data: {
            status: 'error',
            errorMessage: error.message,
            lastCheckAt: new Date(),
            updatedAt: new Date()
          }
        });
      } else {
        await this.bybitService.updateStatus(credentialsId, 'error', error.message);
      }
    }
  }

  async checkAccountStatus(platform: 'gate' | 'bybit', credentialsId: number, credentials: any): Promise<void> {
    const service = platform === 'gate' ? this.gateService : this.bybitService;
    
    try {
      const result = await service.checkStatus(credentials);
      
      if (result.success) {
        await service.updateStatus(credentialsId, 'active');
      } else {
        await service.updateStatus(credentialsId, 'error', result.error);
      }
    } catch (error: any) {
      await service.updateStatus(credentialsId, 'error', error.message);
    }
  }

  async getAccountInfo(platform: 'gate' | 'bybit', credentials: any): Promise<any> {
    const service = platform === 'gate' ? this.gateService : this.bybitService;
    return await service.getAccountInfo(credentials);
  }
}

export const accountManager = new AccountManager();