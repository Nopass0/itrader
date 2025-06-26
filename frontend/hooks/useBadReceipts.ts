import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useToast } from '@/components/ui/use-toast';

export interface BadReceipt {
  id: string;
  emailId: string;
  emailFrom: string;
  emailSubject?: string;
  attachmentName?: string;
  filePath?: string;
  fileHash?: string;
  amount?: number;
  parsedData?: any;
  rawText?: string;
  rawEmailData?: any;
  reason?: string;
  processed: boolean;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BadReceiptsStats {
  total: number;
  processed: number;
  unprocessed: number;
  totalAmount: number;
  averageAmount: number;
  receiptsWithAmount: number;
  topSenders: Array<{ sender: string; count: number }>;
  byReason: Array<{ reason: string; count: number }>;
}

export function useBadReceipts() {
  const { socket } = useSocket();
  const { toast } = useToast();
  const [badReceipts, setBadReceipts] = useState<BadReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<BadReceiptsStats | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  // Load bad receipts
  const loadBadReceipts = useCallback(async (params: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) => {
    if (!socket?.connected) return;

    setLoading(true);
    try {
      return new Promise<{ items: BadReceipt[]; total: number }>((resolve, reject) => {
        socket.emit('badReceipts:list', params, (response: any) => {
          if (response.success) {
            setBadReceipts(response.data.items);
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to load bad receipts'));
          }
        });
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить плохие чеки',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [socket, toast]);

  // Get bad receipt by ID
  const getBadReceipt = useCallback(async (id: string) => {
    if (!socket?.connected) return;

    return new Promise<BadReceipt>((resolve, reject) => {
      socket.emit('badReceipts:get', { id }, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to get bad receipt'));
        }
      });
    });
  }, [socket]);

  // Download bad receipt
  const downloadBadReceipt = useCallback(async (id: string) => {
    if (!socket?.connected) return;

    try {
      return new Promise<{ filename: string; content: string; contentType: string }>((resolve, reject) => {
        socket.emit('badReceipts:download', { id }, (response: any) => {
          if (response.success) {
            const { filename, content, contentType } = response.data;
            
            // Convert base64 to blob
            const byteCharacters = atob(content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: contentType });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast({
              title: 'Успешно',
              description: 'Файл загружен'
            });
            
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to download bad receipt'));
          }
        });
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить файл',
        variant: 'destructive'
      });
      throw error;
    }
  }, [socket, toast]);

  // Delete bad receipt
  const deleteBadReceipt = useCallback(async (id: string) => {
    if (!socket?.connected) return;

    return new Promise<void>((resolve, reject) => {
      socket.emit('badReceipts:delete', { id }, (response: any) => {
        if (response.success) {
          setBadReceipts(prev => prev.filter(r => r.id !== id));
          toast({
            title: 'Успешно',
            description: 'Плохой чек удален'
          });
          resolve();
        } else {
          reject(new Error(response.error?.message || 'Failed to delete bad receipt'));
        }
      });
    });
  }, [socket, toast]);

  // Load statistics
  const loadStats = useCallback(async () => {
    if (!socket?.connected) return;

    return new Promise<BadReceiptsStats>((resolve, reject) => {
      socket.emit('badReceipts:getStats', {}, (response: any) => {
        if (response.success) {
          setStats(response.data);
          resolve(response.data);
        } else {
          reject(new Error(response.error?.message || 'Failed to load statistics'));
        }
      });
    });
  }, [socket]);

  // Subscribe to updates
  const subscribe = useCallback(() => {
    if (!socket?.connected || subscribed) return;

    socket.emit('badReceipts:subscribe', {}, (response: any) => {
      if (response.success) {
        setSubscribed(true);
      }
    });

    // Listen for new bad receipts
    socket.on('badReceipt:new', (badReceipt: BadReceipt) => {
      setBadReceipts(prev => [badReceipt, ...prev]);
      toast({
        title: 'Новый плохой чек',
        description: `От: ${badReceipt.emailFrom}`
      });
    });

    // Listen for updates
    socket.on('badReceipt:updated', (updatedReceipt: BadReceipt) => {
      setBadReceipts(prev => prev.map(r => 
        r.id === updatedReceipt.id ? updatedReceipt : r
      ));
    });

    // Listen for deletions
    socket.on('badReceipt:deleted', (id: string) => {
      setBadReceipts(prev => prev.filter(r => r.id !== id));
    });
  }, [socket, subscribed, toast]);

  // Unsubscribe from updates
  const unsubscribe = useCallback(() => {
    if (!socket?.connected || !subscribed) return;

    socket.emit('badReceipts:unsubscribe', {}, (response: any) => {
      if (response.success) {
        setSubscribed(false);
      }
    });

    socket.off('badReceipt:new');
    socket.off('badReceipt:updated');
    socket.off('badReceipt:deleted');
  }, [socket, subscribed]);

  // Subscribe on mount
  useEffect(() => {
    if (socket?.connected) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [socket?.connected, subscribe, unsubscribe]);

  return {
    badReceipts,
    loading,
    stats,
    loadBadReceipts,
    getBadReceipt,
    downloadBadReceipt,
    deleteBadReceipt,
    loadStats,
    subscribe,
    unsubscribe
  };
}