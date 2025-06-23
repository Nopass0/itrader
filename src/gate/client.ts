/**
 * Клиент для работы с Gate.io API
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  AxiosError,
} from "axios";
import { Decimal } from "decimal.js";
import FormData from "form-data";
import fs from "fs";
import {
  type Cookie,
  type GateResponse,
  type LoginResponse,
  type AuthMeResponse,
  type BalanceResponse,
  type GateTransaction,
  type TransactionFilter,
  type Payout,
  type PayoutsResponse,
  type PayoutResponse,
  GateApiError,
  CloudflareError,
  SessionExpiredError,
  RateLimitError,
  type GateClientOptions,
} from "./types/models";
import { RateLimiter } from "./utils/rateLimiter";
import {
  parseCookieString,
  cookiesToString,
  saveCookiesToFile,
  loadCookiesFromFile,
  filterValidCookies,
  mergeCookies,
} from "./utils/cookieUtils";

/**
 * Клиент для работы с Gate.io API
 * Поддерживает авторизацию, управление cookies и rate limiting
 */
export class GateClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private cookies: Cookie[] = [];
  private rateLimiter: RateLimiter;
  private email?: string;
  private password?: string;
  private isReauthorizing: boolean = false;

  /**
   * Создает новый экземпляр GateClient
   * @param rateLimiter - RateLimiter для контроля частоты запросов
   * @param options - Дополнительные опции
   */
  constructor(rateLimiter: RateLimiter, options: GateClientOptions = {}) {
    this.baseUrl = options.baseUrl || "https://panel.gate.cx/api/v1";
    this.rateLimiter = rateLimiter;

    this.client = axios.create({
      timeout: options.timeout || 30000,
      maxRedirects: 0,
      validateStatus: () => true, // Обрабатываем все статусы
    });

    // Перехватчик для добавления cookies
    this.client.interceptors.request.use(
      async (config) => {
        // Ждем разрешения от rate limiter
        await this.rateLimiter.checkAndWait("gate");

        // Добавляем cookies
        if (this.cookies.length > 0) {
          config.headers["Cookie"] = cookiesToString(this.cookies);
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Перехватчик для обработки ответов
    this.client.interceptors.response.use(
      (response) => {
        // Сохраняем новые cookies
        const setCookieHeaders = response.headers["set-cookie"];
        if (setCookieHeaders) {
          const newCookies: Cookie[] = [];
          setCookieHeaders.forEach((cookieStr: string) => {
            const cookie = parseCookieString(cookieStr);
            if (cookie) newCookies.push(cookie);
          });

          if (newCookies.length > 0) {
            this.cookies = mergeCookies(this.cookies, newCookies);
            console.log(`[GateClient] Обновлено ${newCookies.length} cookies`);
          }
        }

        return response;
      },
      (error) => Promise.reject(error),
    );
  }

  /**
   * Выполняет авторизацию в Gate.io
   * @param email - Email пользователя
   * @param password - Пароль пользователя
   * @returns Информация о сессии
   * @throws {GateApiError} При ошибке авторизации
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    console.log(`[GateClient] Авторизация для ${email}`);
    this.email = email;
    this.password = password;

    const response = await this.client.post(
      `${this.baseUrl}/auth/basic/login`,
      { login: email, password },
      this.getRequestConfig(),
    );

    this.checkResponse(response);

    // Если получили cookies, считаем авторизацию успешной
    if (this.cookies.length > 0) {
      console.log(
        `[GateClient] Успешная авторизация для ${email} (получено ${this.cookies.length} cookies)`,
      );
      return {
        userId: "from_cookies",
        sessionId: "from_cookies",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    }

    const data = response.data as GateResponse<LoginResponse>;
    if (!data.success) {
      throw new GateApiError(data.error || "Ошибка авторизации");
    }

    console.log(`[GateClient] Успешная авторизация для ${email}`);
    return data.response!;
  }

  /**
   * Устанавливает cookies для клиента
   * @param cookies - Массив cookies
   */
  setCookies(cookies: Cookie[]): void {
    this.cookies = filterValidCookies(cookies);
    console.log(`[GateClient] Установлено ${this.cookies.length} cookies`);
  }

  /**
   * Получает текущие cookies
   * @returns Массив cookies
   */
  getCookies(): Cookie[] {
    return this.cookies;
  }

  /**
   * Сохраняет cookies в файл
   * @param filePath - Путь к файлу
   */
  async saveCookies(filePath: string): Promise<void> {
    await saveCookiesToFile(this.cookies, filePath);
  }

  /**
   * Загружает cookies из файла
   * @param filePath - Путь к файлу
   */
  async loadCookies(filePath: string): Promise<void> {
    const cookies = await loadCookiesFromFile(filePath);
    this.setCookies(cookies);
  }

  /**
   * Получает баланс по валюте
   * @param currency - Код валюты (например, RUB)
   * @returns Информация о балансе
   * @throws {SessionExpiredError} При истечении сессии
   */
  async getBalance(currency: string): Promise<BalanceResponse> {
    return await this.executeWithRetry(async () => {
      const response = await this.client.get(
        `${this.baseUrl}/auth/me`,
        this.getRequestConfig(),
      );

      this.checkResponse(response);

      const data = response.data as GateResponse<AuthMeResponse>;
      if (!data.success) {
        throw new GateApiError(data.error || "Ошибка получения баланса");
      }

      const authResponse = data.response!;
      const wallet = authResponse.user.wallets.find(
        (w) =>
          w.currency.code.toUpperCase() === currency.toUpperCase() ||
          (w.currency.code === "643" && currency.toUpperCase() === "RUB"),
      );

      if (!wallet) {
        throw new GateApiError(`Кошелек для валюты ${currency} не найден`);
      }

      const balance = new Decimal(wallet.balance);
      return {
        currency,
        balance,
        available: balance,
        locked: new Decimal(0),
      };
    });
  }

  /**
   * Получает список доступных транзакций (статус 4 или 5)
   * @returns Массив транзакций
   */
  async getAvailableTransactions(): Promise<Payout[]> {
    return await this.executeWithRetry(async () => {
      const url = `${this.baseUrl}/payments/payouts?filters%5Bstatus%5D%5B%5D=4&filters%5Bstatus%5D%5B%5D=5&page=1`;

      const response = await this.client.get(url, this.getRequestConfig());
      this.checkResponse(response);

      const data = response.data as GateResponse<PayoutsResponse>;
      if (!data.success) {
        throw new GateApiError(data.error || "Ошибка получения транзакций");
      }

      const transactions = data.response!.payouts.data;
      console.log(
        `[GateClient] Найдено ${transactions.length} доступных транзакций`,
      );
      return transactions;
    });
  }

  /**
   * Получает транзакции с фильтром
   * @param filter - Фильтр для транзакций
   * @returns Массив транзакций
   */
  async getTransactionsWithFilter(
    filter: TransactionFilter,
  ): Promise<GateTransaction[]> {
    return await this.executeWithRetry(async () => {
      const params = new URLSearchParams();
      if (filter.page) params.append("page", filter.page.toString());
      if (filter.limit) params.append("per_page", filter.limit.toString());
      else params.append("per_page", "30");

      const response = await this.client.get(
        `${this.baseUrl}/payments/payouts?${params}`,
        this.getRequestConfig(),
      );

      this.checkResponse(response);

      const data = response.data as GateResponse<PayoutsResponse>;
      if (!data.success) {
        throw new GateApiError(data.error || "Ошибка получения транзакций");
      }

      const payouts = data.response!.payouts.data;
      return payouts
        .filter((payout) => payout.amount.trader["643"] !== undefined)
        .map((payout) => this.payoutToTransaction(payout));
    });
  }

  /**
   * Получает все транзакции
   * @returns Массив транзакций
   */
  async getTransactions(): Promise<GateTransaction[]> {
    return this.getTransactionsWithFilter({});
  }

  /**
   * Принимает транзакцию в работу (показывает детали)
   * @param transactionId - ID транзакции
   * @throws {GateApiError} При ошибке
   */
  async acceptTransaction(transactionId: string): Promise<void> {
    return await this.executeWithRetry(async () => {
      console.log(`[GateClient] Принятие транзакции ${transactionId}`);

      const response = await this.client.post(
        `${this.baseUrl}/payments/payouts/${transactionId}/show`,
        {},
        this.getRequestConfig(),
      );

      // Проверяем различные статусы ответа
      if (
        response.status === 409 ||
        response.status === 422 ||
        response.status === 400
      ) {
        const data = response.data;
        if (
          data?.response?.error_description?.includes("incorrect_status") ||
          data?.message?.includes("already") ||
          data?.message?.includes("processing")
        ) {
          console.warn(`[GateClient] Транзакция ${transactionId} уже обработана`);
          return;
        }
      }

      this.checkResponse(response);
      console.log(`[GateClient] Транзакция ${transactionId} успешно принята`);
    });
  }

  /**
   * Подтверждает транзакцию с чеком
   * @param transactionId - ID транзакции
   * @param receiptPath - Путь к PDF файлу чека
   * @returns Обновленная транзакция
   */
  async approveTransactionWithReceipt(
    transactionId: string,
    receiptPath: string,
  ): Promise<Payout> {
    console.log(
      `[GateClient] Подтверждение транзакции ${transactionId} с чеком ${receiptPath}`,
    );

    const form = new FormData();
    form.append("attachments[]", fs.createReadStream(receiptPath), {
      filename: "receipt.pdf",
      contentType: "application/pdf",
    });

    const config = this.getRequestConfig();
    config.headers = {
      ...config.headers,
      ...form.getHeaders(),
    };

    console.log(`[GateClient] Sending POST request to: ${this.baseUrl}/payments/payouts/${transactionId}/approve`);
    
    const response = await this.client.post(
      `${this.baseUrl}/payments/payouts/${transactionId}/approve`,
      form,
      config,
    );

    console.log(`[GateClient] Response status: ${response.status}`);
    console.log(`[GateClient] Response data:`, response.data);

    this.checkResponse(response);

    const data = response.data as GateResponse<PayoutResponse>;
    if (!data.success) {
      console.error(`[GateClient] Approval failed:`, data.error);
      throw new GateApiError(data.error || "Ошибка подтверждения транзакции");
    }

    console.log(
      `[GateClient] Транзакция ${transactionId} успешно подтверждена с чеком`,
    );
    
    if (data.response?.payout) {
      console.log(`[GateClient] New payout status: ${data.response.payout.status} (${data.response.payout.statusLabel})`);
    }
    
    return data.response!.payout;
  }

  /**
   * Подтверждает транзакцию без чека
   * @param transactionId - ID транзакции
   * @returns Обновленная транзакция
   */
  async approveTransaction(transactionId: string): Promise<Payout> {
    console.log(`[GateClient] Подтверждение транзакции ${transactionId}`);

    const response = await this.client.post(
      `${this.baseUrl}/payments/payouts/${transactionId}/approve`,
      {},
      this.getRequestConfig(),
    );

    this.checkResponse(response);

    const data = response.data as GateResponse<PayoutResponse>;
    if (!data.success) {
      throw new GateApiError(data.error || "Ошибка подтверждения транзакции");
    }

    console.log(
      `[GateClient] Транзакция ${transactionId} успешно подтверждена`,
    );
    return data.response!.payout;
  }

  /**
   * Отменяет заказ
   * @param transactionId - ID транзакции
   * @returns Обновленная транзакция
   */
  async cancelOrder(transactionId: string): Promise<Payout> {
    console.log(`[GateClient] Отмена заказа ${transactionId}`);

    const response = await this.client.post(
      `${this.baseUrl}/payments/payouts/${transactionId}/cancel`,
      {},
      this.getRequestConfig(),
    );

    this.checkResponse(response);

    const data = response.data as GateResponse<PayoutResponse>;
    if (!data.success) {
      throw new GateApiError(data.error || "Ошибка отмены заказа");
    }

    console.log(`[GateClient] Заказ ${transactionId} успешно отменен`);
    return data.response!.payout;
  }

  /**
   * Получает детали транзакции
   * @param transactionId - ID транзакции
   * @returns Детали транзакции
   */
  async getTransactionDetails(transactionId: string): Promise<Payout> {
    const response = await this.client.get(
      `${this.baseUrl}/payments/payouts/${transactionId}/`,
      this.getRequestConfig(),
    );

    this.checkResponse(response);

    const data = response.data;

    // Пробуем разные форматы ответа
    if (data.success && data.response?.payout) {
      return data.response.payout;
    } else if (data.success && data.response) {
      return data.response;
    }

    throw new GateApiError("Не удалось получить детали транзакции");
  }

  /**
   * Получает историю транзакций
   * @param page - Номер страницы
   * @returns Массив транзакций
   */
  async getHistoryTransactions(page: number = 1): Promise<Payout[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: "30",
    });

    const response = await this.client.get(
      `${this.baseUrl}/payments/payouts?${params}`,
      this.getRequestConfig(),
    );

    this.checkResponse(response);

    const data = response.data as GateResponse<PayoutsResponse>;
    if (!data.success) {
      throw new GateApiError(data.error || "Ошибка получения истории");
    }

    const transactions = data.response!.payouts.data.filter(
      (payout) =>
        (payout.status === 7 && payout.approvedAt) || payout.status === 9,
    );

    console.log(
      `[GateClient] Найдено ${transactions.length} транзакций в истории (страница ${page})`,
    );
    return transactions;
  }

  /**
   * Устанавливает баланс (для тестирования или специальных операций)
   * @param amount - Сумма для установки
   * @returns Установленная сумма
   */
  async setBalance(amount: number): Promise<number> {
    return await this.executeWithRetry(async () => {
      const response = await this.client.post(
        `${this.baseUrl}/payments/payouts/balance`,
        { amount: amount.toString() },
        this.getRequestConfig(),
      );

      this.checkResponse(response);

      const status = response.status;
      const responseText = response.data;

      console.log(
        `[GateClient] Set balance response (status ${status}):`,
        responseText,
      );

      const data = response.data as GateResponse<any>;
      if (!data.success) {
        throw new GateApiError(data.error || "Ошибка установки баланса");
      }

      console.log(`[GateClient] Баланс успешно установлен: ${amount}`);
      return amount;
    });
  }

  /**
   * Получает транзакции со статусом "ожидание" (статус 4)
   * @returns Массив транзакций в ожидании
   */
  async getPendingTransactions(): Promise<Payout[]> {
    return await this.executeWithRetry(async () => {
      const url = `${this.baseUrl}/payments/payouts?filters%5Bstatus%5D%5B%5D=4&page=1`;
      console.log(`[GateClient] Fetching pending transactions from: ${url}`);

      const response = await this.client.get(url, this.getRequestConfig());
      console.log(`[GateClient] Response status: ${response.status}`);
      console.log(`[GateClient] Response data:`, JSON.stringify(response.data, null, 2));
      
      this.checkResponse(response);

      const data = response.data as GateResponse<PayoutsResponse>;
      if (!data.success) {
        console.error(`[GateClient] API returned success=false:`, data);
        throw new GateApiError(
          data.error || "Ошибка получения ожидающих транзакций",
        );
      }

      if (!data.response || !data.response.payouts || !data.response.payouts.data) {
        console.error(`[GateClient] Unexpected response structure:`, data);
        throw new GateApiError("Неожиданная структура ответа от API");
      }

      const transactions = data.response.payouts.data;
      console.log(
        `[GateClient] Найдено ${transactions.length} транзакций в ожидании (статус 4)`,
      );
      
      // Log first transaction for debugging
      if (transactions.length > 0) {
        console.log(`[GateClient] First transaction:`, JSON.stringify(transactions[0], null, 2));
      }
      
      return transactions;
    });
  }

  /**
   * Approves a payout with a receipt attachment
   * @param payoutId - ID of the payout to approve
   * @param receiptData - PDF receipt data
   * @returns Success status
   */
  async approvePayout(payoutId: string, receiptData: Buffer): Promise<boolean> {
    const url = `${this.baseUrl}/payments/payouts/${payoutId}/approve`;
    console.log(`[GateClient] Approving payout ${payoutId}`);

    try {
      const formData = new FormData();
      formData.append('attachments[]', receiptData, {
        filename: 'receipt.pdf',
        contentType: 'application/pdf'
      });
      
      const response = await this.client.post(url, formData, {
        ...this.getRequestConfig(),
        headers: {
          ...this.getRequestConfig().headers,
          // Не устанавливаем Content-Type вручную - axios сделает это автоматически для FormData
        }
      });
      
      this.checkResponse(response);
      
      const data = response.data as GateResponse<any>;
      if (!data.success) {
        throw new GateApiError(data.error || "Failed to approve payout");
      }
      
      // Логируем детали успешного апрува
      if (data.response?.payout) {
        const payout = data.response.payout;
        console.log(`[GateClient] Payout ${payoutId} approved successfully:`, {
          status: payout.status,
          approved_at: payout.approved_at,
          attachments_count: payout.attachments?.length || 0
        });
      } else {
        console.log(`[GateClient] Payout ${payoutId} approved successfully`);
      }
      
      return true;
    } catch (error) {
      console.error(`[GateClient] Error approving payout ${payoutId}:`, error);
      throw error;
    }
  }

  /**
   * Ищет транзакцию по ID
   * @param transactionId - ID транзакции для поиска
   * @returns Найденная транзакция или undefined
   */
  async searchTransactionById(
    transactionId: string,
  ): Promise<Payout | undefined> {
    const url = `${this.baseUrl}/payments/payouts?search%5Bid%5D=${transactionId}&filters%5Bstatus%5D%5B%5D=4&filters%5Bstatus%5D%5B%5D=5&page=1`;

    console.log(`[GateClient] Поиск транзакции ${transactionId}`);

    const response = await this.client.get(url, this.getRequestConfig());
    this.checkResponse(response);

    const data = response.data as GateResponse<PayoutsResponse>;

    if (data.success && data.response) {
      const payouts = data.response.payouts.data;
      if (payouts.length > 0) {
        const payout = payouts[0];
        console.log(`[GateClient] Найдена транзакция ${transactionId}`);
        return payout;
      }
    }

    console.log(`[GateClient] Транзакция ${transactionId} не найдена`);
    return undefined;
  }

  /**
   * Search payouts with filters
   * @param filters - Search filters
   * @returns Array of payouts
   */
  async searchPayouts(filters: { id?: string; status?: number }): Promise<Payout[]> {
    let url = `${this.baseUrl}/payments/payouts?page=1`;
    
    if (filters.id) {
      url += `&search[term]=${filters.id}`;
    }
    if (filters.status !== undefined) {
      url += `&filters[status][]=${filters.status}`;
    }
    
    console.log(`[GateClient] Searching payouts: ${url}`);
    
    const response = await this.client.get(url, this.getRequestConfig());
    this.checkResponse(response);
    
    const data = response.data as GateResponse<PayoutsResponse>;
    if (!data.success || !data.response) {
      throw new GateApiError(data.error || "Failed to search payouts");
    }
    
    return data.response.payouts.data;
  }

  /**
   * Проверяет, авторизован ли клиент
   * @returns true если авторизован
   */
  async isAuthenticated(): Promise<boolean> {
    if (this.cookies.length === 0) {
      return false;
    }

    try {
      await this.getBalance("RUB");
      return true;
    } catch {
      // Намеренно игнорируем ошибку - клиент не авторизован
      return false;
    }
  }

  /**
   * Получает email текущего пользователя
   * @returns Email или undefined
   */
  getEmail(): string | undefined {
    return this.email;
  }

  /**
   * Преобразует Payout в GateTransaction
   */
  private payoutToTransaction(payout: Payout): GateTransaction {
    const rubAmount = payout.amount.trader["643"] || 0;
    const rubTotal = payout.total.trader["643"] || 0;

    return {
      id: payout.id.toString(),
      orderId: payout.id.toString(),
      amount: new Decimal(rubAmount),
      currency: "RUB",
      fiatCurrency: "RUB",
      fiatAmount: new Decimal(rubTotal),
      rate: new Decimal(1),
      status: payout.status,
      buyerName: payout.user?.name || "Unknown",
      paymentMethod: payout.method.label,
      createdAt: new Date(payout.createdAt),
      updatedAt: payout.updatedAt
        ? new Date(payout.updatedAt)
        : new Date(payout.createdAt),
    };
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Получает конфигурацию для запроса
   */
  private getRequestConfig(): AxiosRequestConfig {
    return {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.getRandomUserAgent(),
        Referer: "https://panel.gate.cx/",
        Origin: "https://panel.gate.cx",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "identity",
        DNT: "1",
      },
    };
  }

  /**
   * Автоматически переавторизуется при истечении сессии
   * @returns true если переавторизация успешна
   */
  private async reauthorize(): Promise<boolean> {
    if (this.isReauthorizing || !this.email || !this.password) {
      return false;
    }

    this.isReauthorizing = true;
    console.log(`[GateClient] Attempting reauthorization for ${this.email}`);
    
    try {
      await this.login(this.email, this.password);
      console.log(`[GateClient] Reauthorization successful for ${this.email}`);
      this.isReauthorizing = false;
      return true;
    } catch (error) {
      console.error(`[GateClient] Reauthorization failed for ${this.email}:`, error);
      this.isReauthorizing = false;
      return false;
    }
  }

  /**
   * Выполняет запрос с автоматической переавторизацией при 401 ошибке
   */
  private async executeWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      // Если получили 401 и можем переавторизоваться
      if (error instanceof SessionExpiredError && !this.isReauthorizing) {
        console.log(`[GateClient] Session expired, attempting reauthorization`);
        const reauthorized = await this.reauthorize();
        
        if (reauthorized) {
          // Повторяем запрос после успешной переавторизации
          console.log(`[GateClient] Retrying request after reauthorization`);
          return await requestFn();
        }
      }
      
      // Если не можем переавторизоваться или это другая ошибка - пробрасываем
      throw error;
    }
  }

  /**
   * Проверяет ответ на ошибки
   */
  private checkResponse(response: any): void {
    switch (response.status) {
      case 200:
      case 201:
        return;
      case 401:
        throw new SessionExpiredError();
      case 403:
        throw new CloudflareError();
      case 429:
        throw new RateLimitError(60);
      default:
        if (response.status >= 400) {
          throw new GateApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            "HTTP_ERROR",
            response.status,
          );
        }
    }
  }
}
