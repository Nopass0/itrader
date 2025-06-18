export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: Pagination;
}

export interface User {
  id: number;
  username: string;
  role?: 'admin' | 'operator' | 'trader';
  avatar?: string;
}

export interface Admin {
  id: number;
  username: string;
  token: string;
}

export interface GateCredentials {
  id: number;
  userId: number;
  email: string;
}

export interface BybitCredentials {
  id: number;
  userId: number;
  apiKey: string;
}

export interface GateSession {
  id: number;
  userId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BybitSession {
  id: number;
  userId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  status: number;
  amount: {
    trader: {
      [key: string]: number;
    };
  };
  created_at: string;
  updated_at: string;
  additional_fields: {
    wallet?: string;
    method?: {
      id: number;
      label: string;
    };
    total?: {
      trader: {
        [key: string]: number;
      };
    };
    meta?: {
      bank?: string;
      card_number?: string;
    };
    symbol?: string;
    side?: string;
    order_type?: string;
    price?: string;
    user_id?: number;
    user_name?: string;
  };
}

export interface SmsMessage {
  id: number;
  from: string;
  text: string;
  status: number;
  received_at: string;
  created_at: string;
  device_id: number;
  device_name: string;
  additional_fields: {
    parsed?: {
      amount?: number;
      currency?: string;
      balance?: number;
    };
    user_id?: number;
    user_name?: string;
  };
}

export interface PushNotification {
  id: number;
  package_name: string;
  title: string;
  text: string;
  status: number;
  received_at: string;
  created_at: string;
  device_id: number;
  device_name: string;
  has_parsed_data: boolean;
  additional_fields: {
    parsed?: {
      amount?: number;
      currency?: string;
    };
    user_id?: number;
    user_name?: string;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface RegisterData {
  username: string;
  password: string;
  adminToken: string;
}