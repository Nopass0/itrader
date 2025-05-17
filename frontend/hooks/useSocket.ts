"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

interface UseSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export function useSocket(
  url: string = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
  options: UseSocketOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();
  
  const defaultOptions = {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    ...options,
  };

  // Connect to socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      socketRef.current = io(url, {
        autoConnect: defaultOptions.autoConnect,
        reconnection: defaultOptions.reconnection,
        reconnectionAttempts: defaultOptions.reconnectionAttempts,
        reconnectionDelay: defaultOptions.reconnectionDelay,
        auth: token ? { token } : undefined,
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (err) => {
        setIsConnecting(false);
        setError(err.message);
      });

      socketRef.current.on('error', (err) => {
        setError(typeof err === 'string' ? err : 'Ошибка подключения');
      });
    } catch (err: any) {
      setIsConnecting(false);
      setError(err.message || 'Ошибка при инициализации подключения');
    }
  }, [url, token, defaultOptions]);

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
    if (defaultOptions.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, defaultOptions.autoConnect]);

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

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    on,
    emit,
  };
}