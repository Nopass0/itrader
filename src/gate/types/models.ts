/**
 * Типы и интерфейсы для Gate.io API
 */

import { Decimal } from "decimal.js";

/**
 * Cookie для хранения сессии
 */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string;
  session: boolean;
  hostOnly: boolean;
  storeId?: string;
  expirationDate?: number;
}

/**
 * Базовый ответ от Gate.io API
 */
export interface GateResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

/**
 * Ответ при авторизации
 */
export interface LoginResponse {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

/**
 * Информация о кошельке
 */
export interface Wallet {
  currency: {
    code: string;
    name: string;
  };
  balance: string;
  available?: string;
  locked?: string;
}

/**
 * Информация о пользователе
 */
export interface User {
  id: string;
  email: string;
  wallets: Wallet[];
}

/**
 * Ответ при запросе информации о пользователе
 */
export interface AuthMeResponse {
  user: User;
}

/**
 * Баланс по валюте
 */
export interface BalanceResponse {
  currency: string;
  balance: Decimal;
  available: Decimal;
  locked: Decimal;
}

/**
 * Статусы транзакций
 * 4 - Ожидает подтверждения (pending)
 * 5 - В процессе (in progress)
 * 7 - Завершена с чеком (completed with receipt)
 * 9 - История (history)
 */
export enum TransactionStatus {
  PENDING = 4,
  IN_PROGRESS = 5,
  COMPLETED_WITH_RECEIPT = 7,
  HISTORY = 9,
}

/**
 * Метод оплаты
 */
export interface PaymentMethod {
  id: number;
  label: string;
  type: string;
}

/**
 * Суммы в разных валютах
 */
export interface AmountMap {
  trader: { [currencyCode: string]: number };
  partner?: { [currencyCode: string]: number };
}

/**
 * Выплата (транзакция)
 */
export interface Payout {
  id: number;
  status: number;
  amount: AmountMap;
  total: AmountMap;
  method: PaymentMethod;
  wallet: string;
  user?: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  attachments?: Array<{
    id: number;
    url: string;
    name: string;
  }>;
}

/**
 * Ответ со списком выплат
 */
export interface PayoutsResponse {
  payouts: {
    data: Payout[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
}

/**
 * Ответ с одной выплатой
 */
export interface PayoutResponse {
  payout: Payout;
}

/**
 * Транзакция Gate.io в упрощенном формате
 */
export interface GateTransaction {
  id: string;
  orderId: string;
  amount: Decimal;
  currency: string;
  fiatCurrency: string;
  fiatAmount: Decimal;
  rate: Decimal;
  status: number;
  buyerName: string;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Фильтр для поиска транзакций
 */
export interface TransactionFilter {
  status?: number | number[];
  currency?: string;
  page?: number;
  limit?: number;
}

/**
 * Ошибки API
 */
export class GateApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "GateApiError";
  }
}

/**
 * Ошибка Cloudflare блокировки
 */
export class CloudflareError extends GateApiError {
  constructor() {
    super("Cloudflare protection detected", "CLOUDFLARE_BLOCK", 403);
  }
}

/**
 * Ошибка истечения сессии
 */
export class SessionExpiredError extends GateApiError {
  constructor() {
    super("Session expired", "SESSION_EXPIRED", 401);
  }
}

/**
 * Ошибка превышения лимита запросов
 */
export class RateLimitError extends GateApiError {
  constructor(public retryAfter: number = 60) {
    super("Rate limit exceeded", "RATE_LIMIT", 429);
  }
}

/**
 * Конфигурация аккаунта Gate.io
 */
export interface GateAccount {
  email: string;
  password: string;
  cookies?: Cookie[];
  lastUsed?: Date;
  isActive?: boolean;
}

/**
 * Опции для GateClient
 */
export interface GateClientOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Опции для RateLimiter
 */
export interface RateLimiterOptions {
  maxRequests?: number; // Максимум запросов в окно
  windowMs?: number; // Размер окна в миллисекундах
}
