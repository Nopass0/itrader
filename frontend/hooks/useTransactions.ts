import { useState, useEffect, useCallback } from 'react';
import { useSocketApi } from './useSocketApi';

// Interfaces
export interface Transaction {
  id: string;
  orderId?: string;
  advertisementId?: string;
  payoutId?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  chatStartedAt?: Date;
  checkReceivedAt?: Date;
  customStatuses?: any[];
  advertisement?: {
    id: string;
    bybitAdId?: string;
    type: 'buy' | 'sell';
    currency: string;
    fiat: string;
    price: number;
    minOrderAmount: number;
    maxOrderAmount: number;
    availableAmount: number;
    isActive: boolean;
    bybitAccountId?: string;
    bybitAccount?: {
      id: string;
      accountId: string;
      accountName?: string;
      name?: string;
      status?: string;
      isActive?: boolean;
    };
  };
  payout?: {
    id: string;
    gatePayoutId?: number;
    wallet?: string;
    amount?: number;
    status: number;
    gateAccount?: string;
    gateAccountId?: string;
    method?: any;
  };
}

export interface Order {
  id: string;
  orderId: string;
  type: 'buy' | 'sell';
  currency: string;
  fiat: string;
  amount: number;
  price: number;
  status: string;
  counterpartyId: string;
  counterpartyName: string;
  createdAt: Date;
  updatedAt: Date;
  bybitAccountId?: string;
  bybitAccount?: {
    id: string;
    name: string;
    status: string;
  };
}

export interface Advertisement {
  id: string;
  bybitAdId?: string;
  type: 'buy' | 'sell';
  currency: string;
  fiat: string;
  price: number;
  minOrderAmount: number;
  maxOrderAmount: number;
  availableAmount: number;
  isActive: boolean;
  totalAmount?: number;
  frozenAmount?: number;
  completedOrders?: number;
  completionRate?: number;
  paymentMethods?: string[];
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  bybitAccountId?: string;
  bybitAccount?: {
    id: string;
    name: string;
    status: string;
  };
}

export interface Payout {
  id: string;
  gatePayoutId?: number;
  paymentMethodId?: number;
  wallet?: string;
  amountTrader?: any;
  totalTrader?: any;
  status: number;
  approvedAt?: Date;
  expiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  meta?: any;
  method?: any;
  attachments?: any;
  tooltip?: any;
  bank?: any;
  trader?: any;
  gateAccount?: string;
  gateAccountId?: string;
  amount?: number;
  transaction?: Transaction;
}

export interface Filters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  statuses?: string[];  // Support for multiple statuses
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilters extends Filters {
  bybitAccountId?: string;
  gateAccountId?: string;
  amountMin?: number;
  amountMax?: number;
  type?: 'buy' | 'sell';
  amountFrom?: number;
  amountTo?: number;
  orderId?: string;
  bybitAccount?: string;
  gateAccount?: string;
}

export interface OrderFilters extends Filters {
  type?: 'buy' | 'sell';
  currency?: string;
  fiat?: string;
  bybitAccountId?: string;
}

export interface AdvertisementFilters extends Filters {
  type?: 'buy' | 'sell';
  currency?: string;
  fiat?: string;
  isActive?: boolean;
  bybitAccountId?: string;
}

export interface PayoutFilters extends Filters {
  status?: number;
  gateAccountId?: string;
  wallet?: string;
  amountMin?: number;
  amountMax?: number;
  method?: number;
  hasReceipt?: boolean;
  amountFrom?: number;
  amountTo?: number;
  gateAccount?: string;
  gatePayoutId?: string;
}

