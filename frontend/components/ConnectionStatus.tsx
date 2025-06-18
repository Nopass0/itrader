"use client";

import { useEffect } from 'react';
import { useApiCheck } from '@/hooks/useApiCheckSingleton';
import { Badge } from '@/components/ui/badge';

export function ConnectionStatus() {
  const { isOnline, isChecking } = useApiCheck();

  useEffect(() => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[ConnectionStatus] Online:', isOnline, 'Checking:', isChecking);
    }
  }, [isOnline, isChecking]);

  if (isChecking && !isOnline) {
    return (
      <Badge variant="secondary" className="animate-pulse">
        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse" />
        Подключение...
      </Badge>
    );
  }

  if (!isOnline) {
    return (
      <Badge variant="destructive">
        <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
        Оффлайн
      </Badge>
    );
  }

  return (
    <Badge variant="success">
      <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
      Онлайн
    </Badge>
  );
}