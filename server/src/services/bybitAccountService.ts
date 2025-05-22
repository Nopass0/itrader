import { PrismaClient } from '@prisma/client';
import { createBybitP2PService, BybitP2PService } from './bybitP2PService.js';
import { websocketService } from './websocketService.js';

const prisma = new PrismaClient();

export class BybitAccountService {
  private serviceInstances: Map<number, BybitP2PService> = new Map();

  // Get or create service instance for account
  private async getServiceInstance(accountId: number): Promise<BybitP2PService | null> {
    if (this.serviceInstances.has(accountId)) {
      return this.serviceInstances.get(accountId)!;
    }

    const credentials = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });

    if (!credentials) {
      console.log(`[Bybit Account] No credentials found for account ${accountId}`);
      return null;
    }

    const service = createBybitP2PService(credentials.apiKey, credentials.apiSecret);
    this.serviceInstances.set(accountId, service);
    return service;
  }

  // Initialize account
  async initializeAccount(credentialsId: number, apiKey: string, apiSecret: string): Promise<void> {
    try {
      console.log(`[Bybit Account] Initializing account ${credentialsId}`);
      
      const credentials = await prisma.bybitCredentials.findUnique({
        where: { id: credentialsId }
      });

      if (!credentials) {
        throw new Error('Credentials not found');
      }

      const service = createBybitP2PService(apiKey, apiSecret);
      
      // Test connection
      const connectionTest = await service.testConnection();
      
      if (!connectionTest.success) {
        await prisma.bybitCredentials.update({
          where: { id: credentialsId },
          data: {
            status: 'error',
            errorMessage: connectionTest.error,
            lastCheckAt: new Date()
          }
        });
        
        websocketService.emitAccountStatusChange(credentialsId, 'bybit', 'error', connectionTest.error);
        throw new Error(connectionTest.error);
      }

      // Store account info
      await prisma.bybitCredentials.update({
        where: { id: credentialsId },
        data: {
          status: 'active',
          errorMessage: null,
          lastCheckAt: new Date(),
          accountInfo: connectionTest.data
        }
      });

      this.serviceInstances.set(credentialsId, service);
      
      // Emit success status
      websocketService.emitAccountStatusChange(credentialsId, 'bybit', 'active');

      // Initial data sync
      await this.syncAccountData(credentialsId);

      console.log(`[Bybit Account] Account ${credentialsId} initialized successfully`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error initializing account ${credentialsId}:`, error);
      throw error;
    }
  }

  // Sync all account data
  async syncAccountData(accountId: number): Promise<void> {
    try {
      const service = await this.getServiceInstance(accountId);
      if (!service) {
        throw new Error('No service instance available');
      }

      // Get account info to get the user ID
      const account = await prisma.bybitCredentials.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      const userId = account.userId;

      console.log(`[Bybit Account] Syncing data for account ${accountId} (user ${userId})`);

      // Sync user info
      await this.syncUserInfo(userId, service);
      
      // Sync payment methods
      await this.syncPaymentMethods(userId, service);

      // Sync balances
      await this.syncBalances(userId, service);
      
      // Sync ads
      await this.syncAds(userId, service);
      
      // Sync orders
      await this.syncOrders(userId, service);

      console.log(`[Bybit Account] Data sync completed for account ${accountId} (user ${userId})`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error syncing data for account ${accountId}:`, error);
      throw error;
    }
  }

  // Sync user info
  private async syncUserInfo(userId: number, service: BybitP2PService): Promise<void> {
    try {
      const userInfoResult = await service.getUserPersonalInfo();
      
      if (!userInfoResult.success || !userInfoResult.data) {
        console.warn(`[Bybit Account] Failed to fetch user info for user ${userId}:`, userInfoResult.error);
        return;
      }

      const userInfo = userInfoResult.data;

      // Upsert user info
      await prisma.bybitP2PUserInfo.upsert({
        where: { userId },
        update: {
          bybitUserId: userInfo.userId,
          nickName: userInfo.nickName,
          accountId: userInfo.accountId,
          userType: userInfo.userType,
          kycLevel: userInfo.kycLevel,
          authStatus: userInfo.authStatus,
          kycCountryCode: userInfo.kycCountryCode,
          realName: userInfo.realName,
          realNameEn: userInfo.realNameEn,
          email: userInfo.email,
          mobile: userInfo.mobile,
          registerTime: userInfo.registerTime,
          recentRate: userInfo.recentRate,
          totalFinishCount: userInfo.totalFinishCount,
          totalFinishSellCount: userInfo.totalFinishSellCount,
          totalFinishBuyCount: userInfo.totalFinishBuyCount,
          recentFinishCount: userInfo.recentFinishCount,
          recentTradeAmount: userInfo.recentTradeAmount,
          totalTradeAmount: userInfo.totalTradeAmount,
          accountCreateDays: userInfo.accountCreateDays,
          firstTradeDays: userInfo.firstTradeDays,
          lastLogoutTime: userInfo.lastLogoutTime,
          isOnline: userInfo.isOnline,
          vipLevel: userInfo.vipLevel,
          goodAppraiseRate: userInfo.goodAppraiseRate,
          goodAppraiseCount: userInfo.goodAppraiseCount,
          badAppraiseCount: userInfo.badAppraiseCount,
          paymentCount: userInfo.paymentCount,
          contactCount: userInfo.contactCount,
          userCancelCountLimit: userInfo.userCancelCountLimit,
          blocked: userInfo.blocked,
          defaultNickName: userInfo.defaultNickName,
          averageReleaseTime: userInfo.averageReleaseTime,
          averageTransferTime: userInfo.averageTransferTime,
          rawData: userInfo
        },
        create: {
          userId,
          bybitUserId: userInfo.userId,
          nickName: userInfo.nickName,
          accountId: userInfo.accountId,
          userType: userInfo.userType,
          kycLevel: userInfo.kycLevel,
          authStatus: userInfo.authStatus,
          kycCountryCode: userInfo.kycCountryCode,
          realName: userInfo.realName,
          realNameEn: userInfo.realNameEn,
          email: userInfo.email,
          mobile: userInfo.mobile,
          registerTime: userInfo.registerTime,
          recentRate: userInfo.recentRate,
          totalFinishCount: userInfo.totalFinishCount,
          totalFinishSellCount: userInfo.totalFinishSellCount,
          totalFinishBuyCount: userInfo.totalFinishBuyCount,
          recentFinishCount: userInfo.recentFinishCount,
          recentTradeAmount: userInfo.recentTradeAmount,
          totalTradeAmount: userInfo.totalTradeAmount,
          accountCreateDays: userInfo.accountCreateDays,
          firstTradeDays: userInfo.firstTradeDays,
          lastLogoutTime: userInfo.lastLogoutTime,
          isOnline: userInfo.isOnline,
          vipLevel: userInfo.vipLevel,
          goodAppraiseRate: userInfo.goodAppraiseRate,
          goodAppraiseCount: userInfo.goodAppraiseCount,
          badAppraiseCount: userInfo.badAppraiseCount,
          paymentCount: userInfo.paymentCount,
          contactCount: userInfo.contactCount,
          userCancelCountLimit: userInfo.userCancelCountLimit,
          blocked: userInfo.blocked,
          defaultNickName: userInfo.defaultNickName,
          averageReleaseTime: userInfo.averageReleaseTime,
          averageTransferTime: userInfo.averageTransferTime,
          rawData: userInfo
        }
      });

      console.log(`[Bybit Account] Synced user info for user ${userId}`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error syncing user info for user ${userId}:`, error);
    }
  }

  // Sync payment methods
  private async syncPaymentMethods(userId: number, service: BybitP2PService): Promise<void> {
    try {
      const paymentMethodsResult = await service.getUserPaymentMethods();
      
      if (!paymentMethodsResult.success || !paymentMethodsResult.data) {
        console.warn(`[Bybit Account] Failed to fetch payment methods for user ${userId}:`, paymentMethodsResult.error);
        return;
      }

      // Clear existing payment methods
      await prisma.bybitP2PPaymentMethod.deleteMany({
        where: { userId }
      });

      // Insert new payment methods
      for (const paymentMethod of paymentMethodsResult.data) {
        await prisma.bybitP2PPaymentMethod.create({
          data: {
            userId,
            paymentId: paymentMethod.id,
            realName: paymentMethod.realName,
            paymentType: paymentMethod.paymentType,
            bankName: paymentMethod.bankName,
            branchName: paymentMethod.branchName,
            accountNo: paymentMethod.accountNo,
            qrcode: paymentMethod.qrcode,
            online: paymentMethod.online,
            visible: paymentMethod.visible,
            payMessage: paymentMethod.payMessage,
            firstName: paymentMethod.firstName,
            lastName: paymentMethod.lastName,
            secondLastName: paymentMethod.secondLastName,
            clabe: paymentMethod.clabe,
            debitCardNumber: paymentMethod.debitCardNumber,
            concept: paymentMethod.concept,
            countNo: paymentMethod.countNo,
            paymentExt1: paymentMethod.paymentExt1,
            paymentExt2: paymentMethod.paymentExt2,
            paymentExt3: paymentMethod.paymentExt3,
            paymentExt4: paymentMethod.paymentExt4,
            paymentExt5: paymentMethod.paymentExt5,
            paymentExt6: paymentMethod.paymentExt6,
            paymentTemplateVersion: paymentMethod.paymentTemplateVersion,
            hasPaymentTemplateChanged: paymentMethod.hasPaymentTemplateChanged,
            paymentConfigVo: paymentMethod.paymentConfigVo,
            realNameVerified: paymentMethod.realNameVerified,
            channel: paymentMethod.channel,
            currencyBalance: paymentMethod.currencyBalance,
            rawData: paymentMethod
          }
        });
      }

      console.log(`[Bybit Account] Synced ${paymentMethodsResult.data.length} payment methods for user ${userId}`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error syncing payment methods for user ${userId}:`, error);
    }
  }

  // Sync balances
  private async syncBalances(userId: number, service: BybitP2PService): Promise<void> {
    try {
      const balancesResult = await service.getAllBalances();
      
      if (!balancesResult.success || !balancesResult.data) {
        console.warn(`[Bybit Account] Failed to fetch balances for user ${userId}:`, balancesResult.error);
        return;
      }

      // Clear existing balances
      await prisma.bybitP2PBalance.deleteMany({
        where: { userId }
      });

      // Extract balances from response (it might be in result.balance)
      const balances = balancesResult.data.balance || balancesResult.data;
      
      // Insert new balances
      for (const balance of balances) {
        if (balance.coin && (parseFloat(balance.walletBalance) > 0 || balance.coin === 'USDT')) {
          await prisma.bybitP2PBalance.create({
            data: {
              userId,
              coin: balance.coin,
              balance: balance.walletBalance || balance.balance || '0',
              frozen: balance.locked || balance.frozen || '0'
            }
          });
        }
      }

      console.log(`[Bybit Account] Synced ${balancesResult.data.length} balances for user ${userId}`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error syncing balances for user ${userId}:`, error);
    }
  }

  // Sync ads
  private async syncAds(userId: number, service: BybitP2PService): Promise<void> {
    try {
      const adsResult = await service.getMyAdsList();
      
      if (!adsResult.success || !adsResult.data) {
        console.warn(`[Bybit Account] Failed to fetch ads for user ${userId}:`, adsResult.error);
        return;
      }

      // Clear existing ads
      await prisma.bybitP2PAd.deleteMany({
        where: { userId }
      });

      // Insert new ads
      for (const ad of adsResult.data.list) {
        await prisma.bybitP2PAd.create({
          data: {
            id: ad.id,
            userId,
            side: ad.side,
            tokenId: ad.tokenId,
            currencyId: ad.currencyId,
            price: ad.price,
            amount: ad.amount,
            minAmount: ad.minAmount,
            maxAmount: ad.maxAmount,
            paymentMethods: ad.paymentMethods,
            remark: ad.remark || '',
            status: ad.status,
            completedOrderNum: ad.completedOrderNum,
            completedRate: ad.completedRate,
            avgReleaseTime: ad.avgReleaseTime,
            rawData: ad
          }
        });
      }

      console.log(`[Bybit Account] Synced ${adsResult.data.list.length} ads for user ${userId}`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error syncing ads for user ${userId}:`, error);
    }
  }

  // Sync orders
  private async syncOrders(userId: number, service: BybitP2PService): Promise<void> {
    try {
      const ordersResult = await service.getOrderList({
        page: 1,
        size: 100
      });
      
      if (!ordersResult.success || !ordersResult.data) {
        console.warn(`[Bybit Account] Failed to fetch orders for user ${userId}:`, ordersResult.error);
        return;
      }

      // Clear existing orders
      await prisma.bybitP2POrder.deleteMany({
        where: { userId }
      });

      // Insert new orders
      for (const order of ordersResult.data.list) {
        await prisma.bybitP2POrder.create({
          data: {
            id: order.orderId,
            userId,
            orderStatus: order.orderStatus,
            side: order.side,
            tokenId: order.tokenId,
            currencyId: order.currencyId,
            price: order.price,
            amount: order.amount,
            quantity: order.quantity,
            paymentMethod: order.paymentMethod,
            counterPartyId: order.counterPartyId,
            counterPartyNickName: order.counterPartyNickName,
            adId: order.adId,
            chatId: order.chatId,
            lastUpdateTime: new Date(order.lastUpdateTime),
            rawData: order
          }
        });
      }

      console.log(`[Bybit Account] Synced ${ordersResult.data.list.length} orders for user ${userId}`);

    } catch (error: any) {
      console.error(`[Bybit Account] Error syncing orders for user ${userId}:`, error);
    }
  }

  // Get account balances
  async getAccountBalances(accountId: number): Promise<any> {
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const balances = await prisma.bybitP2PBalance.findMany({
      where: { userId: account.userId },
      orderBy: { coin: 'asc' }
    });

    return balances;
  }

  // Get account ads
  async getAccountAds(accountId: number): Promise<any> {
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const ads = await prisma.bybitP2PAd.findMany({
      where: { userId: account.userId },
      orderBy: { createdAt: 'desc' }
    });

    return ads;
  }

  // Get account orders
  async getAccountOrders(accountId: number): Promise<any> {
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const orders = await prisma.bybitP2POrder.findMany({
      where: { userId: account.userId },
      orderBy: { createdAt: 'desc' }
    });

    return orders;
  }

  // Get user info
  async getUserInfo(accountId: number): Promise<any> {
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const userInfo = await prisma.bybitP2PUserInfo.findUnique({
      where: { userId: account.userId }
    });

    return userInfo;
  }

  // Get payment methods
  async getPaymentMethods(accountId: number): Promise<any> {
    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const paymentMethods = await prisma.bybitP2PPaymentMethod.findMany({
      where: { userId: account.userId },
      orderBy: { createdAt: 'desc' }
    });

    return paymentMethods;
  }

  // Create new ad
  async createAd(accountId: number, adData: {
    side: 'Buy' | 'Sell';
    tokenId: string;
    currencyId: string;
    price: string;
    amount: string;
    minAmount: string;
    maxAmount: string;
    paymentMethodIds: string[];
    remark?: string;
  }): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const result = await service.createAd(adData);
    
    if (result.success) {
      // Sync ads after creation
      await this.syncAds(account.userId, service);
      
      // Emit WebSocket update
      websocketService.emitAccountStatusChange(accountId, 'bybit', 'ad_created');
    }

    return result;
  }

  // Update ad
  async updateAd(accountId: number, adData: {
    itemId: string;
    price?: string;
    amount?: string;
    minAmount?: string;
    maxAmount?: string;
    remark?: string;
  }): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const result = await service.updateAd(adData);
    
    if (result.success) {
      // Sync ads after update
      await this.syncAds(account.userId, service);
      
      // Emit WebSocket update
      websocketService.emitAccountStatusChange(accountId, 'bybit', 'ad_updated');
    }

    return result;
  }

  // Remove ad
  async removeAd(accountId: number, itemId: string): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const result = await service.removeAd(itemId);
    
    if (result.success) {
      // Sync ads after removal
      await this.syncAds(account.userId, service);
      
      // Emit WebSocket update
      websocketService.emitAccountStatusChange(accountId, 'bybit', 'ad_removed');
    }

    return result;
  }

  // Mark order as paid
  async markOrderAsPaid(accountId: number, orderId: string): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const result = await service.markOrderAsPaid(orderId);
    
    if (result.success) {
      // Sync orders after action
      await this.syncOrders(account.userId, service);
      
      // Emit WebSocket update
      websocketService.emitAccountStatusChange(accountId, 'bybit', 'order_paid');
    }

    return result;
  }

  // Release digital asset
  async releaseDigitalAsset(accountId: number, orderId: string): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    const account = await prisma.bybitCredentials.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error('Account not found');
    }

    const result = await service.releaseDigitalAsset(orderId);
    
    if (result.success) {
      // Sync orders after action
      await this.syncOrders(account.userId, service);
      
      // Emit WebSocket update
      websocketService.emitAccountStatusChange(accountId, 'bybit', 'asset_released');
    }

    return result;
  }

  // Get chat messages
  async getChatMessages(accountId: number, orderId: string): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    return await service.getChatMessages({ orderId });
  }

  // Send chat message
  async sendChatMessage(accountId: number, orderId: string, content: string): Promise<any> {
    const service = await this.getServiceInstance(accountId);
    if (!service) {
      throw new Error('No service instance available');
    }

    const result = await service.sendChatMessage({
      orderId,
      content
    });

    if (result.success) {
      // Emit WebSocket update
      websocketService.emitAccountStatusChange(accountId, 'bybit', 'message_sent');
    }

    return result;
  }
}

// Export singleton instance
export const bybitAccountService = new BybitAccountService();