/**
 * Bybit P2P Manager
 * Manages multiple P2P accounts with WebSocket-like functionality
 */

import { EventEmitter } from 'events';
import { P2PClient } from './p2pClient';
import {
  P2PConfig,
  P2PAccount,
  P2PAdvertisement,
  CreateAdvertisementParams,
  UpdateAdvertisementParams,
  P2POrder,
  ChatMessage,
  SendMessageParams,
  PaymentMethod,
  PaginatedResponse,
  AdvertisementFilter,
  OrderFilter,
  P2PEvent,
} from './types/p2p';

export class P2PManager extends EventEmitter {
  private accounts: Map<string, P2PAccount> = new Map();
  private clients: Map<string, P2PClient> = new Map();
  private activeAccountId: string | null = null;

  constructor() {
    super();
  }

  /**
   * Add new P2P account
   */
  async addAccount(accountId: string, config: P2PConfig): Promise<void> {
    if (this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} already exists`);
    }

    const account: P2PAccount = {
      id: accountId,
      config,
      isActive: false,
    };

    const client = new P2PClient(config);
    
    // Setup event forwarding
    this.setupClientEvents(accountId, client);

    try {
      await client.connect();
      account.isActive = true;
      account.lastSync = new Date();
    } catch (error) {
      console.error(`Failed to connect account ${accountId}:`, error);
      account.isActive = false;
    }

    this.accounts.set(accountId, account);
    this.clients.set(accountId, client);

    // Set as active if first account
    if (!this.activeAccountId) {
      this.activeAccountId = accountId;
    }

    this.emit('accountAdded', { accountId, isActive: account.isActive });
  }

  /**
   * Remove P2P account
   */
  removeAccount(accountId: string): void {
    const client = this.clients.get(accountId);
    if (client) {
      client.disconnect();
      client.removeAllListeners();
    }

    this.accounts.delete(accountId);
    this.clients.delete(accountId);

    if (this.activeAccountId === accountId) {
      this.activeAccountId = this.accounts.keys().next().value || null;
    }

    this.emit('accountRemoved', { accountId });
  }

  /**
   * Switch active account
   */
  switchAccount(accountId: string): void {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`);
    }

    this.activeAccountId = accountId;
    this.emit('accountSwitched', { accountId });
  }

  /**
   * Get all accounts
   */
  getAccounts(): P2PAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get active account
   */
  getActiveAccount(): P2PAccount | null {
    return this.activeAccountId ? this.accounts.get(this.activeAccountId) || null : null;
  }

  /**
   * Get client for specific account
   */
  getClient(accountId?: string): P2PClient {
    const id = accountId || this.activeAccountId;
    if (!id) {
      throw new Error('No active account');
    }

    const client = this.clients.get(id);
    if (!client) {
      throw new Error(`Client not found for account ${id}`);
    }

    return client;
  }

  /**
   * Setup event forwarding from client
   */
  private setupClientEvents(accountId: string, client: P2PClient): void {
    client.on('connected', () => {
      const account = this.accounts.get(accountId);
      if (account) {
        account.isActive = true;
        account.lastSync = new Date();
      }
      this.emit('accountConnected', { accountId });
    });

    client.on('disconnected', () => {
      const account = this.accounts.get(accountId);
      if (account) {
        account.isActive = false;
      }
      this.emit('accountDisconnected', { accountId });
    });

    client.on('error', (error) => {
      this.emit('accountError', { accountId, error });
    });

    client.on('p2pEvent', (event: P2PEvent) => {
      this.emit('p2pEvent', { ...event, accountId });
    });

    client.on('orderUpdate', (order) => {
      this.emit('orderUpdate', { accountId, order });
    });

    client.on('chatMessage', (message) => {
      this.emit('chatMessage', { accountId, message });
    });
  }

  // ========== Account Management Methods ==========

  /**
   * Connect all accounts
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.clients.entries()).map(async ([accountId, client]) => {
      try {
        await client.connect();
        const account = this.accounts.get(accountId);
        if (account) {
          account.isActive = true;
          account.lastSync = new Date();
        }
      } catch (error) {
        console.error(`Failed to connect account ${accountId}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Disconnect all accounts
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
  }

  /**
   * Get account info for specific account
   */
  async getAccountInfo(accountId?: string): Promise<any> {
    return await this.getClient(accountId).getAccountInfo();
  }

  // ========== Advertisement Methods ==========

  /**
   * Get active advertisements (for specific or all accounts)
   */
  async getActiveAdvertisements(
    filter?: AdvertisementFilter,
    accountId?: string
  ): Promise<PaginatedResponse<P2PAdvertisement>> {
    if (accountId) {
      return await this.getClient(accountId).getActiveAdvertisements(filter);
    }

    // Get from all accounts
    const results: P2PAdvertisement[] = [];
    for (const [id, client] of this.clients) {
      try {
        const response = await client.getActiveAdvertisements(filter);
        results.push(...response.list);
      } catch (error) {
        console.error(`Failed to get ads for account ${id}:`, error);
      }
    }

    return {
      list: results,
      total: results.length,
      page: 1,
      pageSize: results.length,
    };
  }

  /**
   * Get my advertisements
   * Note: This endpoint doesn't support pagination parameters
   */
  async getMyAdvertisements(
    accountId?: string
  ): Promise<PaginatedResponse<P2PAdvertisement>> {
    return await this.getClient(accountId).getMyAdvertisements();
  }
  
  /**
   * Get advertisement details
   */
  async getAdvertisementDetails(
    itemId: string,
    accountId?: string
  ): Promise<P2PAdvertisement> {
    return await this.getClient(accountId).getAdvertisementDetails(itemId);
  }

  /**
   * Create advertisement
   * Note: Returns Bybit's response which only contains itemId and security fields
   */
  async createAdvertisement(
    params: CreateAdvertisementParams,
    accountId?: string
  ): Promise<any> {
    return await this.getClient(accountId).createAdvertisement(params);
  }

  /**
   * Update advertisement
   */
  async updateAdvertisement(
    params: UpdateAdvertisementParams,
    accountId?: string
  ): Promise<P2PAdvertisement> {
    return await this.getClient(accountId).updateAdvertisement(params);
  }

  /**
   * Delete advertisement
   */
  async deleteAdvertisement(itemId: string, accountId?: string): Promise<void> {
    return await this.getClient(accountId).deleteAdvertisement(itemId);
  }

  // ========== Order Methods ==========

  /**
   * Get orders
   */
  async getOrders(
    filter?: OrderFilter,
    page: number = 1,
    pageSize: number = 20,
    accountId?: string
  ): Promise<PaginatedResponse<P2POrder>> {
    if (accountId) {
      return await this.getClient(accountId).getOrders(filter, page, pageSize);
    }

    // Get from all accounts
    const results: P2POrder[] = [];
    for (const [id, client] of this.clients) {
      try {
        const response = await client.getOrders(filter, page, pageSize);
        results.push(...response.list);
      } catch (error) {
        console.error(`Failed to get orders for account ${id}:`, error);
      }
    }

    return {
      list: results,
      total: results.length,
      page: 1,
      pageSize: results.length,
    };
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(
    page: number = 1,
    pageSize: number = 20,
    accountId?: string
  ): Promise<PaginatedResponse<P2POrder>> {
    return await this.getClient(accountId).getPendingOrders(page, pageSize);
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId: string, accountId?: string): Promise<P2POrder> {
    return await this.getClient(accountId).getOrderDetails(orderId);
  }

  /**
   * Mark order as paid
   */
  async markOrderAsPaid(orderId: string, accountId?: string): Promise<void> {
    return await this.getClient(accountId).markOrderAsPaid(orderId);
  }

  /**
   * Release assets
   */
  async releaseAssets(orderId: string, accountId?: string): Promise<void> {
    return await this.getClient(accountId).releaseAssets(orderId);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string, accountId?: string): Promise<void> {
    return await this.getClient(accountId).cancelOrder(orderId, reason);
  }

  // ========== Chat Methods ==========

  /**
   * Get chat messages
   */
  async getChatMessages(
    orderId: string,
    page: number = 1,
    pageSize: number = 50,
    accountId?: string
  ): Promise<PaginatedResponse<ChatMessage>> {
    return await this.getClient(accountId).getChatMessages(orderId, page, pageSize);
  }

  /**
   * Send chat message
   */
  async sendChatMessage(params: SendMessageParams, accountId?: string): Promise<ChatMessage> {
    return await this.getClient(accountId).sendChatMessage(params);
  }

  /**
   * Upload file
   */
  async uploadFile(
    orderId: string,
    fileData: Buffer,
    fileName: string,
    accountId?: string
  ): Promise<any> {
    return await this.getClient(accountId).uploadFile(orderId, fileData, fileName);
  }

  // ========== Payment Methods ==========

  /**
   * Get payment methods
   */
  async getPaymentMethods(accountId?: string): Promise<PaymentMethod[]> {
    return await this.getClient(accountId).getPaymentMethods();
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(
    paymentMethod: Omit<PaymentMethod, 'id'>,
    accountId?: string
  ): Promise<PaymentMethod> {
    return await this.getClient(accountId).addPaymentMethod(paymentMethod);
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(
    paymentMethod: PaymentMethod,
    accountId?: string
  ): Promise<PaymentMethod> {
    return await this.getClient(accountId).updatePaymentMethod(paymentMethod);
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(paymentId: string, accountId?: string): Promise<void> {
    return await this.getClient(accountId).deletePaymentMethod(paymentId);
  }

  // ========== Polling Methods ==========

  /**
   * Start order polling for all accounts
   */
  startOrderPollingAll(intervalMs: number = 5000): void {
    for (const client of this.clients.values()) {
      client.startOrderPolling(intervalMs);
    }
  }

  /**
   * Start chat polling for specific order
   */
  startChatPolling(orderId: string, intervalMs: number = 3000, accountId?: string): void {
    this.getClient(accountId).startChatPolling(orderId, intervalMs);
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const client of this.clients.values()) {
      client.stopPolling('orders');
    }
  }
}