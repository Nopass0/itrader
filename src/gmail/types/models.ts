/**
 * Типы и интерфейсы для работы с Gmail API
 */

import { Decimal } from "decimal.js";

/**
 * Учетные данные OAuth2
 */
export interface OAuth2Credentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  project_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

/**
 * Файл учетных данных Google API
 */
export interface CredentialsFile {
  installed?: OAuth2Credentials;
  web?: OAuth2Credentials;
}

/**
 * Токен OAuth2
 */
export interface OAuth2Token {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

/**
 * Аккаунт Gmail
 */
export interface GmailAccount {
  email: string;
  tokens?: OAuth2Token;
  lastUsed?: Date;
  isActive: boolean;
}

/**
 * Фильтры для получения писем
 */
export interface EmailFilter {
  // Основные фильтры
  from?: string; // Отправитель
  to?: string; // Получатель
  subject?: string; // Тема
  query?: string; // Произвольный поисковый запрос
  
  // Фильтры по дате
  after?: Date | string; // После указанной даты
  before?: Date | string; // До указанной даты
  
  // Дополнительные фильтры
  hasAttachment?: boolean; // Есть вложения
  attachmentType?: string; // Тип вложения (например, "pdf")
  isUnread?: boolean; // Непрочитанные
  isImportant?: boolean; // Важные
  isStarred?: boolean; // Помеченные звездой
  
  // Параметры пагинации
  maxResults?: number; // Максимальное количество результатов
  pageToken?: string; // Токен для следующей страницы
}

/**
 * Вложение в письме
 */
export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // Base64 encoded data
}

/**
 * Письмо Gmail
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  
  // Заголовки
  from?: string;
  to?: string;
  subject?: string;
  date?: Date;
  messageId?: string;
  
  // Содержимое
  textPlain?: string;
  textHtml?: string;
  
  // Вложения
  attachments?: EmailAttachment[];
  
  // Дополнительная информация
  isUnread?: boolean;
  isImportant?: boolean;
  isStarred?: boolean;
  
  // Сырые данные
  raw?: any;
}

/**
 * Результат поиска писем
 */
export interface EmailSearchResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Информация о чеке из письма
 */
export interface EmailReceiptInfo {
  email: GmailMessage;
  pdfAttachment?: EmailAttachment;
  amount?: Decimal;
  date?: Date;
  sender?: string;
  transactionId?: string;
}

/**
 * Опции для GmailClient
 */
export interface GmailClientOptions {
  scopes?: string[];
}

/**
 * Опции для GmailManager
 */
export interface GmailManagerOptions {
  tokensDir?: string; // Директория для хранения токенов
  credentials?: CredentialsFile | string; // Учетные данные или путь к файлу
  autoSaveTokens?: boolean; // Автоматически сохранять токены
  clientOptions?: GmailClientOptions;
}

/**
 * Базовый класс ошибок Gmail
 */
export class GmailError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "GmailError";
  }
}

/**
 * Ошибка авторизации
 */
export class GmailAuthError extends GmailError {
  constructor(message: string = "Ошибка авторизации Gmail") {
    super(message, "AUTH_ERROR", 401);
    this.name = "GmailAuthError";
  }
}

/**
 * Ошибка при работе с API
 */
export class GmailApiError extends GmailError {
  constructor(message: string, code?: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = "GmailApiError";
  }
}

/**
 * Ошибка квоты API
 */
export class GmailQuotaError extends GmailError {
  constructor(
    message: string = "Превышена квота Gmail API",
    public retryAfter?: number,
  ) {
    super(message, "QUOTA_EXCEEDED", 429);
    this.name = "GmailQuotaError";
  }
}

/**
 * Ошибка при парсинге письма
 */
export class EmailParseError extends GmailError {
  constructor(message: string) {
    super(message, "PARSE_ERROR");
    this.name = "EmailParseError";
  }
}