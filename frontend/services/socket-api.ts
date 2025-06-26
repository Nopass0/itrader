import { io, Socket } from 'socket.io-client';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

type SocketCallback<T = any> = (response: ApiResponse<T>) => void;

class SocketApiClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isInitialized = false;
  private connectPromise: Promise<void> | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor() {
    // Initialize token from localStorage if available
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        this.token = storedToken;
      }
    }
  }

  async connect(): Promise<void> {
    return this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized && this.socket?.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      try {
        // WebSocket server runs on port 3002
        // Determine WebSocket URL dynamically
        let wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';
        
        // If in browser and no explicit URL is set, use current hostname
        if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_WS_URL) {
          const hostname = window.location.hostname;
          const protocol = window.location.protocol;
          // WebSocket API runs on port 3002
          wsUrl = `${protocol}//${hostname}:3002`;
        }
        
        if (process.env.NODE_ENV === 'development') {
      console.log('[SocketApiClient] Initializing connection to:', wsUrl);
    }
        
        // Only send auth token if we have one
        const socketOptions: any = {
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          timeout: 10000,
          transports: ['websocket', 'polling'],
          autoConnect: true
        };
        
        if (this.token) {
          socketOptions.auth = { token: this.token };
        }
        
        this.socket = io(wsUrl, socketOptions);

        // Set up event listeners before connect
        this.setupEventListeners();
        
        // Handle successful connection
        this.socket.on('connect', () => {
          if (process.env.NODE_ENV === 'development' && !this.isInitialized) {
            console.log('✅ Connected to WebSocket API');
          }
          this.isInitialized = true;
          this.reconnectAttempts = 0;
          this.connectPromise = null; // Clear promise so we can reconnect if needed
          resolve();
        });

        // Handle connection errors
        this.socket.on('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error.message);
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.connectPromise = null;
            reject(error);
          }
        });

        // Ensure socket connects
        if (!this.socket.connected) {
          this.socket.connect();
        }
      } catch (error) {
        this.connectPromise = null;
        reject(error);
      }
    }).catch(error => {
      // Reset state on error
      this.connectPromise = null;
      this.isInitialized = false;
      throw error;
    });

    return this.connectPromise;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Real-time events
    const events = [
      'transaction:updated',
      'transaction:created',
      'payout:created',
      'payout:updated',
      'payout:cancelled',
      'advertisement:created',
      'advertisement:updated',
      'advertisement:toggled',
      'advertisement:deleted',
      'rate:changed',
      'chat:message',
      'orchestrator:started',
      'orchestrator:stopped',
      'receipts:new',
      'receipts:matched',
      'receipts:deleted'
    ];

    events.forEach(event => {
      this.socket!.on(event, (data: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SocketApiClient] Event received: ${event}`, data);
        }
        this.triggerHandlers(event, data);
      });
    });

    // Handle disconnect
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket API:', reason);
      this.triggerHandlers('disconnect', reason);
    });

    // Handle reconnect
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to WebSocket API after', attemptNumber, 'attempts');
      this.triggerHandlers('reconnect', attemptNumber);
    });
  }

  // Authentication
  async login(username: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    await this.initialize();
    
    return new Promise((resolve) => {
      this.socket!.emit('auth:login', { username, password }, (response: ApiResponse) => {
        if (response.success && response.data?.token) {
          this.setToken(response.data.token);
          // Update socket auth without reconnecting to prevent loops
          if (this.socket) {
            this.socket.auth.token = response.data.token;
          }
        }
        resolve(response);
      });
    });
  }

  async logout(): Promise<ApiResponse> {
    return new Promise((resolve) => {
      this.socket!.emit('auth:logout', (response: ApiResponse) => {
        this.clearToken();
        resolve(response);
      });
    });
  }

  async setToken(token: string): Promise<void> {
    // If token hasn't changed, no need to do anything
    if (this.token === token) {
      return;
    }
    
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
    
    // If socket exists and is connected, we need to reconnect with new auth
    if (this.socket && this.socket.connected) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[SocketApiClient] Reconnecting with new token...');
      }
      
      // Temporarily disable auto-reconnect to prevent multiple reconnection attempts
      const wasReconnectionEnabled = this.socket.io.reconnection();
      this.socket.io.reconnection(false);
      
      // Create a promise that resolves when reconnected
      return new Promise((resolve) => {
        const onReconnect = () => {
          this.socket!.off('connect', onReconnect);
          this.socket!.io.reconnection(wasReconnectionEnabled);
          if (process.env.NODE_ENV === 'development') {
            console.log('[SocketApiClient] Reconnected with new auth');
          }
          resolve();
        };
        
        this.socket.on('connect', onReconnect);
        
        // Update auth and reconnect
        this.socket.auth = { token };
        this.socket.disconnect();
        this.socket.connect();
      });
    } else if (this.socket) {
      // Just update auth if not connected
      this.socket.auth = { token };
    }
  }

  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    if (this.socket) {
      this.socket.auth.token = '';
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // Generic emit method for all API calls
  async emit<T = any>(event: string, data?: any): Promise<ApiResponse<T>> {
    try {
      await this.initialize();
      
      // Double-check socket is connected
      if (!this.socket || !this.socket.connected) {
        console.error('[SocketApiClient] Socket not connected when trying to emit:', event);
        return {
          success: false,
          error: {
            code: 'NOT_CONNECTED',
            message: 'Socket not connected'
          }
        };
      }
      
      return new Promise((resolve, reject) => {
        // Add timeout
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for response to ${event}`));
        }, 10000); // 10 second timeout
        
        const callback: SocketCallback<T> = (response) => {
          clearTimeout(timeout);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[SocketApiClient] Response for ${event}:`, response);
          }
          
          // Ensure we have a valid response
          if (response === undefined || response === null) {
            resolve({
              success: false,
              error: {
                code: 'NO_RESPONSE',
                message: 'No response from server'
              }
            });
          } else {
            resolve(response);
          }
        };

        if (process.env.NODE_ENV === 'development') {
          console.log(`[SocketApiClient] Emitting ${event} with data:`, data);
        }
        
        if (data !== undefined) {
          this.socket!.emit(event, data, callback);
        } else {
          this.socket!.emit(event, callback);
        }
      });
    } catch (error) {
      console.error(`[SocketApiClient] Error in emit for ${event}:`, error);
      return {
        success: false,
        error: {
          code: 'EMIT_ERROR',
          message: error.message || 'Failed to emit event'
        }
      };
    }
  }

  // Event handling
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private triggerHandlers(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  // Get raw socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isInitialized = false;
      this.connectPromise = null;
    }
  }

  // API Methods matching the backend controllers

  // System Accounts
  accounts = {
    create: (data: { username: string; role?: string }) => 
      this.emit('accounts:create', data),
    update: (data: { id: string; updates: any }) => 
      this.emit('accounts:update', data),
    delete: (data: { id: string }) => 
      this.emit('accounts:delete', data),
    list: (params?: PaginationParams) => 
      this.emit('accounts:list', params || {}),
    resetPassword: (data: { id: string }) => 
      this.emit('accounts:resetPassword', data),
    getCurrentUser: () => 
      this.emit('accounts:getCurrentUser'),
    changePassword: (data: { currentPassword: string; newPassword: string }) => 
      this.emit('accounts:changePassword', data),
    
    // Platform Accounts (Gate, Bybit)
    listGateAccounts: (params?: PaginationParams & { isActive?: boolean }) => 
      this.emit('accounts:listGateAccounts', params || {}),
    createGateAccount: (data: { email: string; password: string; apiKey: string; apiSecret: string; accountName?: string }) => 
      this.emit('accounts:createGateAccount', data),
    updateGateAccount: (data: { id: string; updates: any }) => 
      this.emit('accounts:updateGateAccount', data),
    deleteGateAccount: (id: string) => 
      this.emit('accounts:deleteGateAccount', { id }),
    getGateAccountStats: (id: string) => 
      this.emit('accounts:getGateAccountStats', { id }),
    
    listBybitAccounts: (params?: PaginationParams & { isActive?: boolean }) => 
      this.emit('accounts:listBybitAccounts', params || {}),
    createBybitAccount: (data: { apiKey: string; apiSecret: string; accountName?: string }) => 
      this.emit('accounts:createBybitAccount', data),
    updateBybitAccount: (data: { id: string; updates: any }) => 
      this.emit('accounts:updateBybitAccount', data),
    deleteBybitAccount: (id: string) => 
      this.emit('accounts:deleteBybitAccount', { id }),
    getBybitAccountStats: (id: string) => 
      this.emit('accounts:getBybitAccountStats', { id }),
  };

  // Transactions
  transactions = {
    list: (params?: PaginationParams & { status?: string; orderId?: string; dateFrom?: string; dateTo?: string }) => 
      this.emit('transactions:list', params || {}),
    get: (id: string) => 
      this.emit('transactions:get', { id }),
    updateStatus: (data: { id: string; status: string; reason?: string }) => 
      this.emit('transactions:updateStatus', data),
    addCustomStatus: (data: { code: string; name: string; description?: string; color?: string; isFinal?: boolean }) => 
      this.emit('transactions:addCustomStatus', data),
    updateCustomStatus: (data: { id: string; updates: any }) => 
      this.emit('transactions:updateCustomStatus', data),
    deleteCustomStatus: (data: { id: string }) => 
      this.emit('transactions:deleteCustomStatus', data),
    listStatuses: () => 
      this.emit('transactions:listStatuses'),
    getStatistics: (params?: { dateFrom?: string; dateTo?: string }) => 
      this.emit('transactions:getStatistics', params || {}),
  };

  // Payouts
  payouts = {
    list: (params?: PaginationParams & { status?: string; gateAccountId?: string; minAmount?: number; maxAmount?: number; dateFrom?: string; dateTo?: string }) => 
      this.emit('payouts:list', params || {}),
    get: (id: string) => 
      this.emit('payouts:get', { id }),
    create: (data: { gateAccountId: string; amount: number; recipientCard: string; recipientName?: string; description?: string }) => 
      this.emit('payouts:create', data),
    updateStatus: (data: { id: string; status: string; failureReason?: string; transactionId?: string }) => 
      this.emit('payouts:updateStatus', data),
    linkToTransaction: (data: { payoutId: string; transactionId: string }) => 
      this.emit('payouts:linkToTransaction', data),
    cancel: (data: { id: string; reason: string }) => 
      this.emit('payouts:cancel', data),
    retry: (data: { id: string }) => 
      this.emit('payouts:retry', data),
    getStatistics: (params?: { gateAccountId?: string; dateFrom?: string; dateTo?: string }) => 
      this.emit('payouts:getStatistics', params || {}),
    export: (data: { format: 'csv' | 'json' | 'xlsx'; filters?: any }) => 
      this.emit('payouts:export', data),
  };

  // Advertisements
  advertisements = {
    list: (params?: PaginationParams & { isActive?: boolean; bybitAccountId?: string; type?: string; currency?: string; fiat?: string }) => 
      this.emit('advertisements:list', params || {}),
    get: (id: string) => 
      this.emit('advertisements:get', { id }),
    create: (data: any) => 
      this.emit('advertisements:create', data),
    update: (data: { id: string; updates: any }) => 
      this.emit('advertisements:update', data),
    toggle: (id: string) => 
      this.emit('advertisements:toggle', { id }),
    delete: (id: string) => 
      this.emit('advertisements:delete', { id }),
    bulkUpdatePrices: (data: { ids: string[]; priceAdjustment: { type: 'fixed' | 'percentage'; value: number } }) => 
      this.emit('advertisements:bulkUpdatePrices', data),
    getStatistics: (params?: { bybitAccountId?: string; dateFrom?: string; dateTo?: string }) => 
      this.emit('advertisements:getStatistics', params || {}),
    clone: (data: { id: string; bybitAccountId?: string }) => 
      this.emit('advertisements:clone', data),
  };

  // Exchange Rates
  rates = {
    get: () => 
      this.emit('rates:get'),
    setConstant: (rate: number) => 
      this.emit('rates:setConstant', { rate }),
    toggleMode: () => 
      this.emit('rates:toggleMode'),
    history: (params?: PaginationParams & { source?: string; dateFrom?: string; dateTo?: string }) => 
      this.emit('rates:history', params || {}),
    setMarkup: (markup: number) => 
      this.emit('rates:setMarkup', { markup }),
    forceUpdate: () => 
      this.emit('rates:forceUpdate'),
    getStatistics: (period?: 'hour' | 'day' | 'week' | 'month') => 
      this.emit('rates:getStatistics', { period }),
  };

  // Chats
  chats = {
    list: (params?: PaginationParams & { orderId?: string; advertisementId?: string }) => 
      this.emit('chats:list', params || {}),
    getMessages: (data: { transactionId: string; limit?: number; offset?: number }) => 
      this.emit('chats:getMessages', data),
    sendMessage: (data: { transactionId: string; message: string; isAutoReply?: boolean }) => 
      this.emit('chats:sendMessage', data),
    markAsRead: (transactionId: string) => 
      this.emit('chats:markAsRead', { transactionId }),
    getUnread: () => 
      this.emit('chats:getUnread'),
    syncMessages: (transactionId: string) => 
      this.emit('chats:syncMessages', { transactionId }),
    getStatistics: (params?: { dateFrom?: string; dateTo?: string }) => 
      this.emit('chats:getStatistics', params || {}),
    export: (data: { transactionId: string; format: 'txt' | 'json' | 'csv' }) => 
      this.emit('chats:export', data),
  };

  // Templates
  templates = {
    list: (params?: PaginationParams & { groupId?: string; isActive?: boolean; search?: string }) => 
      this.emit('templates:list', params || {}),
    get: (id: string) => 
      this.emit('templates:get', { id }),
    create: (data: any) => 
      this.emit('templates:create', data),
    update: (data: { id: string; updates: any }) => 
      this.emit('templates:update', data),
    delete: (id: string) => 
      this.emit('templates:delete', { id }),
    listGroups: () => 
      this.emit('templates:listGroups'),
    createGroup: (data: { name: string; description?: string; color?: string }) => 
      this.emit('templates:createGroup', data),
    updateGroup: (data: { id: string; updates: any }) => 
      this.emit('templates:updateGroup', data),
    deleteGroup: (id: string) => 
      this.emit('templates:deleteGroup', { id }),
    findMatch: (data: { message: string; context?: any }) => 
      this.emit('templates:findMatch', data),
    test: (data: { templateId: string; testMessage: string }) => 
      this.emit('templates:test', data),
    bulkImport: (data: { templates: any[] }) => 
      this.emit('templates:bulkImport', data),
    export: (params?: { groupId?: string }) => 
      this.emit('templates:export', params || {}),
  };

  // Orchestrator
  orchestrator = {
    getStatus: () => 
      this.emit('orchestrator:getStatus'),
    start: () => 
      this.emit('orchestrator:start'),
    stop: () => 
      this.emit('orchestrator:stop'),
    restart: () => 
      this.emit('orchestrator:restart'),
    getConfig: () => 
      this.emit('orchestrator:getConfig'),
    updateConfig: (config: Record<string, string>) => 
      this.emit('orchestrator:updateConfig', { config }),
    getLogs: (params?: { level?: string; module?: string; limit?: number; offset?: number }) => 
      this.emit('orchestrator:getLogs', params || {}),
    clearLogs: (params?: { olderThan?: string }) => 
      this.emit('orchestrator:clearLogs', params || {}),
    runTask: (data: { taskType: string; params?: any }) => 
      this.emit('orchestrator:runTask', data),
    getStatistics: (params?: { dateFrom?: string; dateTo?: string }) => 
      this.emit('orchestrator:getStatistics', params || {}),
    test: (data: { testType: string; testData: any }) => 
      this.emit('orchestrator:test', data),
  };
}

// Create singleton instance
let socketApi: SocketApiClient;

// Ensure true singleton in both development and production
if (typeof window !== 'undefined') {
  // Check if instance already exists on window
  if ((window as any).__socketApi) {
    socketApi = (window as any).__socketApi;
  } else {
    // Create new instance and store on window
    socketApi = new SocketApiClient();
    (window as any).__socketApi = socketApi;
  }
} else {
  // Server-side rendering - create new instance
  socketApi = new SocketApiClient();
}

// Export the singleton from window if available, otherwise use local instance
export const getSocketApi = () => {
  if (typeof window !== 'undefined' && (window as any).__socketApi) {
    return (window as any).__socketApi as SocketApiClient;
  }
  return socketApi;
};

// Export both as named and default export
export { socketApi };
export default socketApi;