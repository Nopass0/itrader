/**
 * Менеджер аккаунтов Gate.io
 * Управляет несколькими аккаунтами с автоматическим сохранением cookies
 */

import path from "path";
import fs from "fs/promises";
import { GateClient } from "./client";
import { RateLimiter } from "./utils/rateLimiter";
import {
  type GateAccount,
  type Cookie,
  type LoginResponse,
  type BalanceResponse,
  type Payout,
  type GateTransaction,
  type TransactionFilter,
  GateApiError,
  SessionExpiredError,
  type GateClientOptions,
  type RateLimiterOptions,
} from "./types/models";
import { saveCookiesToFile, loadCookiesFromFile } from "./utils/cookieUtils";

/**
 * Опции для GateAccountManager
 */
export interface GateAccountManagerOptions {
  cookiesDir?: string; // Директория для хранения cookies
  rateLimiterOptions?: RateLimiterOptions;
  clientOptions?: GateClientOptions;
  autoSaveCookies?: boolean; // Автоматически сохранять cookies после каждого запроса
}

/**
 * Менеджер для работы с несколькими аккаунтами Gate.io
 * Автоматически управляет cookies и rate limiting
 */
export class GateAccountManager {
  private accounts: Map<string, GateAccount> = new Map();
  private clients: Map<string, GateClient> = new Map();
  private rateLimiter: RateLimiter;
  private cookiesDir: string;
  private autoSaveCookies: boolean;
  private clientOptions: GateClientOptions;

  /**
   * Создает новый экземпляр GateAccountManager
   * @param options - Опции для настройки менеджера
   */
  constructor(options: GateAccountManagerOptions = {}) {
    this.cookiesDir = options.cookiesDir || "./data/gate-cookies";
    this.autoSaveCookies = options.autoSaveCookies !== false;
    this.clientOptions = options.clientOptions || {};

    // Создаем общий RateLimiter для всех аккаунтов
    this.rateLimiter = new RateLimiter(
      options.rateLimiterOptions || {
        maxRequests: 240,
        windowMs: 60000,
      },
    );
  }

