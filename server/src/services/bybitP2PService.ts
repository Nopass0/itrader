import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BybitApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BybitP2PBalance {
  coin: string;
  walletBalance: string;
  transferBalance: string;
  bonus: string;
}

export interface BybitP2PAd {
  id: string;
  userId: string;
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  minAmount: string;
  maxAmount: string;
  paymentMethods: Array<{
    id: string;
    name: string;
    accountNo: string;
  }>;
  remark: string;
  status: 'Online' | 'Offline' | 'Frozen';
  createdTime: string;
  completedOrderNum: number;
  completedRate: string;
  avgReleaseTime: string;
}

export interface BybitP2POrder {
  orderId: string;
  orderStatus: 'Created' | 'Paid' | 'Cancelled' | 'Appeal' | 'Completed';
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  quantity: string;
  paymentMethod: {
    id: string;
    name: string;
    accountNo: string;
  };
  createTime: string;
  lastUpdateTime: string;
  counterPartyId: string;
  counterPartyNickName: string;
  adId: string;
  chatId: string;
}

export interface BybitP2PUser {
  userId: string;
  nickName: string;
  accountId: string;
  userType: string;
  kycLevel: string;
  authStatus: string;
  kycCountryCode: string;
  realName: string;
  realNameEn: string;
  email: string;
  mobile: string;
  registerTime: string;
  recentRate: string;
  totalFinishCount: number;
  totalFinishSellCount: number;
  totalFinishBuyCount: number;
  recentFinishCount: number;
  recentTradeAmount: string;
  totalTradeAmount: string;
  accountCreateDays: number;
  firstTradeDays: number;
  lastLogoutTime: string;
  isOnline: boolean;
  vipLevel: string;
  goodAppraiseRate: string;
  goodAppraiseCount: number;
  badAppraiseCount: number;
  paymentCount: number;
  contactCount: number;
  userCancelCountLimit: number;
  blocked: boolean;
  defaultNickName: boolean;
  averageReleaseTime: string;
  averageTransferTime: string;
}

export interface BybitP2PPaymentMethod {
  id: string;
  realName: string;
  paymentType: string;
  bankName: string;
  branchName: string;
  accountNo: string;
  qrcode: string;
  online: string;
  visible: number;
  payMessage: string;
  firstName: string;
  lastName: string;
  secondLastName: string;
  clabe: string;
  debitCardNumber: string;
  concept: string;
  countNo: string;
  paymentExt1: string;
  paymentExt2: string;
  paymentExt3: string;
  paymentExt4: string;
  paymentExt5: string;
  paymentExt6: string;
  paymentTemplateVersion: number;
  hasPaymentTemplateChanged: boolean;
  paymentConfigVo: any;
  realNameVerified: boolean;
  channel: string;
  currencyBalance: string[];
}

export interface BybitP2PChatMessage {
  messageId: string;
  chatId: string;
  content: string;
  messageType: 'Text' | 'Image' | 'File';
  fromUserId: string;
  createTime: string;
  fileUrl?: string;
}

export class BybitP2PService {
  private baseUrl = 'https://api.bybit.com';
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private generateSignature(timestamp: string, queryString: string): string {
    const recvWindow = '5000';
    const message = timestamp + this.apiKey + recvWindow + queryString;
    console.log(`[Bybit Signature] Message: ${message}`);
    const signature = crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
    console.log(`[Bybit Signature] Generated: ${signature}`);
    return signature;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    params: Record<string, any> = {}
  ): Promise<BybitApiResponse<T>> {
    try {
      const timestamp = Date.now().toString();
      
      // For POST requests, queryString should be the JSON body
      let queryString = '';
      if (method === 'POST') {
        queryString = JSON.stringify(params);
      } else {
        queryString = new URLSearchParams(params).toString();
      }
      
      const signature = this.generateSignature(timestamp, queryString);

      // URL construction
      let url = `${this.baseUrl}${endpoint}`;
      if (method === 'GET' && Object.keys(params).length > 0) {
        const urlParams = new URLSearchParams(params).toString();
        url += `?${urlParams}`;
      }

      const headers: Record<string, string> = {
        'X-BAPI-API-KEY': this.apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': '5000',
        'X-BAPI-SIGN': signature,
        'Content-Type': 'application/json'
      };

      // For P2P endpoints, we might need different headers
      if (endpoint.includes('/p2p/')) {
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }

      console.log(`[Bybit API] Making request to ${endpoint}`, {
        method,
        params,
        headers: { ...headers, 'X-BAPI-SIGN': '[HIDDEN]' }
      });

      const response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(params) : undefined
      });

