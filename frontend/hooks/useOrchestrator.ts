import { useState, useEffect, useCallback } from 'react';
import { socketApi } from '@/services/socket-api';
import { useAuthStore } from '@/store/auth';

interface OrchestratorStatus {
  isRunning: boolean;
  status: 'running' | 'paused' | 'stopped';
  runningTasks: string[];
  scheduledTasks: string[];
  lastUpdated?: string;
}

export function useOrchestrator() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  // Check if user has permission to control orchestrator
  const canControl = user?.role === 'admin' || user?.role === 'operator';

  // Fetch orchestrator status
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await socketApi.orchestrator.getStatus();
      
      if (response.success && response.data) {
        setStatus(response.data);
      } else {
        setError(response.error?.message || 'Failed to fetch orchestrator status');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching orchestrator status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Pause orchestrator
  const pause = useCallback(async () => {
    if (!canControl) {
      setError('You do not have permission to control the orchestrator');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await socketApi.emit('orchestrator:pause');
      
      if (response.success) {
        // Update local status immediately
        setStatus(prev => prev ? { ...prev, isRunning: false, status: 'paused' } : null);
        return true;
      } else {
        setError(response.error?.message || 'Failed to pause orchestrator');
        return false;
      }
    } catch (err) {
      setError('Failed to pause orchestrator');
      console.error('Error pausing orchestrator:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [canControl]);

  // Resume orchestrator
  const resume = useCallback(async () => {
    if (!canControl) {
      setError('You do not have permission to control the orchestrator');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await socketApi.emit('orchestrator:resume');
      
      if (response.success) {
        // Update local status immediately
        setStatus(prev => prev ? { ...prev, isRunning: true, status: 'running' } : null);
        return true;
      } else {
        setError(response.error?.message || 'Failed to resume orchestrator');
        return false;
      }
    } catch (err) {
      setError('Failed to resume orchestrator');
      console.error('Error resuming orchestrator:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [canControl]);

  // Toggle orchestrator state
  const toggle = useCallback(async () => {
    if (status?.isRunning) {
      return pause();
    } else {
      return resume();
    }
  }, [status, pause, resume]);

  // Set up real-time event listeners
  useEffect(() => {
    const handlePaused = (data: any) => {
      setStatus(prev => prev ? { ...prev, isRunning: false, status: 'paused' } : null);
    };

    const handleResumed = (data: any) => {
      setStatus(prev => prev ? { ...prev, isRunning: true, status: 'running' } : null);
    };

    const handleStarted = (data: any) => {
      setStatus(prev => prev ? { ...prev, isRunning: true, status: 'running' } : null);
    };

    const handleStopped = (data: any) => {
      setStatus(prev => prev ? { ...prev, isRunning: false, status: 'stopped' } : null);
    };

    // Subscribe to orchestrator events
    socketApi.on('orchestrator:paused', handlePaused);
    socketApi.on('orchestrator:resumed', handleResumed);
    socketApi.on('orchestrator:started', handleStarted);
    socketApi.on('orchestrator:stopped', handleStopped);

    // Fetch initial status
    fetchStatus();

    // Cleanup
    return () => {
      socketApi.off('orchestrator:paused', handlePaused);
      socketApi.off('orchestrator:resumed', handleResumed);
      socketApi.off('orchestrator:started', handleStarted);
      socketApi.off('orchestrator:stopped', handleStopped);
    };
  }, [fetchStatus]);

  // Periodic status refresh (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    canControl,
    pause,
    resume,
    toggle,
    refresh: fetchStatus
  };
}