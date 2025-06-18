"use client";

import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export function useLogsCount() {
  const { emitWithAck, on, isConnected } = useSocket();
  const [logsCount, setLogsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchLogsCount = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      const response = await emitWithAck('logs:get', { limit: 0 });
      if (response.success) {
        setLogsCount(response.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch logs count:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsCount();
  }, [isConnected]);

  // Listen for new logs
  useEffect(() => {
    if (!isConnected) return;

    const handleNewLog = () => {
      setLogsCount(prev => prev + 1);
    };

    const unsubscribe = on('logs:new', handleNewLog);

    return unsubscribe;
  }, [isConnected, on]);

  // Format count for display
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return {
    count: logsCount,
    formattedCount: formatCount(logsCount),
    loading
  };
}