export function useTransactions() {
  // Virtual Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsTotalCount, setTransactionsTotalCount] = useState(0);
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(0);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionsFilters, setTransactionsFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersFilters, setOrdersFilters] = useState<OrderFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Advertisements
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [advertisementsTotalCount, setAdvertisementsTotalCount] = useState(0);
  const [advertisementsTotalPages, setAdvertisementsTotalPages] = useState(0);
  const [advertisementsLoading, setAdvertisementsLoading] = useState(false);
  const [advertisementsError, setAdvertisementsError] = useState<string | null>(null);
  const [advertisementsFilters, setAdvertisementsFilters] = useState<AdvertisementFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Payouts
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsTotalCount, setPayoutsTotalCount] = useState(0);
  const [payoutsTotalPages, setPayoutsTotalPages] = useState(0);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutsFilters, setPayoutsFilters] = useState<PayoutFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const { api, isConnected } = useSocketApi();

  // Load Virtual Transactions
  const loadTransactions = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping transactions load');
      return;
    }

    setTransactionsLoading(true);
    setTransactionsError(null);

    try {
      console.log('Loading transactions with filters:', transactionsFilters);
      const response = await api.emit('transactions:list', transactionsFilters);
      console.log('Transactions response:', response);
      
      if (response.success) {
        setTransactions(response.data.data || []);
        setTransactionsTotalCount(response.data.total || 0);
        setTransactionsTotalPages(response.data.totalPages || 0);
      } else {
        setTransactionsError(response.error?.message || 'Failed to load transactions');
      }
    } catch (err) {
      setTransactionsError('Failed to load transactions');
      console.error('Error loading transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [api, isConnected, transactionsFilters]);

  // Load Orders
  const loadOrders = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping orders load');
      return;
    }

    setOrdersLoading(true);
    setOrdersError(null);

    try {
      console.log('Loading orders with filters:', ordersFilters);
      // Try to load from transactions with orderId
      const response = await api.emit('transactions:list', {
        ...ordersFilters,
        hasOrderId: true
      });
      console.log('Orders response:', response);
      
      if (response.success && response.data) {
        // Transform transactions to orders format
        const ordersData = response.data.data || [];
        setOrders(ordersData);
        setOrdersTotalCount(response.data.total || 0);
        setOrdersTotalPages(response.data.totalPages || 0);
      } else {
        // If no specific orders endpoint, use empty data
        setOrders([]);
        setOrdersTotalCount(0);
        setOrdersTotalPages(0);
      }
    } catch (err) {
      setOrdersError('Failed to load orders');
      console.error('Error loading orders:', err);
      setOrders([]);
      setOrdersTotalCount(0);
      setOrdersTotalPages(0);
    } finally {
      setOrdersLoading(false);
    }
  }, [api, isConnected, ordersFilters]);

  // Load Advertisements
  const loadAdvertisements = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping advertisements load');
      return;
    }

    setAdvertisementsLoading(true);
    setAdvertisementsError(null);

    try {
      console.log('Loading advertisements with filters:', advertisementsFilters);
      const response = await api.emit('advertisements:list', advertisementsFilters);
      console.log('Advertisements response:', response);
      
      if (response.success) {
        setAdvertisements(response.data.data || []);
        setAdvertisementsTotalCount(response.data.total || 0);
        setAdvertisementsTotalPages(response.data.totalPages || 0);
      } else {
        setAdvertisementsError(response.error?.message || 'Failed to load advertisements');
      }
    } catch (err) {
      setAdvertisementsError('Failed to load advertisements');
      console.error('Error loading advertisements:', err);
    } finally {
      setAdvertisementsLoading(false);
    }
  }, [api, isConnected, advertisementsFilters]);

  // Load Payouts
  const loadPayouts = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping payouts load');
      return;
    }

    setPayoutsLoading(true);
    setPayoutsError(null);

    try {
      // Send proper filters for the payout controller
      const filters = {
        ...payoutsFilters,
        minAmount: payoutsFilters.amountMin,
        maxAmount: payoutsFilters.amountMax,
        // Remove the frontend-specific fields
        amountMin: undefined,
        amountMax: undefined
      };
      
      console.log('Loading payouts with filters:', filters);
      const response = await api.emit('payouts:list', filters);
      console.log('Payouts response:', response);
      
      if (response.success) {
        setPayouts(response.data.data || []);
        setPayoutsTotalCount(response.data.total || 0);
        setPayoutsTotalPages(response.data.totalPages || 0);
      } else {
        setPayoutsError(response.error?.message || 'Failed to load payouts');
      }
    } catch (err) {
      setPayoutsError('Failed to load payouts');
      console.error('Error loading payouts:', err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [api, isConnected, payoutsFilters]);

  // Update filters functions
  const updateTransactionsFilters = useCallback((newFilters: Partial<TransactionFilters>) => {
    setTransactionsFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  const updateOrdersFilters = useCallback((newFilters: Partial<OrderFilters>) => {
    setOrdersFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  const updateAdvertisementsFilters = useCallback((newFilters: Partial<AdvertisementFilters>) => {
    setAdvertisementsFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  const updatePayoutsFilters = useCallback((newFilters: Partial<PayoutFilters>) => {
    setPayoutsFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  // Load data when connected or filters change
  useEffect(() => {
    if (isConnected) {
      loadTransactions();
    }
  }, [isConnected, loadTransactions]);

  useEffect(() => {
    if (isConnected) {
      loadOrders();
    }
  }, [isConnected, loadOrders]);

  useEffect(() => {
    if (isConnected) {
      loadAdvertisements();
    }
  }, [isConnected, loadAdvertisements]);

  useEffect(() => {
    if (isConnected) {
      loadPayouts();
    }
  }, [isConnected, loadPayouts]);

  // Real-time updates for transactions
  useEffect(() => {
    if (!isConnected) return;

    const socket = (window as any).socket;
    if (!socket) return;

    // Handle transaction updates
    const handleTransactionUpdated = (data: { id: string; transaction: Transaction }) => {
      console.log('Transaction updated:', data);
      
      // Update the transaction in the list
      setTransactions(prev => prev.map(t => 
        t.id === data.id ? data.transaction : t
      ));
    };

    // Handle new transactions
    const handleTransactionCreated = (data: { transaction: Transaction }) => {
      console.log('New transaction created:', data);
      
      // Add to the beginning of the list if it matches current filters
      setTransactions(prev => [data.transaction, ...prev]);
      setTransactionsTotalCount(prev => prev + 1);
    };

    // Handle transaction deletions
    const handleTransactionDeleted = (data: { id: string }) => {
      console.log('Transaction deleted:', data);
      
      // Remove from the list
      setTransactions(prev => prev.filter(t => t.id !== data.id));
      setTransactionsTotalCount(prev => Math.max(0, prev - 1));
    };

    // Subscribe to events
    socket.on('transaction:updated', handleTransactionUpdated);
    socket.on('transaction:created', handleTransactionCreated);
    socket.on('transaction:deleted', handleTransactionDeleted);

    return () => {
      socket.off('transaction:updated', handleTransactionUpdated);
      socket.off('transaction:created', handleTransactionCreated);
      socket.off('transaction:deleted', handleTransactionDeleted);
    };
  }, [isConnected]);

  // Real-time updates for advertisements
  useEffect(() => {
    if (!isConnected) return;

    const socket = (window as any).socket;
    if (!socket) return;

    // Handle advertisement updates
    const handleAdvertisementUpdated = (data: { id: string; advertisement: Advertisement }) => {
      console.log('Advertisement updated:', data);
      
      // Update the advertisement in the list
      setAdvertisements(prev => prev.map(a => 
        a.id === data.id ? data.advertisement : a
      ));
    };

    // Handle new advertisements
    const handleAdvertisementCreated = (data: { advertisement: Advertisement }) => {
      console.log('New advertisement created:', data);
      
      // Add to the beginning of the list
      setAdvertisements(prev => [data.advertisement, ...prev]);
      setAdvertisementsTotalCount(prev => prev + 1);
    };

    // Handle advertisement deletions
    const handleAdvertisementDeleted = (data: { id: string }) => {
      console.log('Advertisement deleted:', data);
      
      // Remove from the list
      setAdvertisements(prev => prev.filter(a => a.id !== data.id));
      setAdvertisementsTotalCount(prev => Math.max(0, prev - 1));
    };

    // Subscribe to events
    socket.on('advertisement:updated', handleAdvertisementUpdated);
    socket.on('advertisement:created', handleAdvertisementCreated);
    socket.on('advertisement:deleted', handleAdvertisementDeleted);

    return () => {
      socket.off('advertisement:updated', handleAdvertisementUpdated);
      socket.off('advertisement:created', handleAdvertisementCreated);
      socket.off('advertisement:deleted', handleAdvertisementDeleted);
    };
  }, [isConnected]);

  // Real-time updates for payouts
  useEffect(() => {
    if (!isConnected) return;

    const socket = (window as any).socket;
    if (!socket) return;

    // Handle payout updates
    const handlePayoutUpdated = (data: { id: string; payout: Payout }) => {
      console.log('Payout updated:', data);
      
      // Update the payout in the list
      setPayouts(prev => prev.map(p => 
        p.id === data.id ? data.payout : p
      ));
    };

    // Handle new payouts
    const handlePayoutCreated = (data: { payout: Payout }) => {
      console.log('New payout created:', data);
      
      // Add to the beginning of the list
      setPayouts(prev => [data.payout, ...prev]);
      setPayoutsTotalCount(prev => prev + 1);
    };

    // Subscribe to events
    socket.on('payout:updated', handlePayoutUpdated);
    socket.on('payout:created', handlePayoutCreated);

    return () => {
      socket.off('payout:updated', handlePayoutUpdated);
      socket.off('payout:created', handlePayoutCreated);
    };
  }, [isConnected]);

  return {
    // Virtual Transactions
    transactions,
    transactionsLoading,
    transactionsError,
    transactionsFilters,
    updateTransactionsFilters,
    loadTransactions,
    transactionsTotalCount,
    transactionsTotalPages,
    
    // Orders
    orders,
    ordersLoading,
    ordersError,
    ordersFilters,
    updateOrdersFilters,
    loadOrders,
    ordersTotalCount,
    ordersTotalPages,
    
    // Advertisements
    advertisements,
    advertisementsLoading,
    advertisementsError,
    advertisementsFilters,
    updateAdvertisementsFilters,
    loadAdvertisements,
    advertisementsTotalCount,
    advertisementsTotalPages,
    
    // Payouts
    payouts,
    payoutsLoading,
    payoutsError,
    payoutsFilters,
    updatePayoutsFilters,
    loadPayouts,
    payoutsTotalCount,
    payoutsTotalPages,
  };
}