      console.log(`[Bybit API] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Bybit API] HTTP Error: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log(`[Bybit API] Response data:`, data);

      if (data.retCode !== 0) {
        console.error(`[Bybit API] API Error: ${data.retCode} - ${data.retMsg}`);
        return {
          success: false,
          error: data.retMsg || 'Bybit API error'
        };
      }

      return {
        success: true,
        data: data.result
      };
    } catch (error: any) {
      console.error('Bybit P2P API Error:', error);
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  // Get all P2P balances
  async getAllBalances(): Promise<BybitApiResponse<BybitP2PBalance[]>> {
    console.log('[Bybit P2P] Fetching all balances');
    // Try different account types as SPOT might not be available for all users
    const accountTypes = ['FUND', 'UNIFIED', 'SPOT'];
    
    for (const accountType of accountTypes) {
      try {
        const result = await this.makeRequest<BybitP2PBalance[]>('/v5/asset/transfer/query-account-coins-balance', 'GET', {
          accountType
        });
        
        if (result.success) {
          console.log(`[Bybit P2P] Successfully fetched balances using accountType: ${accountType}`);
          return result;
        }
      } catch (error) {
        console.log(`[Bybit P2P] Failed with accountType ${accountType}, trying next...`);
      }
    }
    
    // If all fail, return error
    return {
      success: false,
      error: 'Unable to fetch balances with any supported account type'
    };
  }

  // Get account info
  async getAccountInfo(): Promise<BybitApiResponse<BybitP2PUser>> {
    console.log('[Bybit P2P] Fetching account info');
    return this.makeRequest<BybitP2PUser>('/v5/p2p/user/personal/info', 'POST');
  }

  // Get user payment methods
  async getUserPaymentMethods(): Promise<BybitApiResponse<BybitP2PPaymentMethod[]>> {
    console.log('[Bybit P2P] Fetching user payment methods');
    return this.makeRequest<BybitP2PPaymentMethod[]>('/v5/p2p/user/payment/list', 'POST');
  }

  // Get counterparty user info
  async getCounterpartyUserInfo(userId: string): Promise<BybitApiResponse<BybitP2PUser>> {
    console.log(`[Bybit P2P] Fetching counterparty user info for ${userId}`);
    return this.makeRequest<BybitP2PUser>('/v5/p2p/user/counterparty/info', 'POST', { userId });
  }

  // Get current user's own detailed info (more comprehensive than getAccountInfo)
  async getUserPersonalInfo(): Promise<BybitApiResponse<BybitP2PUser>> {
    console.log('[Bybit P2P] Fetching detailed user personal info');
    return this.makeRequest<BybitP2PUser>('/v5/p2p/user/personal/info', 'POST');
  }

  // Get online ads list
  async getOnlineAdsList(params: {
    tokenId: string;
    currencyId: string;
    side: '0' | '1'; // 0 = buy, 1 = sell
    page?: number;
    size?: number;
  }): Promise<BybitApiResponse<{ list: BybitP2PAd[]; totalPages: number }>> {
    console.log('[Bybit P2P] Fetching online ads list');
    return this.makeRequest('/v5/p2p/item/online', 'POST', {
      page: 1,
      size: 20,
      ...params
    });
  }

  // Get my ads list
  async getMyAdsList(params: {
    itemId?: string;
    status?: 1 | 2; // 1 = Sold Out, 2 = Available
    side?: '0' | '1'; // 0 = buy, 1 = sell
    tokenId?: string;
    currencyId?: string;
    page?: number;
    size?: number;
  } = {}): Promise<BybitApiResponse<{ list: BybitP2PAd[]; totalPages: number }>> {
    console.log('[Bybit P2P] Fetching my ads list');
    return this.makeRequest('/v5/p2p/item/personal/list', 'POST', {
      page: 1,
      size: 20,
      ...params
    });
  }

  // Get ad details
  async getAdDetails(itemId: string): Promise<BybitApiResponse<BybitP2PAd>> {
    console.log(`[Bybit P2P] Fetching ad details for ${itemId}`);
    return this.makeRequest('/v5/otc/item/detail', 'GET', { itemId });
  }

  // Create new ad
  async createAd(params: {
    side: 'Buy' | 'Sell';
    tokenId: string;
    currencyId: string;
    price: string;
    amount: string;
    minAmount: string;
    maxAmount: string;
    paymentMethodIds: string[];
    remark?: string;
  }): Promise<BybitApiResponse<{ itemId: string }>> {
    console.log('[Bybit P2P] Creating new ad');
    
    // Convert side to numeric format expected by API
    const apiParams = {
      ...params,
      side: params.side === 'Buy' ? '0' : '1'
    };
    
    const result = await this.makeRequest('/v5/p2p/item/post', 'POST', apiParams);
    
    // Handle specific maker status error
    if (!result.success && result.error?.includes('maker')) {
      return {
        success: false,
        error: 'Невозможно разместить объявление. Сначала необходимо подать заявку на получение статуса мейкера.'
      };
    }
    
    return result;
  }

  // Update ad
  async updateAd(params: {
    itemId: string;
    price?: string;
    amount?: string;
    minAmount?: string;
    maxAmount?: string;
    remark?: string;
  }): Promise<BybitApiResponse<any>> {
    console.log(`[Bybit P2P] Updating ad ${params.itemId}`);
    return this.makeRequest('/v5/otc/item/update', 'POST', params);
  }

  // Remove ad
  async removeAd(itemId: string): Promise<BybitApiResponse<any>> {
    console.log(`[Bybit P2P] Removing ad ${itemId}`);
    return this.makeRequest('/v5/otc/item/offline', 'POST', { itemId });
  }

  // Get order list
  async getOrderList(params: {
    page: number;
    size: number;
    status?: number;
    beginTime?: string;
    endTime?: string;
    tokenId?: string;
    side?: string[];
  }): Promise<BybitApiResponse<{ list: BybitP2POrder[]; totalPages: number }>> {
    console.log('[Bybit P2P] Fetching order list');
    return this.makeRequest('/v5/p2p/order/simplifyList', 'POST', {
      page: 1,
      size: 20,
      ...params
    });
  }

  // Get order details
  async getOrderDetails(orderId: string): Promise<BybitApiResponse<BybitP2POrder>> {
    console.log(`[Bybit P2P] Fetching order details for ${orderId}`);
    return this.makeRequest('/v5/otc/order/detail', 'GET', { orderId });
  }

  // Get pending orders
  async getPendingOrders(): Promise<BybitApiResponse<{ list: BybitP2POrder[] }>> {
    console.log('[Bybit P2P] Fetching pending orders');
    return this.makeRequest('/v5/otc/order/pending', 'GET');
  }

  // Mark order as paid
  async markOrderAsPaid(orderId: string): Promise<BybitApiResponse<any>> {
    console.log(`[Bybit P2P] Marking order ${orderId} as paid`);
    return this.makeRequest('/v5/otc/order/paid', 'POST', { orderId });
  }

  // Release digital asset
  async releaseDigitalAsset(orderId: string): Promise<BybitApiResponse<any>> {
    console.log(`[Bybit P2P] Releasing digital asset for order ${orderId}`);
    return this.makeRequest('/v5/otc/order/release', 'POST', { orderId });
  }

  // Get chat messages
  async getChatMessages(params: {
    orderId: string;
    limit?: number;
    cursor?: string;
  }): Promise<BybitApiResponse<{ list: BybitP2PChatMessage[]; nextPageCursor: string }>> {
    console.log(`[Bybit P2P] Fetching chat messages for order ${params.orderId}`);
    return this.makeRequest('/v5/otc/order/chat', 'GET', {
      limit: 50,
      ...params
    });
  }

  // Send chat message
  async sendChatMessage(params: {
    orderId: string;
    content: string;
    messageType?: 'Text';
  }): Promise<BybitApiResponse<{ messageId: string }>> {
    console.log(`[Bybit P2P] Sending chat message for order ${params.orderId}`);
    return this.makeRequest('/v5/otc/order/chat/send', 'POST', {
      messageType: 'Text',
      ...params
    });
  }

  // Upload chat file
  async uploadChatFile(params: {
    orderId: string;
    file: Buffer;
    fileName: string;
  }): Promise<BybitApiResponse<{ fileUrl: string }>> {
    console.log(`[Bybit P2P] Uploading chat file for order ${params.orderId}`);
    // Note: This would need multipart/form-data implementation
    return this.makeRequest('/v5/otc/order/chat/upload', 'POST', params);
  }

  // Test API connection with a simple endpoint
  async testConnection(): Promise<BybitApiResponse<any>> {
    console.log('[Bybit P2P] Testing API connection');
    
    // Try a simple endpoint first
    try {
      const result = await this.makeRequest('/v5/user/query-api', 'GET');
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.log('[Bybit P2P] Basic API test failed, trying P2P specific endpoint');
    }
    
    // If basic endpoint fails, try P2P specific
    return this.getAccountInfo();
  }
}

// Factory function to create service instance
export function createBybitP2PService(apiKey: string, apiSecret: string): BybitP2PService {
  return new BybitP2PService(apiKey, apiSecret);
}