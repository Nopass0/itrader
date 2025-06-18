/**
 * Типы для WebServer модуля
 */

// ========== Базовые типы ==========

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
  };
}

export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ========== Аутентификация ==========

export interface SystemAccount {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface AuthToken {
  id: string;
  accountId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

// ========== Управление курсами ==========

export interface ExchangeRateConfig {
  mode: 'constant' | 'automatic';
  constantRate?: number;
  markup?: number;
  updateInterval?: number;
}

export interface ExchangeRateHistory {
  id: string;
  rate: number;
  source: string;
  timestamp: Date;
}

// ========== Шаблоны чата ==========

export interface ChatTemplate {
  id: string;
  name: string;
  description?: string;
  steps: ChatStep[];
  responseGroups: ResponseGroup[];
  unknownResponseAction?: UnknownResponseAction;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatStep {
  id: number;
  name: string;
  message: string;
  order: number;
  waitForResponse: boolean;
  timeout?: number;
  nextStepId?: number;
  conditions?: StepCondition[];
}

export interface StepCondition {
  type: 'status' | 'hasReceipt' | 'custom';
  operator: 'equals' | 'notEquals' | 'contains';
  value: any;
  nextStepId: number;
}

export interface ResponseGroup {
  id: string;
  name: string;
  keywords: string[];
  action: ResponseAction;
  priority: number;
}

export interface ResponseAction {
  type: 'nextStep' | 'setStatus' | 'sendMessage' | 'complete';
  stepId?: number;
  status?: string;
  message?: string;
  repeatQuestion?: boolean;
}

export interface UnknownResponseAction {
  showMessage?: boolean;
  message?: string;
  repeatQuestion?: boolean;
  setStatus?: string;
  goToStep?: number;
}

// ========== Кастомные статусы ==========

export interface CustomStatus {
  id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  isFinal: boolean;
  createdAt: Date;
}

// ========== События Socket.IO ==========

export interface SocketEvent<T = any> {
  event: string;
  data: T;
  timestamp: Date;
  userId?: string;
}

// События клиент -> сервер
export interface ClientEvents {
  // Auth
  'auth:login': (data: LoginRequest, callback: (response: ApiResponse<LoginResponse>) => void) => void;
  'auth:logout': (callback: (response: ApiResponse) => void) => void;
  'auth:authenticate': (data: { token: string }, callback: (response: ApiResponse) => void) => void;

  // Accounts
  'account:create': (data: { username: string; role?: string }, callback: (response: ApiResponse<SystemAccount>) => void) => void;
  'account:update': (data: { id: string; updates: Partial<SystemAccount> }, callback: (response: ApiResponse) => void) => void;
  'account:delete': (data: { id: string }, callback: (response: ApiResponse) => void) => void;
  'account:list': (data: PaginationParams, callback: (response: ApiResponse<PaginatedResponse<SystemAccount>>) => void) => void;

  // Transactions
  'transaction:list': (data: PaginationParams & { status?: string }, callback: (response: ApiResponse<PaginatedResponse<any>>) => void) => void;
  'transaction:get': (data: { id: string }, callback: (response: ApiResponse<any>) => void) => void;
  'transaction:updateStatus': (data: { id: string; status: string }, callback: (response: ApiResponse) => void) => void;

  // Payouts
  'payout:list': (data: PaginationParams & { status?: number }, callback: (response: ApiResponse<PaginatedResponse<any>>) => void) => void;
  'payout:get': (data: { id: string }, callback: (response: ApiResponse<any>) => void) => void;

  // Advertisements
  'advertisement:list': (data: PaginationParams & { accountId?: string }, callback: (response: ApiResponse<PaginatedResponse<any>>) => void) => void;
  'advertisement:create': (data: any, callback: (response: ApiResponse<any>) => void) => void;
  'advertisement:update': (data: { id: string; updates: any }, callback: (response: ApiResponse) => void) => void;
  'advertisement:delete': (data: { id: string }, callback: (response: ApiResponse) => void) => void;

