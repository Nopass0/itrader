/**
 * Rate Limiter для контроля частоты запросов к API
 */

import type { RateLimiterOptions, RateLimitError } from "../types/models";

interface RequestInfo {
  timestamp: number;
  identifier: string;
}

interface QueuedRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  identifier: string;
}

/**
 * Класс для ограничения частоты запросов к API
 * Реализует очередь запросов с ограничением по количеству в минуту
 */
export class RateLimiter {
  private requests: RequestInfo[] = [];
  private queue: QueuedRequest[] = [];
  private maxRequests: number;
  private windowMs: number;
  private processing = false;

  /**
   * Создает новый экземпляр RateLimiter
   * @param options - Опции для настройки лимитера
   * @param options.maxRequests - Максимальное количество запросов в окно (по умолчанию 240)
   * @param options.windowMs - Размер окна в миллисекундах (по умолчанию 60000 - 1 минута)
   */
  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests || 240;
    this.windowMs = options.windowMs || 60000; // 1 минута
  }

  /**
   * Проверяет, можно ли выполнить запрос, и ждет если необходимо
   * @param identifier - Идентификатор запроса (например, имя эндпоинта)
   * @returns Promise, который резолвится когда можно выполнить запрос
   * @throws {RateLimitError} Если превышен лимит запросов
   */
  async checkAndWait(identifier: string = "default"): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, identifier });
      this.processQueue();
    });
  }

  /**
   * Обрабатывает очередь запросов
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.cleanOldRequests(now);

      if (this.requests.length < this.maxRequests) {
        // Можем выполнить запрос
        const request = this.queue.shift()!;
        this.requests.push({
          timestamp: now,
          identifier: request.identifier,
        });
        request.resolve();
      } else {
        // Нужно подождать
        const oldestRequest = this.requests[0];
        const waitTime = this.windowMs - (now - oldestRequest.timestamp) + 100; // +100ms для надежности

        console.log(
          `[RateLimiter] Достигнут лимит ${this.maxRequests} запросов/мин. Ожидание ${waitTime}ms`,
        );

        await this.sleep(waitTime);
      }
    }

    this.processing = false;
  }

  /**
   * Удаляет старые запросы из истории
   * @param now - Текущее время в миллисекундах
   */
  private cleanOldRequests(now: number): void {
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((req) => req.timestamp > cutoff);
  }

  /**
   * Асинхронная пауза
   * @param ms - Время паузы в миллисекундах
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Получить текущую статистику
   * @returns Объект со статистикой
   */
  getStats(): {
    currentRequests: number;
    maxRequests: number;
    queueLength: number;
    windowMs: number;
  } {
    this.cleanOldRequests(Date.now());
    return {
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests,
      queueLength: this.queue.length,
      windowMs: this.windowMs,
    };
  }

  /**
   * Сбросить счетчики и очередь
   */
  reset(): void {
    this.requests = [];
    this.queue.forEach((req) => req.reject(new Error("Rate limiter reset")));
    this.queue = [];
    this.processing = false;
  }

  /**
   * Изменить лимиты
   * @param maxRequests - Новое максимальное количество запросов
   * @param windowMs - Новый размер окна в миллисекундах
   */
  updateLimits(maxRequests?: number, windowMs?: number): void {
    if (maxRequests !== undefined) {
      this.maxRequests = maxRequests;
    }
    if (windowMs !== undefined) {
      this.windowMs = windowMs;
    }
  }

  /**
   * Получить количество запросов за последний период
   * @param identifier - Фильтр по идентификатору (опционально)
   * @returns Количество запросов
   */
  getRequestCount(identifier?: string): number {
    this.cleanOldRequests(Date.now());
    if (identifier) {
      return this.requests.filter((req) => req.identifier === identifier)
        .length;
    }
    return this.requests.length;
  }

  /**
   * Проверить, можно ли выполнить запрос сейчас (без ожидания)
   * @returns true если можно выполнить запрос
   */
  canMakeRequest(): boolean {
    this.cleanOldRequests(Date.now());
    return this.requests.length < this.maxRequests;
  }

  /**
   * Получить время до возможности следующего запроса
   * @returns Время в миллисекундах или 0 если можно выполнить сейчас
   */
  getTimeUntilNextRequest(): number {
    this.cleanOldRequests(Date.now());

    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    const now = Date.now();
    return Math.max(0, this.windowMs - (now - oldestRequest.timestamp));
  }
}
