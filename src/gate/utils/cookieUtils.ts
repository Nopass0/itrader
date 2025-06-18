/**
 * Утилиты для работы с cookies
 */

import type { Cookie } from "../types/models";
import fs from "fs/promises";
import path from "path";

/**
 * Парсит строку cookie в объект Cookie
 * @param cookieStr - Строка cookie из заголовка Set-Cookie
 * @returns Объект Cookie или null если не удалось распарсить
 */
export function parseCookieString(cookieStr: string): Cookie | null {
  const parts = cookieStr.split(";").map((p) => p.trim());
  if (parts.length === 0) return null;

  // Первая часть - это name=value
  const [name, value] = parts[0].split("=");
  if (!name || value === undefined) return null;

  const cookie: Cookie = {
    name,
    value,
    domain: ".panel.gate.cx",
    path: "/",
    secure: true,
    httpOnly: true,
    session: false,
    hostOnly: false,
  };

  // Парсим остальные атрибуты
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const [key, val] = part.split("=");

    switch (key.toLowerCase()) {
      case "domain":
        cookie.domain = val;
        break;
      case "path":
        cookie.path = val;
        break;
      case "max-age":
        const maxAge = parseInt(val);
        if (!isNaN(maxAge)) {
          cookie.expirationDate = Date.now() / 1000 + maxAge;
        }
        break;
      case "expires":
        const expiresDate = new Date(val);
        if (!isNaN(expiresDate.getTime())) {
          cookie.expirationDate = expiresDate.getTime() / 1000;
        }
        break;
      case "secure":
        cookie.secure = true;
        break;
      case "httponly":
        cookie.httpOnly = true;
        break;
      case "samesite":
        cookie.sameSite = val;
        break;
    }
  }

  // Если нет даты истечения, устанавливаем на 30 дней
  if (!cookie.expirationDate) {
    cookie.expirationDate = Date.now() / 1000 + 30 * 24 * 60 * 60;
  }

  return cookie;
}

/**
 * Конвертирует массив Cookie в строку для заголовка Cookie
 * @param cookies - Массив объектов Cookie
 * @returns Строка для заголовка Cookie
 */
export function cookiesToString(cookies: Cookie[]): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

/**
 * Сохраняет cookies в файл
 * @param cookies - Массив cookies для сохранения
 * @param filePath - Путь к файлу
 */
export async function saveCookiesToFile(
  cookies: Cookie[],
  filePath: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
}

/**
 * Загружает cookies из файла
 * @param filePath - Путь к файлу
 * @returns Массив cookies
 */
export async function loadCookiesFromFile(filePath: string): Promise<Cookie[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: unknown) {
    console.warn(`Не удалось загрузить cookies из ${filePath}:`, error);
    return [];
  }
}

/**
 * Фильтрует истекшие cookies
 * @param cookies - Массив cookies
 * @returns Массив действительных cookies
 */
export function filterValidCookies(cookies: Cookie[]): Cookie[] {
  const now = Date.now() / 1000;
  return cookies.filter((cookie) => {
    if (!cookie.expirationDate) return true;
    return cookie.expirationDate > now;
  });
}

/**
 * Объединяет два массива cookies, заменяя дубликаты
 * @param oldCookies - Старые cookies
 * @param newCookies - Новые cookies
 * @returns Объединенный массив cookies
 */
export function mergeCookies(
  oldCookies: Cookie[],
  newCookies: Cookie[],
): Cookie[] {
  const cookieMap = new Map<string, Cookie>();

  // Сначала добавляем старые
  oldCookies.forEach((cookie) => {
    const key = `${cookie.domain}|${cookie.path}|${cookie.name}`;
    cookieMap.set(key, cookie);
  });

  // Затем перезаписываем новыми
  newCookies.forEach((cookie) => {
    const key = `${cookie.domain}|${cookie.path}|${cookie.name}`;
    cookieMap.set(key, cookie);
  });

  return Array.from(cookieMap.values());
}

/**
 * Проверяет, подходит ли cookie для данного URL
 * @param cookie - Cookie для проверки
 * @param url - URL для проверки
 * @returns true если cookie подходит для URL
 */
export function isCookieValidForUrl(cookie: Cookie, url: string): boolean {
  const urlObj = new URL(url);

  // Проверка домена
  if (cookie.domain) {
    const domain = cookie.domain.startsWith(".")
      ? cookie.domain.substring(1)
      : cookie.domain;
    if (!urlObj.hostname.endsWith(domain) && urlObj.hostname !== domain) {
      return false;
    }
  }

  // Проверка пути
  if (cookie.path && !urlObj.pathname.startsWith(cookie.path)) {
    return false;
  }

  // Проверка secure
  if (cookie.secure && urlObj.protocol !== "https:") {
    return false;
  }

  // Проверка срока действия
  if (cookie.expirationDate && cookie.expirationDate < Date.now() / 1000) {
    return false;
  }

  return true;
}

/**
 * Получает cookies подходящие для URL
 * @param cookies - Массив всех cookies
 * @param url - URL для которого нужны cookies
 * @returns Отфильтрованный массив cookies
 */
export function getCookiesForUrl(cookies: Cookie[], url: string): Cookie[] {
  return cookies.filter((cookie) => isCookieValidForUrl(cookie, url));
}
