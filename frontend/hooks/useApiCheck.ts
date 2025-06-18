"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { socketApi } from '@/services/socket-api';

export function useApiCheck() {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkApi = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      console.log('[useApiCheck] Starting connection check...');
      
      // Multiple attempts to connect with better error handling
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`[useApiCheck] Connection attempt ${attempts}/${maxAttempts}`);
        
        try {
          // Try to connect
          await socketApi.connect();
          
          // Small delay to ensure connection is established
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if connected
          const connected = socketApi.isConnected();
          console.log('[useApiCheck] Is connected:', connected);
          
          if (connected) {
            // Try health check
            console.log('[useApiCheck] Sending health check...');
            const response = await socketApi.emit('health:check');
            console.log('[useApiCheck] Health check response:', response);
            
            if (response && response.success) {
              setIsOnline(true);
              setError(null);
              return true;
            }
          }
        } catch (attemptError) {
          console.error(`[useApiCheck] Attempt ${attempts} failed:`, attemptError);
        }
        
        // Wait before next attempt
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // All attempts failed
      console.log('[useApiCheck] All connection attempts failed');
      setIsOnline(false);
      setError('Сервер недоступен. Пожалуйста, проверьте подключение.');
      return false;
    } catch (err) {
      console.error('[useApiCheck] Unexpected error:', err);
      setIsOnline(false);
      setError('Произошла ошибка при проверке подключения.');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Track whether we've shown an error toast
  const [hasShownErrorToast, setHasShownErrorToast] = useState(false);

  // Reset error toast flag when the server comes back online
  useEffect(() => {
    if (isOnline && hasShownErrorToast) {
      setHasShownErrorToast(false);
      toast({
        title: 'Сервер доступен',
        description: 'Соединение с сервером восстановлено.',
        variant: 'success',
      });
    }
  }, [isOnline, hasShownErrorToast, toast]);

  // Check on mount and set up interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let mounted = true;

    const initialCheck = async () => {
      if (!mounted) return;
      
      const isAvailable = await checkApi();

      // If API is not available, show a toast notification (only once)
      if (!isAvailable && !hasShownErrorToast && mounted) {
        setHasShownErrorToast(true);
        toast({
          title: 'Сервер недоступен',
          description: 'Сервер API недоступен. Пожалуйста, проверьте подключение.',
          variant: 'destructive',
        });
      }

      // Set up interval to check every 30 seconds
      if (mounted) {
        interval = setInterval(async () => {
          if (mounted) {
            await checkApi();
          }
        }, 30000);
      }
    };

    initialCheck();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []); // Remove dependencies to prevent re-runs

  // Listen for socket connection events
  useEffect(() => {
    const handleConnect = () => {
      setIsOnline(true);
      setError(null);
    };

    const handleDisconnect = () => {
      setIsOnline(false);
      setError('Соединение с сервером потеряно');
    };

    socketApi.on('connect', handleConnect);
    socketApi.on('disconnect', handleDisconnect);

    return () => {
      socketApi.off('connect', handleConnect);
      socketApi.off('disconnect', handleDisconnect);
    };
  }, []);

  return {
    isOnline,
    isChecking,
    error,
    checkApi,
  };
}