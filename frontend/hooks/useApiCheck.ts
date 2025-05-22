"use client";

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '@/components/ui/use-toast';

export function useApiCheck(url: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkApi = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      // Try to access the health endpoint
      const response = await axios.get(`${url}/health`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Check if we got a successful response with the expected structure
      if (response.status === 200 && response.data && response.data.status === 'ok') {
        setIsOnline(true);
        return true;
      } else {
        throw new Error('Invalid server response');
      }
    } catch (err) {
      console.error('API check failed:', err);
      setIsOnline(false);
      setError('Сервер недоступен. Пожалуйста, проверьте подключение.');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [url]);

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

    const initialCheck = async () => {
      const isAvailable = await checkApi();

      // If API is not available, show a toast notification (only once)
      if (!isAvailable && !hasShownErrorToast) {
        setHasShownErrorToast(true);
        toast({
          title: 'Сервер недоступен',
          description: 'Сервер API недоступен. Пожалуйста, проверьте подключение.',
          variant: 'destructive',
        });
      }

      // Set up interval to check every 30 seconds
      interval = setInterval(async () => {
        await checkApi();
      }, 30000);
    };

    initialCheck();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkApi, toast, hasShownErrorToast]);

  return {
    isOnline,
    isChecking,
    error,
    checkApi,
  };
}