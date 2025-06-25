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
  private isInitialized = false;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Don't auto-connect, let the provider handle it
  }

  initialize() {
    if (this.isInitialized || typeof window === 'undefined') {
      console.log('🔌 WebSocket already initialized or not in browser');
      return;
    }
    console.log('🔌 Initializing WebSocket service');
    this.isInitialized = true;
    this.connect();
  }

  private connect() {
    if (this.socket?.connected || this.isConnecting) {
      console.log('🔌 WebSocket already connected or connecting');
      return;
    }

    try {
      this.isConnecting = true;
      // Determine WebSocket URL dynamically
      let wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
      
      // If in browser and no explicit URL is set, use current hostname
      if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_WS_URL) {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        // WebSocket API runs on port 3001
        wsUrl = `${protocol}//${hostname}:3001`;
      }
      
      this.socket = io(wsUrl, {
        autoConnect: false,
        reconnection: false,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });
      
      // Setup listeners before connecting
      this.setupEventListeners();
      
      // Now manually connect
      this.socket.connect();
      console.log('🔌 WebSocket service initialized');
    } catch (error) {
      console.error('🔌 Failed to initialize WebSocket:', error);
      this.isConnecting = false;
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Remove all existing listeners first to prevent duplicates
    this.socket.removeAllListeners();

    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.connectHandlers.forEach(handler => handler());
      
      // Join user room for targeted updates
      this.joinUserRoom(1); // TODO: Use real user ID from auth store
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket server:', reason);
      this.isConnecting = false;
      this.disconnectHandlers.forEach(handler => handler());
      
      // Disable automatic reconnection for now
      // Only log the disconnect reason
      console.log('🔌 Disconnect reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error.message);
      this.isConnecting = false;
      // Disable automatic reconnection for now
      // Just log the error
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.isInitialized = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  // Reconnect manually
  reconnect() {
    if (!this.isInitialized) {
      this.initialize();
    } else if (this.socket && !this.socket.connected && !this.isConnecting) {
      this.isConnecting = true;
      this.socket.connect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectTimer || this.isConnecting || !this.isInitialized) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('🔌 Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔌 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.socket && !this.socket.connected && !this.isConnecting) {
        this.isConnecting = true;
        this.socket.connect();
      }
    }, delay);
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Add to window object to ensure true singleton in development
if (typeof window !== 'undefined') {
  if (!(window as any).__websocketService) {
    (window as any).__websocketService = websocketService;
  }
}

// Export the singleton from window if available, otherwise use local instance
export const getWebSocketService = () => {
  if (typeof window !== 'undefined' && (window as any).__websocketService) {
    return (window as any).__websocketService as WebSocketService;
  }
  return websocketService;
};

// Export for backward compatibility
export { websocketService };

// Helper hook for React components
export const useWebSocket = () => {
  return getWebSocketService();
};