import { create } from 'zustand';
import { Transaction, SmsMessage, PushNotification, PaginatedResponse } from '@/types';
import apiClient from '@/lib/api';

interface GateState {
  transactions: {
    items: Transaction[];
    isLoading: boolean;
    error: string | null;
  };
  smsMessages: {
    items: SmsMessage[];
    isLoading: boolean;
    error: string | null;
  };
  pushNotifications: {
    items: PushNotification[];
    isLoading: boolean;
    error: string | null;
  };
  pagination: {
    transactionsPage: number;
    smsPage: number;
    pushPage: number;
    limit: number;
  };
  fetchTransactions: (page?: number, limit?: number, status?: string, wallet?: string) => Promise<void>;
  fetchSmsMessages: (page?: number, limit?: number, status?: number) => Promise<void>;
  fetchPushNotifications: (page?: number, limit?: number, status?: number) => Promise<void>;
}

export const useGateStore = create<GateState>((set, get) => ({
  transactions: {
    items: [],
    isLoading: false,
    error: null,
  },
  smsMessages: {
    items: [],
    isLoading: false,
    error: null,
  },
  pushNotifications: {
    items: [],
    isLoading: false,
    error: null,
  },
  pagination: {
    transactionsPage: 1,
    smsPage: 1,
    pushPage: 1,
    limit: 10,
  },

  fetchTransactions: async (page = 1, limit = 10, status = '', wallet = '') => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        isLoading: true,
        error: null,
      },
      pagination: {
        ...state.pagination,
        transactionsPage: page,
      },
    }));

    try {
      let url = `/gate/transactions?page=${page}&limit=${limit}`;
      if (status) url += `&status=${status}`;
      if (wallet) url += `&wallet=${wallet}`;

      const response = await apiClient.get<PaginatedResponse<Transaction>>(url);

      if (response.success && response.data) {
        set((state) => ({
          transactions: {
            items: response.data?.items || [],
            isLoading: false,
            error: null,
          },
        }));
      } else {
        set((state) => ({
          transactions: {
            ...state.transactions,
            isLoading: false,
            error: response.error || 'Ошибка при загрузке транзакций',
          },
        }));
      }
    } catch (error: any) {
      set((state) => ({
        transactions: {
          ...state.transactions,
          isLoading: false,
          error: error.message || 'Ошибка при загрузке транзакций',
        },
      }));
    }
  },

  fetchSmsMessages: async (page = 1, limit = 10, status?: number) => {
    set((state) => ({
      smsMessages: {
        ...state.smsMessages,
        isLoading: true,
        error: null,
      },
      pagination: {
        ...state.pagination,
        smsPage: page,
      },
    }));

    try {
      let url = `/gate/sms?page=${page}&limit=${limit}`;
      if (status !== undefined) url += `&status=${status}`;

      const response = await apiClient.get<PaginatedResponse<SmsMessage>>(url);

      if (response.success && response.data) {
        set((state) => ({
          smsMessages: {
            items: response.data?.items || [],
            isLoading: false,
            error: null,
          },
        }));
      } else {
        set((state) => ({
          smsMessages: {
            ...state.smsMessages,
            isLoading: false,
            error: response.error || 'Ошибка при загрузке SMS-сообщений',
          },
        }));
      }
    } catch (error: any) {
      set((state) => ({
        smsMessages: {
          ...state.smsMessages,
          isLoading: false,
          error: error.message || 'Ошибка при загрузке SMS-сообщений',
        },
      }));
    }
  },

  fetchPushNotifications: async (page = 1, limit = 10, status?: number) => {
    set((state) => ({
      pushNotifications: {
        ...state.pushNotifications,
        isLoading: true,
        error: null,
      },
      pagination: {
        ...state.pagination,
        pushPage: page,
      },
    }));

    try {
      let url = `/gate/push?page=${page}&limit=${limit}`;
      if (status !== undefined) url += `&status=${status}`;

      const response = await apiClient.get<PaginatedResponse<PushNotification>>(url);

      if (response.success && response.data) {
        set((state) => ({
          pushNotifications: {
            items: response.data?.items || [],
            isLoading: false,
            error: null,
          },
        }));
      } else {
        set((state) => ({
          pushNotifications: {
            ...state.pushNotifications,
            isLoading: false,
            error: response.error || 'Ошибка при загрузке Push-уведомлений',
          },
        }));
      }
    } catch (error: any) {
      set((state) => ({
        pushNotifications: {
          ...state.pushNotifications,
          isLoading: false,
          error: error.message || 'Ошибка при загрузке Push-уведомлений',
        },
      }));
    }
  },
}));