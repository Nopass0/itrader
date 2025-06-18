"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => boolean;
  emitWithAck: (event: string, ...args: any[]) => Promise<any>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();
  
  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

  // Connect to socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      socketRef.current = io(url, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: token ? { token } : undefined,
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        console.log('[SocketContext] Connected to WebSocket server');
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
        console.log('[SocketContext] Disconnected from WebSocket server');
      });

      socketRef.current.on('connect_error', (err) => {
        setIsConnecting(false);
        setError(err.message);
        console.error('[SocketContext] Connection error:', err.message);
      });

      socketRef.current.on('error', (err) => {
        setError(typeof err === 'string' ? err : 'Ошибка подключения');
        console.error('[SocketContext] Socket error:', err);
      });
    } catch (err: any) {
      setIsConnecting(false);
      setError(err.message || 'Ошибка при инициализации подключения');
      console.error('[SocketContext] Init error:', err);
    }
  }, [url, token]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Initialize connection on mount and when token changes
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [token]);

  // Subscribe to an event
  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on(event, callback);
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  // Emit an event
  const emit = useCallback(
    (event: string, ...args: any[]) => {
      if (!socketRef.current || !isConnected) {
        setError('Сокет не подключен');
        return false;
      }
      
      socketRef.current.emit(event, ...args);
      return true;
    },
    [isConnected]
  );

  // Emit with acknowledgment
  const emitWithAck = useCallback(
    (event: string, ...args: any[]): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected) {
          reject(new Error('Сокет не подключен'));
          return;
        }
        
        socketRef.current.emit(event, ...args, (response: any) => {
          resolve(response);
        });
      });
    },
    [isConnected]
  );

  const value = useMemo(() => ({
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    on,
    emit,
    emitWithAck,
  }), [isConnected, isConnecting, error, connect, disconnect, on, emit, emitWithAck]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};