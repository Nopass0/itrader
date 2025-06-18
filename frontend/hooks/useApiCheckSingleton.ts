"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { socketApi } from '@/services/socket-api';

// Global state management for API check
let globalIsOnline = false;
let globalIsChecking = false;
let globalError: string | null = null;
let globalListeners: Set<() => void> = new Set();
let globalCheckPromise: Promise<boolean> | null = null;
let lastCheckTime = 0;
let lastToastTime = 0;

const notifyListeners = () => {
  globalListeners.forEach(listener => listener());
};

const globalCheckApi = async (force: boolean = false): Promise<boolean> => {
  // Prevent multiple simultaneous checks
  if (globalCheckPromise) {
    return globalCheckPromise;
  }

  // Throttle checks to prevent rapid re-checks (unless forced)
  const now = Date.now();
  if (!force && now - lastCheckTime < 5000) { // 5 second minimum between checks
    return globalIsOnline;
  }

  lastCheckTime = now;
  globalIsChecking = true;
  globalError = null;
  notifyListeners();

  globalCheckPromise = (async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useApiCheck] Starting connection check...');
      }
      
      // Try to connect
      await socketApi.connect();
      
      // Small delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if connected
      const connected = socketApi.isConnected();
      if (process.env.NODE_ENV === 'development') {
        console.log('[useApiCheck] Is connected:', connected);
      }
      
      if (connected) {
        // Try health check
        if (process.env.NODE_ENV === 'development') {
          console.log('[useApiCheck] Sending health check...');
        }
        const response = await socketApi.emit('health:check');
        if (process.env.NODE_ENV === 'development') {
          console.log('[useApiCheck] Health check response:', response);
        }
        
        if (response && response.success) {
          globalIsOnline = true;
          globalError = null;
          return true;
        }
      }
      
      // Connection failed
      globalIsOnline = false;
      globalError = 'Сервер недоступен. Пожалуйста, проверьте подключение.';
      return false;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useApiCheck] Unexpected error:', err);
      }
      globalIsOnline = false;
      globalError = 'Произошла ошибка при проверке подключения.';
      return false;
    } finally {
      globalIsChecking = false;
      globalCheckPromise = null;
      notifyListeners();
    }
  })();

  return globalCheckPromise;
};

// Set up global socket event listeners
if (typeof window !== 'undefined') {
  let reconnectTimeout: NodeJS.Timeout | null = null;
  
  socketApi.on('connect', () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    globalIsOnline = true;
    globalError = null;
    notifyListeners();
  });

  socketApi.on('disconnect', (reason: string) => {
    // Don't immediately mark as offline for client-side disconnects (like auth changes)
    if (reason === 'io client disconnect') {
      // Wait a bit to see if we reconnect quickly
      reconnectTimeout = setTimeout(() => {
        if (!socketApi.isConnected()) {
          globalIsOnline = false;
          globalError = 'Соединение с сервером потеряно';
          notifyListeners();
        }
      }, 2000);
    } else {
      globalIsOnline = false;
      globalError = 'Соединение с сервером потеряно';
      notifyListeners();
    }
  });

  // Initial check on load with delay to let auth initialize
  setTimeout(() => {
    globalCheckApi();
  }, 1000);

  // Set up interval to check every 30 seconds
  setInterval(() => {
    if (!globalIsChecking) {
      globalCheckApi();
    }
  }, 30000);
}

export function useApiCheck() {
  const [, forceUpdate] = useState({});
  const { toast } = useToast();
  const hasShownErrorToastRef = useRef(false);

  // Subscribe to global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  // Handle toast notifications with rate limiting
  useEffect(() => {
    const now = Date.now();
    
    // Rate limit toasts to prevent spam (minimum 10 seconds between toasts)
    if (now - lastToastTime < 10000) {
      return;
    }
    
    if (!globalIsOnline && !hasShownErrorToastRef.current && globalError) {
      hasShownErrorToastRef.current = true;
      lastToastTime = now;
      toast({
        title: 'Сервер недоступен',
        description: globalError,
        variant: 'destructive',
      });
    } else if (globalIsOnline && hasShownErrorToastRef.current) {
      hasShownErrorToastRef.current = false;
      lastToastTime = now;
      toast({
        title: 'Сервер доступен',
        description: 'Соединение с сервером восстановлено.',
        variant: 'success',
      });
    }
  }, [toast]);

  const checkApi = useCallback((force: boolean = false) => {
    return globalCheckApi(force);
  }, []);

  return {
    isOnline: globalIsOnline,
    isChecking: globalIsChecking,
    error: globalError,
    checkApi,
  };
}