  /**
   * Инициализирует менеджер, создает необходимые директории
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.cookiesDir, { recursive: true });
    console.log(
      `[GateAccountManager] Инициализирован. Cookies сохраняются в: ${this.cookiesDir}`,
    );
  }

  /**
   * Добавляет новый аккаунт
   * @param email - Email аккаунта
   * @param password - Пароль аккаунта
   * @param autoLogin - Автоматически выполнить вход
   * @returns Информация о сессии если autoLogin=true
   */
  async addAccount(
    email: string,
    password: string,
    autoLogin: boolean = true,
    accountId?: string,
  ): Promise<LoginResponse | undefined> {
    // Проверяем, не добавлен ли уже аккаунт
    if (this.accounts.has(email)) {
      console.warn(`[GateAccountManager] Аккаунт ${email} уже добавлен`);
      return;
    }

    // Создаем аккаунт
    const account: GateAccount = {
      email,
      password,
      isActive: true,
      lastUsed: new Date(),
    };

    // Создаем клиент
    const client = new GateClient(this.rateLimiter, this.clientOptions);

    // Пытаемся загрузить существующие cookies
    // Сначала пробуем по accountId если он есть
    let cookiesLoaded = false;
    if (accountId) {
      const accountIdPath = path.join(this.cookiesDir, `${accountId}.json`);
      try {
        const cookies = await loadCookiesFromFile(accountIdPath);
        if (cookies.length > 0) {
          client.setCookies(cookies);
          account.cookies = cookies;
          console.log(
            `[GateAccountManager] Загружено ${cookies.length} cookies для accountId ${accountId}`,
          );
          cookiesLoaded = true;
        }
      } catch (error: unknown) {
        // Игнорируем ошибки загрузки cookies по accountId
      }
    }
    
    // Если не загрузили по accountId, пробуем по email
    if (!cookiesLoaded) {
      const cookiesPath = this.getCookiesPath(email);
      try {
        const cookies = await loadCookiesFromFile(cookiesPath);
        if (cookies.length > 0) {
          client.setCookies(cookies);
          account.cookies = cookies;
          console.log(
            `[GateAccountManager] Загружено ${cookies.length} cookies для ${email}`,
          );
          cookiesLoaded = true;
        }
      } catch (error: unknown) {
        // Игнорируем ошибки загрузки cookies
      }
    }

    if (cookiesLoaded) {
      // Проверяем, работают ли cookies
      if (await client.isAuthenticated()) {
        console.log(
          `[GateAccountManager] Аккаунт ${email} уже авторизован через cookies`,
        );
        this.accounts.set(email, account);
        this.clients.set(email, client);
        return {
          userId: "from_cookies",
          sessionId: "from_cookies",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
      }
    }

    this.accounts.set(email, account);
    this.clients.set(email, client);

    // Выполняем вход если требуется
    if (autoLogin) {
      return await this.login(email);
    }
  }

  /**
   * Выполняет вход в аккаунт
   * @param email - Email аккаунта
   * @returns Информация о сессии
   * @throws {Error} Если аккаунт не найден
   * @throws {GateApiError} При ошибке авторизации
   */
  async login(email: string): Promise<LoginResponse> {
    const account = this.accounts.get(email);
    const client = this.clients.get(email);

    if (!account || !client) {
      throw new Error(`Аккаунт ${email} не найден`);
    }

    try {
      const loginResponse = await client.login(email, account.password);

      // Сохраняем cookies
      account.cookies = client.getCookies();
      account.lastUsed = new Date();

      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }

      console.log(`[GateAccountManager] Успешная авторизация для ${email}`);
      return loginResponse;
    } catch (error: unknown) {
      account.isActive = false;
      console.error(
        `[GateAccountManager] Ошибка авторизации для ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Получает клиент для аккаунта
   * @param email - Email аккаунта
   * @returns GateClient
   * @throws {Error} Если аккаунт не найден
   */
  getClient(email: string): GateClient {
    const client = this.clients.get(email);
    if (!client) {
      throw new Error(`Аккаунт ${email} не найден`);
    }

    // Обновляем время последнего использования
    const account = this.accounts.get(email);
    if (account) {
      account.lastUsed = new Date();
    }

    return client;
  }

  /**
   * Получает баланс аккаунта
   * @param email - Email аккаунта
   * @param currency - Валюта (по умолчанию RUB)
   * @returns Информация о балансе
   */
  async getBalance(
    email: string,
    currency: string = "RUB",
  ): Promise<BalanceResponse> {
    const client = this.getClient(email);

    try {
      const balance = await client.getBalance(currency);

      // Сохраняем cookies после успешного запроса
      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }

      return balance;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await client.getBalance(currency);
      }
      throw error;
    }
  }

  /**
   * Получает доступные транзакции для аккаунта
   * @param email - Email аккаунта
   * @returns Массив транзакций
   */
  async getAvailableTransactions(email: string): Promise<Payout[]> {
    const client = this.getClient(email);

    try {
      const transactions = await client.getAvailableTransactions();

      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }

      return transactions;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await client.getAvailableTransactions();
      }
      throw error;
    }
  }

  /**
   * Принимает транзакцию
   * @param email - Email аккаунта
   * @param transactionId - ID транзакции
   */
  async acceptTransaction(email: string, transactionId: string): Promise<void> {
    const client = this.getClient(email);

    try {
      await client.acceptTransaction(transactionId);

      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        await client.acceptTransaction(transactionId);
      } else {
        throw error;
      }
    }
  }

  /**
   * Подтверждает транзакцию с чеком
   * @param email - Email аккаунта
   * @param transactionId - ID транзакции
   * @param receiptPath - Путь к файлу чека
   * @returns Обновленная транзакция
   */
  async approveTransactionWithReceipt(
    email: string,
    transactionId: string,
    receiptPath: string,
  ): Promise<Payout> {
    const client = this.getClient(email);

    try {
      const result = await client.approveTransactionWithReceipt(
        transactionId,
        receiptPath,
      );

      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }

      return result;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await client.approveTransactionWithReceipt(
          transactionId,
          receiptPath,
        );
      }
      throw error;
    }
  }

  /**
   * Устанавливает баланс для аккаунта
   * @param email - Email аккаунта
   * @param amount - Сумма для установки
   * @returns Установленная сумма
   */
  async setBalance(email: string, amount: number): Promise<number> {
    const client = this.getClient(email);
    
    try {
      const result = await client.setBalance(amount);
      
      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }
      
      return result;
    } catch (error: unknown) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await client.setBalance(amount);
      }
      throw error;
    }
  }

  /**
   * Получает транзакции со статусом "ожидание" (статус 4)
   * @param email - Email аккаунта
   * @returns Массив транзакций в ожидании
   */
  async getPendingTransactions(email: string): Promise<Payout[]> {
    const client = this.getClient(email);
    
    try {
      const transactions = await client.getPendingTransactions();
      
      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }
      
      return transactions;
    } catch (error: unknown) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await client.getPendingTransactions();
      }
      throw error;
    }
  }

  /**
   * Ищет транзакцию по ID
   * @param email - Email аккаунта
   * @param transactionId - ID транзакции
   * @returns Найденная транзакция или undefined
   */
  async searchTransactionById(
    email: string, 
    transactionId: string
  ): Promise<Payout | undefined> {
    const client = this.getClient(email);
    
    try {
      const transaction = await client.searchTransactionById(transactionId);
      
      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }
      
      return transaction;
    } catch (error: unknown) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await client.searchTransactionById(transactionId);
      }
      throw error;
    }
  }

  /**
   * Сохраняет cookies для аккаунта
   * @param email - Email аккаунта
   */
  async saveCookiesForAccount(email: string): Promise<void> {
    const account = this.accounts.get(email);
    const client = this.clients.get(email);

    if (!account || !client) {
      return;
    }

    const cookies = client.getCookies();
    if (cookies.length > 0) {
      account.cookies = cookies;
      const cookiesPath = this.getCookiesPath(email);
      await saveCookiesToFile(cookies, cookiesPath);
      console.log(
        `[GateAccountManager] Сохранено ${cookies.length} cookies для ${email}`,
      );
    }
  }

  /**
   * Сохраняет cookies для всех аккаунтов
   */
  async saveAllCookies(): Promise<void> {
    for (const email of this.accounts.keys()) {
      await this.saveCookiesForAccount(email);
    }
  }

  /**
   * Получает список всех аккаунтов
   * @returns Массив с информацией об аккаунтах
   */
  getAccounts(): Array<{
    id: string;
    email: string;
    isActive: boolean;
    lastUsed?: Date;
    hasCookies: boolean;
  }> {
    return Array.from(this.accounts.entries()).map(([email, account]) => ({
      id: email, // Use email as ID for compatibility
      email,
      isActive: account.isActive || false,
      lastUsed: account.lastUsed,
      hasCookies: (account.cookies?.length || 0) > 0,
    }));
  }

  /**
   * Удаляет аккаунт
   * @param email - Email аккаунта
   * @param deleteCookies - Удалить файл с cookies
   */
  async removeAccount(
    email: string,
    deleteCookies: boolean = false,
  ): Promise<void> {
    this.accounts.delete(email);
    this.clients.delete(email);

    if (deleteCookies) {
      try {
        const cookiesPath = this.getCookiesPath(email);
        await fs.unlink(cookiesPath);
        console.log(`[GateAccountManager] Удалены cookies для ${email}`);
      } catch (error: unknown) {
        // Игнорируем ошибки удаления
      }
    }

    console.log(`[GateAccountManager] Аккаунт ${email} удален`);
  }

  /**
   * Проверяет, авторизован ли аккаунт
   * @param email - Email аккаунта
   * @returns true если авторизован
   */
  async isAuthenticated(email: string): Promise<boolean> {
    const client = this.clients.get(email);
    if (!client) {
      return false;
    }

    return await client.isAuthenticated();
  }

  /**
   * Получает статистику rate limiter
   * @returns Статистика
   */
  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * Обновляет лимиты rate limiter
   * @param maxRequests - Новый лимит запросов
   * @param windowMs - Новое окно в миллисекундах
   */
  updateRateLimits(maxRequests?: number, windowMs?: number): void {
    this.rateLimiter.updateLimits(maxRequests, windowMs);
    console.log(
      `[GateAccountManager] Обновлены лимиты: ${maxRequests || 240} запросов в ${(windowMs || 60000) / 1000} сек`,
    );
  }

  /**
   * Получает путь к файлу cookies для аккаунта
   * @param email - Email аккаунта
   * @returns Путь к файлу
   */
  private getCookiesPath(email: string): string {
    // Заменяем специальные символы в email для имени файла
    const safeEmail = email.replace(/[^a-zA-Z0-9.-]/g, "_");
    return path.join(this.cookiesDir, `${safeEmail}.json`);
  }

  /**
   * Выполняет операцию с автоматическим повторным входом при истечении сессии
   * @param email - Email аккаунта
   * @param operation - Операция для выполнения
   * @returns Результат операции
   */
  async withAutoRelogin<T>(
    email: string,
    operation: (client: GateClient) => Promise<T>,
  ): Promise<T> {
    const client = this.getClient(email);

    try {
      const result = await operation(client);

      if (this.autoSaveCookies) {
        await this.saveCookiesForAccount(email);
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof SessionExpiredError) {
        console.log(
          `[GateAccountManager] Сессия истекла для ${email}, выполняем повторный вход`,
        );
        await this.login(email);
        return await operation(client);
      }
      throw error;
    }
  }
}