  // Exchange rates
  'rate:get': (callback: (response: ApiResponse<ExchangeRateConfig & { currentRate: number }>) => void) => void;
  'rate:setConstant': (data: { rate: number }, callback: (response: ApiResponse) => void) => void;
  'rate:toggleMode': (callback: (response: ApiResponse) => void) => void;
  'rate:history': (data: PaginationParams, callback: (response: ApiResponse<PaginatedResponse<ExchangeRateHistory>>) => void) => void;

  // Orchestrator
  'orchestrator:pause': (callback: (response: ApiResponse) => void) => void;
  'orchestrator:resume': (callback: (response: ApiResponse) => void) => void;
  'orchestrator:status': (callback: (response: ApiResponse<any>) => void) => void;

  // Chat
  'chat:get': (data: { orderId: string }, callback: (response: ApiResponse<any[]>) => void) => void;
  'chat:sendMessage': (data: { orderId: string; message: string }, callback: (response: ApiResponse) => void) => void;

  // Templates
  'template:getRemark': (callback: (response: ApiResponse<{ remark: string }>) => void) => void;
  'template:setRemark': (data: { remark: string }, callback: (response: ApiResponse) => void) => void;
  'template:chat:list': (callback: (response: ApiResponse<ChatTemplate[]>) => void) => void;
  'template:chat:create': (data: Partial<ChatTemplate>, callback: (response: ApiResponse<ChatTemplate>) => void) => void;
  'template:chat:update': (data: { id: string; updates: Partial<ChatTemplate> }, callback: (response: ApiResponse) => void) => void;
  'template:chat:delete': (data: { id: string }, callback: (response: ApiResponse) => void) => void;

  // Platform accounts
  'bybit:listAccounts': (callback: (response: ApiResponse<any[]>) => void) => void;
  'bybit:addAccount': (data: any, callback: (response: ApiResponse) => void) => void;
  'bybit:removeAccount': (data: { accountId: string }, callback: (response: ApiResponse) => void) => void;
  'bybit:getBalance': (data: { accountId: string }, callback: (response: ApiResponse<any>) => void) => void;

  'gate:listAccounts': (callback: (response: ApiResponse<any[]>) => void) => void;
  'gate:addAccount': (data: any, callback: (response: ApiResponse) => void) => void;
  'gate:removeAccount': (data: { accountId: string }, callback: (response: ApiResponse) => void) => void;
  'gate:setBalance': (data: { accountId: string; balance: number }, callback: (response: ApiResponse) => void) => void;

  'gmail:listAccounts': (callback: (response: ApiResponse<any[]>) => void) => void;
  'gmail:authorize': (callback: (response: ApiResponse<{ authUrl: string }>) => void) => void;
  'gmail:getReceipts': (data: PaginationParams, callback: (response: ApiResponse<PaginatedResponse<any>>) => void) => void;
}

// События сервер -> клиент
export interface ServerEvents {
  // Обновления в реальном времени
  'transaction:updated': (data: { id: string; transaction: any }) => void;
  'payout:updated': (data: { id: string; payout: any }) => void;
  'order:new': (data: { order: any }) => void;
  'order:updated': (data: { id: string; order: any }) => void;
  'chat:message': (data: { orderId: string; message: any }) => void;
  'rate:changed': (data: { oldRate: number; newRate: number; mode: string }) => void;
  'orchestrator:statusChanged': (data: { status: string; tasks: any[] }) => void;
  'advertisement:created': (data: { advertisement: any }) => void;
  'advertisement:updated': (data: { id: string; advertisement: any }) => void;
  'advertisement:deleted': (data: { id: string }) => void;
}

// ========== Middleware ==========

export interface AuthenticatedSocket extends SocketIO.Socket {
  userId?: string;
  accountId?: string;
  role?: string;
}

// ========== CLI Types ==========

export interface CLICommand {
  name: string;
  description: string;
  action: (...args: any[]) => Promise<void>;
}