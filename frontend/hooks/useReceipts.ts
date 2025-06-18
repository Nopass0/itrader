import { useState, useEffect, useCallback } from 'react';
import { useSocketApi } from './useSocketApi';

export interface TinkoffReceipt {
  id: string;
  emailId: string;
  emailFrom: string;
  emailSubject?: string;
  attachmentName: string;
  filePath: string;
  fileHash?: string;
  amount: number;
  bank: string;
  reference?: string;
  transferType?: string;
  status: string;
  senderName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientCard?: string;
  recipientBank?: string;
  commission?: number;
  transactionDate: Date;
  parsedData: any;
  rawText?: string;
  isProcessed: boolean;
  payoutId?: string;
  createdAt: Date;
  updatedAt: Date;
  payout?: {
    id: string;
    gatePayoutId?: number;
    gateAccount?: string;
    status: number;
    amount?: number;
  };
}

export interface ReceiptFilters {
  page?: number;
  limit?: number;
  search?: string;
  transactionId?: string;
  status?: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  sender?: string;
  wallet?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReceiptStats {
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    totalAmount: number;
    recentCount: number;
  };
  statusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  dailyStats: Array<{
    date: string;
    count: number;
    total_amount: number;
  }>;
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<TinkoffReceipt[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReceiptStats | null>(null);
  const [filters, setFilters] = useState<ReceiptFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const { api, isConnected, socket } = useSocketApi();

  const loadReceipts = useCallback(async () => {
    if (!isConnected) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.emit('receipts:list', filters);
      if (response.success) {
        setReceipts(response.data.data);
        setTotalCount(response.data.total);
        setTotalPages(response.data.totalPages);
      } else {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message || 'Failed to load receipts';
        setError(errorMessage);
      }
    } catch (err) {
      setError('Failed to load receipts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, isConnected, filters]);

  const loadStats = useCallback(async () => {
    if (!isConnected) return;

    try {
      const response = await api.emit('receipts:getStats', {});
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [api, isConnected]);

  const getReceipt = useCallback(async (id: string) => {
    if (!isConnected) return null;

    try {
      const response = await api.emit('receipts:get', { id });
      if (response.success) {
        return response.data;
      }
    } catch (err) {
      console.error('Failed to get receipt:', err);
    }
    return null;
  }, [api, isConnected]);

  const getReceiptPDF = useCallback(async (id: string) => {
    if (!isConnected) return null;

    try {
      const response = await api.emit('receipts:getPDF', { id });
      if (response.success) {
        return response.data;
      }
    } catch (err) {
      console.error('Failed to get receipt PDF:', err);
    }
    return null;
  }, [api, isConnected]);

  const deleteReceipt = useCallback(async (id: string) => {
    if (!isConnected) return false;

    try {
      const response = await api.emit('receipts:delete', { id });
      if (response.success) {
        await loadReceipts();
        return true;
      }
    } catch (err) {
      console.error('Failed to delete receipt:', err);
    }
    return false;
  }, [api, isConnected, loadReceipts]);

  const matchUnmatchedReceipts = useCallback(async () => {
    if (!isConnected) return null;

    try {
      const response = await api.emit('receipts:matchUnmatched', {});
      if (response.success) {
        await loadReceipts();
        await loadStats();
        return response.data;
      }
    } catch (err) {
      console.error('Failed to match receipts:', err);
    }
    return null;
  }, [api, isConnected, loadReceipts, loadStats]);

  const updateFilters = useCallback((newFilters: Partial<ReceiptFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1 // Reset to page 1 when filters change
    }));
  }, []);

  const downloadPDF = useCallback(async (receipt: TinkoffReceipt) => {
    const pdfData = await getReceiptPDF(receipt.id);
    if (!pdfData) return;

    // Convert base64 to blob
    const byteCharacters = atob(pdfData.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfData.filename || `receipt_${receipt.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [getReceiptPDF]);

  useEffect(() => {
    if (isConnected) {
      loadReceipts();
      loadStats();
    }
  }, [isConnected, loadReceipts, loadStats]);

  // Subscribe to real-time receipt events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewReceipt = (data: { receipt: TinkoffReceipt }) => {
      console.log('New receipt received:', data.receipt);
      setReceipts(prev => [data.receipt, ...prev]);
      setTotalCount(prev => prev + 1);
      // Reload stats to update counters
      loadStats();
    };

    const handleReceiptMatched = (data: { receiptId: string; payoutId: string }) => {
      console.log('Receipt matched:', data);
      setReceipts(prev => prev.map(receipt => 
        receipt.id === data.receiptId 
          ? { ...receipt, payoutId: data.payoutId, isProcessed: true }
          : receipt
      ));
      // Reload stats to update counters
      loadStats();
    };

    const handleReceiptDeleted = (data: { receiptId: string }) => {
      setReceipts(prev => prev.filter(receipt => receipt.id !== data.receiptId));
      setTotalCount(prev => prev - 1);
      loadStats();
    };

    // Subscribe to events
    socket.on('receipts:new', handleNewReceipt);
    socket.on('receipts:matched', handleReceiptMatched);
    socket.on('receipts:deleted', handleReceiptDeleted);

    // Subscribe to receipt updates room
    api.emit('receipts:subscribe', {});

    return () => {
      socket.off('receipts:new', handleNewReceipt);
      socket.off('receipts:matched', handleReceiptMatched);
      socket.off('receipts:deleted', handleReceiptDeleted);
      api.emit('receipts:unsubscribe', {});
    };
  }, [socket, isConnected, api, loadStats]);

  return {
    receipts,
    totalCount,
    totalPages,
    loading,
    error,
    stats,
    filters,
    updateFilters,
    loadReceipts,
    getReceipt,
    deleteReceipt,
    matchUnmatchedReceipts,
    downloadPDF
  };
}