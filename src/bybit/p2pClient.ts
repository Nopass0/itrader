/**
 * Bybit P2P Client
 * Core client for interacting with Bybit P2P API
 */

import { EventEmitter } from "events";
import { HttpClient } from "./utils/httpClient";
import {
  P2PConfig,
  P2PAdvertisement,
  CreateAdvertisementParams,
  UpdateAdvertisementParams,
  P2POrder,
  ChatMessage,
  SendMessageParams,
  PaymentMethod,
  ApiResponse,
  PaginatedResponse,
  AdvertisementFilter,
  OrderFilter,
  P2PEvent,
  P2PEventType,
} from "./types/p2p";

export class P2PClient extends EventEmitter {
  private httpClient: HttpClient;
  private config: P2PConfig;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isConnected: boolean = false;

  constructor(config: P2PConfig) {
    super();
    this.config = config;
    this.httpClient = new HttpClient(config);

    // Initialize time sync on client creation
    this.initializeTimeSync();
  }

  /**
   * Initialize time synchronization
   */
  private async initializeTimeSync(): Promise<void> {
    try {
      const { TimeSync } = await import("./utils/timeSync");
      if (!TimeSync.isSynchronized()) {
        await TimeSync.forceSync(this.config.testnet);
      }
    } catch (error) {
      console.warn("[P2PClient] Time sync initialization failed:", error);
    }
  }

