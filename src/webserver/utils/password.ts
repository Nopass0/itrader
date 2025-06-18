/**
 * Утилиты для работы с паролями
 */

import * as crypto from 'crypto';

/**
 * Генерирует случайный пароль
 * @param length - длина пароля (по умолчанию 16)
 * @returns сгенерированный пароль
 */
export function generatePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Гарантируем наличие всех типов символов
  password += charset.slice(0, 26)[Math.floor(Math.random() * 26)]; // lowercase
  password += charset.slice(26, 52)[Math.floor(Math.random() * 26)]; // uppercase
  password += charset.slice(52, 62)[Math.floor(Math.random() * 10)]; // number
  password += charset.slice(62)[Math.floor(Math.random() * 8)]; // special
  
  // Заполняем остальную часть
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Перемешиваем символы
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Хеширует пароль с использованием PBKDF2 (Bun-compatible)
 * @param password - исходный пароль
 * @returns хешированный пароль
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Generate a random salt
    const salt = crypto.randomBytes(16);
    
    // Hash the password with PBKDF2
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      
      // Combine salt and hash for storage
      const hash = salt.toString('hex') + ':' + derivedKey.toString('hex');
      resolve(hash);
    });
  });
}

/**
 * Проверяет пароль с использованием PBKDF2 (Bun-compatible)
 * @param password - проверяемый пароль
 * @param hash - хеш для сравнения
 * @returns true если пароль верный
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Extract salt and hash from stored string
    const [saltHex, hashHex] = hash.split(':');
    if (!saltHex || !hashHex) {
      resolve(false);
      return;
    }
    
    const salt = Buffer.from(saltHex, 'hex');
    
    // Hash the provided password with the same salt
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      
      // Compare the hashes
      resolve(derivedKey.toString('hex') === hashHex);
    });
  });
}

/**
 * Генерирует токен авторизации
 * @param length - длина токена в байтах (по умолчанию 32)
 * @returns hex строка токена
 */
export function generateAuthToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Генерирует JWT токен (простая реализация)
 * @param payload - данные для токена
 * @param secret - секретный ключ
 * @param expiresIn - время жизни в секундах
 * @returns JWT токен
 */
export function generateJWT(payload: any, secret: string, expiresIn: number = 86400): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Проверяет JWT токен
 * @param token - токен для проверки
 * @param secret - секретный ключ
 * @returns payload или null если токен невалидный
 */
export function verifyJWT(token: string, secret: string): any | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    
    // Проверяем срок действия
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}