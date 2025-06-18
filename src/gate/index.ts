/**
 * Gate.io API модуль
 * 
 * Полнофункциональный модуль для работы с Gate.io API
 * Поддерживает:
 * - Множество аккаунтов
 * - Автоматическое сохранение и загрузку cookies
 * - Rate limiting (240 запросов в минуту по умолчанию)
 * - Автоматический повторный вход при истечении сессии
 * 
 * @example
 * ```typescript
 * import { GateAccountManager } from './gate';
 * 
 * const manager = new GateAccountManager({
 *   cookiesDir: './data/cookies',
 *   rateLimiterOptions: {
 *     maxRequests: 240,
 *     windowMs: 60000
 *   }
 * });
 * 
 * await manager.initialize();
 * await manager.addAccount('user@example.com', 'password');
 * 
 * const balance = await manager.getBalance('user@example.com', 'RUB');
 * console.log(`Баланс: ${balance.balance} RUB`);
 * ```
 */

// Экспортируем основные классы
export { GateClient } from './client';
export { GateAccountManager } from './accountManager';
export { RateLimiter } from './utils/rateLimiter';

// Экспортируем типы
export * from './types/models';

// Экспортируем утилиты для cookies
export {
  parseCookieString,
  cookiesToString,
  saveCookiesToFile,
  loadCookiesFromFile,
  filterValidCookies,
  mergeCookies,
  isCookieValidForUrl,
  getCookiesForUrl
} from './utils/cookieUtils';

// Реэкспортируем опции для удобства
export type { GateAccountManagerOptions } from './accountManager';