  /**
   * Connect to P2P service (simulates WebSocket connection)
   */
  async connect(): Promise<void> {
    try {
      // Test connection by getting account info
      await this.getAccountInfo();
      this.isConnected = true;
      this.emit("connected");

      if (this.config.debugMode) {
        console.log("P2P Client connected successfully");
      }
    } catch (error) {
      this.isConnected = false;
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Disconnect from P2P service
   */
  disconnect(): void {
    // Clear all polling intervals
    for (const [key, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.isConnected = false;
    this.emit("disconnected");
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    // Don't send empty object, send undefined or null for empty body
    return await this.httpClient.post("/v5/p2p/user/personal/info");
  }

  // ========== Advertisement Methods ==========

  /**
   * Get all active advertisements
   */
  async getActiveAdvertisements(
    filter?: AdvertisementFilter,
  ): Promise<PaginatedResponse<P2PAdvertisement>> {
    const response = await this.httpClient.post<
      PaginatedResponse<P2PAdvertisement>
    >("/v5/p2p/item/online", filter);
    return response.result;
  }

  /**
   * Get my advertisements
   * Note: This endpoint doesn't support pagination parameters
   */
  async getMyAdvertisements(): Promise<PaginatedResponse<P2PAdvertisement>> {
    const response = await this.httpClient.post<any>(
      "/v5/p2p/item/personal/list",
      {},
    );

    // Ensure we have a valid response with result property
    if (!response || !response.result) {
      console.warn(
        "[P2PClient] getMyAdvertisements returned invalid response:",
        response,
      );
      // Return empty list response
      return {
        list: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPage: 0,
      };
    }

    // Map Bybit's response structure to our expected format
    // Bybit returns { count, items, hiddenFlag } but we expect { list, page, pageSize, totalCount, totalPage }
    const result = response.result;
    return {
      list: result.items || [],
      page: 1,
      pageSize: result.count || 0,
      totalCount: result.count || 0,
      totalPage: 1,
    };
  }

  /**
   * Get advertisement details
   */
  async getAdvertisementDetails(itemId: string): Promise<P2PAdvertisement> {
    const response = await this.httpClient.post<P2PAdvertisement>(
      "/v5/p2p/item/info",
      { itemId },
    );
    return response.result;
  }

  /**
   * Create new advertisement
   * Note: Bybit's create API only returns itemId and security fields, not full advertisement details
   */
  async createAdvertisement(params: CreateAdvertisementParams): Promise<any> {
    const response = await this.httpClient.post<any>(
      "/v5/p2p/item/create",
      params,
    );

    const result = response.result;
    this.emitEvent("AD_CREATED", result);
    return result;
  }

  /**
   * Update advertisement
   */
  async updateAdvertisement(
    params: UpdateAdvertisementParams,
  ): Promise<P2PAdvertisement> {
    const response = await this.httpClient.post<P2PAdvertisement>(
      "/v5/p2p/item/update",
      params,
    );

    const ad = response.result;
    this.emitEvent("AD_UPDATED", ad);
    return ad;
  }

  /**
   * Delete advertisement
   */
  async deleteAdvertisement(itemId: string): Promise<void> {
    await this.httpClient.post("/v5/p2p/item/cancel", { itemId });
    this.emitEvent("AD_DELETED", { itemId });
  }

  // ========== Order Methods ==========

  /**
   * Get all orders
   */
  async getOrders(
    filter?: OrderFilter,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<P2POrder>> {
    const response = await this.httpClient.post<any>(
      "/v5/p2p/order/simplifyList",
      { ...filter, page, pageSize },
    );

    if (this.config.debugMode) {
      console.log(
        "[P2PClient] getOrders response:",
        JSON.stringify(response.result, null, 2),
      );
    }

    // Handle response structure
    if (response.result && response.result.items !== undefined) {
      return {
        list: response.result.items || [],
        total: response.result.count || 0,
        page: page,
        pageSize: pageSize,
        totalCount: response.result.count || 0,
        totalPage: Math.ceil((response.result.count || 0) / pageSize),
      };
    }

    return response.result;
  }

  /**
   * Get orders using simplifyList endpoint directly
   * This endpoint returns orders with different statuses
   */
  async getOrdersSimplified(params: {
    page?: number;
    size?: number;
    status?: number;
  } = {}): Promise<{
    count: number;
    items: P2POrder[];
  }> {
    const response = await this.httpClient.post<any>(
      "/v5/p2p/order/simplifyList",
      {
        page: params.page || 1,
        size: params.size || 20,
        ...(params.status && { status: params.status }),
      }
    );

    // Only log in debug mode with verbose flag
    if (this.config.debugMode && process.env.VERBOSE_API_LOG === 'true') {
      console.log(
        "[P2PClient] getOrdersSimplified response:",
        JSON.stringify(response.result, null, 2),
      );
    }

    // Return the exact structure from the API
    return {
      count: response.result?.count || 0,
      items: response.result?.items || [],
    };
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedResponse<P2POrder>> {
    const response = await this.httpClient.post<any>(
      "/v5/p2p/order/pending/simplifyList",
      { page, pageSize },
    );

    if (this.config.debugMode) {
      console.log(
        "[P2PClient] getPendingOrders response:",
        JSON.stringify(response.result, null, 2),
      );
    }

    // Handle response structure - Bybit sometimes returns count > 0 but empty items
    // In this case, we should use the regular simplifyList endpoint
    if (response.result && response.result.count > 0 && (!response.result.items || response.result.items.length === 0)) {
      // Try the regular orders endpoint instead
      const ordersResponse = await this.getOrdersSimplified({
        page: page,
        size: pageSize,
        status: 10, // Get orders with status 10 (Payment in processing)
      });
      
      return {
        list: ordersResponse.items || [],
        total: ordersResponse.count || 0,
        page: page,
        pageSize: pageSize,
        totalCount: ordersResponse.count || 0,
        totalPage: Math.ceil((ordersResponse.count || 0) / pageSize),
      };
    }

    // Handle normal response
    if (response.result && response.result.items) {
      return {
        list: response.result.items,
        total: response.result.count || 0,
        page: page,
        pageSize: pageSize,
        totalCount: response.result.count || 0,
        totalPage: Math.ceil((response.result.count || 0) / pageSize),
      };
    }

    return response.result;
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId: string): Promise<P2POrder> {
    const response = await this.httpClient.post<P2POrder>(
      "/v5/p2p/order/info",
      { orderId },
    );
    return response.result;
  }

  /**
   * Mark order as paid
   */
  async markOrderAsPaid(orderId: string): Promise<void> {
    await this.httpClient.post("/v5/p2p/order/pay", { orderId });
    this.emitEvent("ORDER_PAID", { orderId });
  }

  /**
   * Release assets (complete order)
   */
  async releaseAssets(orderId: string): Promise<void> {
    await this.httpClient.post("/v5/p2p/order/finish", { orderId });
    this.emitEvent("ORDER_RELEASED", { orderId });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    await this.httpClient.post("/v5/p2p/order/cancel", { orderId, reason });
    this.emitEvent("ORDER_CANCELLED", { orderId });
  }

  // ========== Chat Methods ==========

  /**
   * Get chat messages for order
   */
  async getChatMessages(
    orderId: string,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<any> {
    const response = await this.httpClient.post<any>(
      "/v5/p2p/order/message/listpage",
      { 
        orderId, 
        currentPage: page.toString(),
        size: pageSize.toString()
      },
    );
    // Return the result array directly
    return response.result || [];
  }

  /**
   * Send chat message
   */
  async sendChatMessage(params: SendMessageParams): Promise<any> {
    // Generate msgUuid if not provided
    const msgUuid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map our params to Bybit's expected format
    const bybitParams = {
      orderId: params.orderId,
      message: params.message,
      contentType:
        params.messageType === "TEXT"
          ? "str"
          : params.messageType?.toLowerCase() || "str",
      msgUuid: msgUuid,
      fileName: params.fileName,
    };

    const response = await this.httpClient.post<any>(
      "/v5/p2p/order/message/send",
      bybitParams,
    );

    // Bybit returns null result for successful message send
    this.emitEvent("MESSAGE_RECEIVED", response.result);
    return response.result;
  }

  /**
   * Upload file to chat
   */
  async uploadFile(
    orderId: string,
    fileData: Buffer,
    fileName: string,
  ): Promise<any> {
    // Note: This would require multipart/form-data upload
    // Implementation depends on exact API requirements
    const response = await this.httpClient.post<any>(
      "/v5/p2p/order/file/upload",
      { orderId, fileData, fileName },
    );
    return response.result;
  }

  // ========== Payment Methods ==========

  /**
   * Get my payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await this.httpClient.post<PaymentMethod[]>(
      "/v5/p2p/user/payment/list",
      {},
    );

    if (this.config.debugMode) {
      console.log(
        "[P2PClient] Raw payment methods response:",
        JSON.stringify(response, null, 2),
      );
    }

    // Ensure we have a valid response with result property
    if (!response || !response.result) {
      console.warn(
        "[P2PClient] getPaymentMethods returned invalid response:",
        response,
      );
      return [];
    }

    // Ensure result is an array
    if (!Array.isArray(response.result)) {
      console.warn(
        "[P2PClient] getPaymentMethods result is not an array:",
        response.result,
      );
      return [];
    }

    return response.result;
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(
    paymentMethod: Omit<PaymentMethod, "id">,
  ): Promise<PaymentMethod> {
    const response = await this.httpClient.post<PaymentMethod>(
      "/v5/p2p/payment/add",
      paymentMethod,
    );
    return response.result;
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(
    paymentMethod: PaymentMethod,
  ): Promise<PaymentMethod> {
    const response = await this.httpClient.post<PaymentMethod>(
      "/v5/p2p/payment/update",
      paymentMethod,
    );
    return response.result;
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(paymentId: string): Promise<void> {
    await this.httpClient.post("/v5/p2p/payment/delete", { paymentId });
  }

  // ========== Polling Methods (WebSocket simulation) ==========

  /**
   * Cancel/Remove advertisement
   */
  async cancelAdvertisement(itemId: string): Promise<any> {
    try {
      const endpoint = "/v5/p2p/item/cancel";
      const params = { itemId };
      
      const response = await this.httpClient.post<any>(endpoint, params);
      
      console.log(`[P2PClient] Advertisement ${itemId} cancelled successfully`);
      this.emitEvent("advertisementCancelled", { itemId });
      
      return response.result;
    } catch (error: any) {
      console.error(`[P2PClient] Error cancelling advertisement ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Start polling for order updates
   */
  startOrderPolling(intervalMs: number = 5000): void {
    if (this.pollingIntervals.has("orders")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const orders = await this.getPendingOrders();
        for (const order of orders.list) {
          this.emit("orderUpdate", order);
        }
      } catch (error) {
        this.emit("error", error);
      }
    }, intervalMs);

    this.pollingIntervals.set("orders", interval);
  }

  /**
   * Start polling for chat messages
   */
  startChatPolling(orderId: string, intervalMs: number = 1500): void {
    const key = `chat_${orderId}`;
    if (this.pollingIntervals.has(key)) {
      return;
    }

    let processedMessageIds = new Set<string>();

    const interval = setInterval(async () => {
      try {
        const messages = await this.getChatMessages(orderId);
        if (messages && messages.list && Array.isArray(messages.list)) {
          for (const message of messages.list) {
            if (!processedMessageIds.has(message.messageId)) {
              console.log(
                `[P2PClient] New chat message detected: ${message.messageId} in order ${orderId}`,
              );
              this.emit("chatMessage", {
                ...message,
                orderId, // Ensure orderId is included
              });
              processedMessageIds.add(message.messageId);
            }
          }
        }
      } catch (error) {
        console.error(
          `[P2PClient] Error polling chat for order ${orderId}:`,
          error,
        );
        this.emit("error", error);
      }
    }, intervalMs);

    this.pollingIntervals.set(key, interval);
  }

  /**
   * Stop polling for specific key
   */
  stopPolling(key: string): void {
    const interval = this.pollingIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(key);
    }
  }

  // ========== Helper Methods ==========

  /**
   * Emit P2P event
   */
  private emitEvent(type: P2PEventType, data: any): void {
    const event: P2PEvent = {
      type,
      accountId: this.config.apiKey,
      data,
      timestamp: Date.now(),
    };
    this.emit("p2pEvent", event);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.isConnected;
  }
}
