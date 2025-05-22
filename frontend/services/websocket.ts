import { io, Socket } from 'socket.io-client';

interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

type EventHandler = (event: WebSocketEvent) => void;
type ConnectHandler = () => void;
type DisconnectHandler = () => void;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connectHandlers: ConnectHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      this.socket = io(serverUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      this.setupEventListeners();
      console.log('🔌 WebSocket service initialized');
    } catch (error) {
      console.error('🔌 Failed to initialize WebSocket:', error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      this.reconnectAttempts = 0;
      this.connectHandlers.forEach(handler => handler());
      
      // Join user room for targeted updates
      this.joinUserRoom(1); // TODO: Use real user ID from auth store
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket server:', reason);
      this.disconnectHandlers.forEach(handler => handler());
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('🔌 Max reconnection attempts reached');
      }
    });

    // Account status changes
    this.socket.on('account_status_change', (event: WebSocketEvent) => {
      console.log('📡 Account status change received:', event.data);
      this.emit('account_status_change', event);
    });

    // Session updates
    this.socket.on('session_update', (event: WebSocketEvent) => {
      console.log('📡 Session update received:', event.data);
      this.emit('session_update', event);
    });

    // New transactions
    this.socket.on('new_transaction', (event: WebSocketEvent) => {
      console.log('📡 New transaction received:', event.data);
      this.emit('new_transaction', event);
    });

    // New notifications
    this.socket.on('new_notification', (event: WebSocketEvent) => {
      console.log('📡 New notification received:', event.data);
      this.emit('new_notification', event);
    });

    // Balance updates
    this.socket.on('balance_update', (event: WebSocketEvent) => {
      console.log('📡 Balance update received:', event.data);
      this.emit('balance_update', event);
    });

    // Error events
    this.socket.on('error', (event: WebSocketEvent) => {
      console.error('📡 Error event received:', event.data);
      this.emit('error', event);
    });

    // Initialization progress
    this.socket.on('initialization_progress', (event: WebSocketEvent) => {
      console.log('📡 Initialization progress:', event.data);
      this.emit('initialization_progress', event);
    });

    // Stats updates
    this.socket.on('stats_update', (event: WebSocketEvent) => {
      this.emit('stats_update', event);
    });

    // System events
    this.socket.on('system_update', (event: WebSocketEvent) => {
      console.log('📡 System update:', event.data);
      this.emit('system_update', event);
    });

    // Transaction action completed
    this.socket.on('transaction_action_completed', (event: WebSocketEvent) => {
      console.log('📡 Transaction action completed:', event.data);
      this.emit('transaction_action_completed', event);
    });

    // Transaction updates from monitoring
    this.socket.on('transaction_updates', (event: WebSocketEvent) => {
      console.log('📡 Transaction updates:', event.data);
      this.emit('transaction_updates', event);
    });
  }

  // Join user-specific room for targeted updates
  joinUserRoom(userId: number) {
    if (this.socket) {
      this.socket.emit('join_user_room', userId);
      console.log(`🔌 Joined user room: user_${userId}`);
    }
  }

  // Join account-specific room for targeted updates
  joinAccountRoom(accountId: number, platform: 'gate' | 'bybit') {
    if (this.socket) {
      this.socket.emit('join_account_room', accountId, platform);
      console.log(`🔌 Joined account room: account_${platform}_${accountId}`);
    }
  }

  // Event subscription methods
  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  onConnect(handler: ConnectHandler) {
    this.connectHandlers.push(handler);
  }

  onDisconnect(handler: DisconnectHandler) {
    this.disconnectHandlers.push(handler);
  }

  // Emit events to internal handlers
  private emit(event: string, data: WebSocketEvent) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket instance for direct access if needed
  getSocket(): Socket | null {
    return this.socket;
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
    this.connectHandlers = [];
    this.disconnectHandlers = [];
  }

  // Reconnect manually
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

// Helper hook for React components
export const useWebSocket = () => {
  return websocketService;
};