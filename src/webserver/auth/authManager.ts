/**
 * Менеджер аутентификации
 */

import { PrismaClient } from '../../../generated/prisma';
import { SystemAccount, AuthToken, LoginRequest } from '../types';
import { 
  generatePassword, 
  hashPassword, 
  verifyPassword, 
  generateJWT, 
  verifyJWT 
} from '../utils/password';

const prisma = new PrismaClient();

export class AuthManager {
  private jwtSecret: string;
  private tokenExpiry: number;

  constructor(jwtSecret?: string) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.tokenExpiry = 86400; // 24 hours
  }

  /**
   * Создает новый аккаунт в системе
   */
  async createAccount(
    username: string, 
    role: 'admin' | 'operator' | 'viewer' = 'operator'
  ): Promise<{ account: SystemAccount; password: string }> {
    // Проверяем уникальность username
    const existing = await prisma.systemAccount.findUnique({
      where: { username }
    });

    if (existing) {
      throw new Error('Username already exists');
    }

    // Генерируем пароль
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    // Создаем аккаунт
    const account = await prisma.systemAccount.create({
      data: {
        username,
        passwordHash,
        role,
        isActive: true
      }
    });

    return { account, password };
  }

  /**
   * Удаляет аккаунт
   */
  async deleteAccount(id: string): Promise<void> {
    // Удаляем все токены
    await prisma.authToken.deleteMany({
      where: { accountId: id }
    });

    // Удаляем аккаунт
    await prisma.systemAccount.delete({
      where: { id }
    });
  }

  /**
   * Обновляет аккаунт
   */
  async updateAccount(
    id: string, 
    updates: Partial<SystemAccount>
  ): Promise<SystemAccount> {
    // Не позволяем обновлять passwordHash напрямую
    const { passwordHash, ...safeUpdates } = updates;

    return prisma.systemAccount.update({
      where: { id },
      data: safeUpdates
    });
  }

  /**
   * Сбрасывает пароль
   */
  async resetPassword(id: string): Promise<string> {
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    await prisma.systemAccount.update({
      where: { id },
      data: { passwordHash }
    });

    // Удаляем все существующие токены
    await prisma.authToken.deleteMany({
      where: { accountId: id }
    });

    return password;
  }

  /**
   * Получает список аккаунтов
   */
  async listAccounts(): Promise<SystemAccount[]> {
    return prisma.systemAccount.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Аутентифицирует пользователя
   */
  async login(credentials: LoginRequest): Promise<{
    token: string;
    user: SystemAccount;
  }> {
    const account = await prisma.systemAccount.findUnique({
      where: { username: credentials.username }
    });

    if (!account || !account.isActive) {
      throw new Error('Invalid credentials');
    }

    const isValid = await verifyPassword(credentials.password, account.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Обновляем время последнего входа
    await prisma.systemAccount.update({
      where: { id: account.id },
      data: { lastLogin: new Date() }
    });

    // Генерируем токен
    const token = generateJWT(
      {
        id: account.id,
        username: account.username,
        role: account.role
      },
      this.jwtSecret,
      this.tokenExpiry
    );

    // Сохраняем токен в БД
    const expiresAt = new Date(Date.now() + this.tokenExpiry * 1000);
    await prisma.authToken.create({
      data: {
        accountId: account.id,
        token,
        expiresAt
      }
    });

    return { token, user: account };
  }

  /**
   * Выход из системы
   */
  async logout(token: string): Promise<void> {
    await prisma.authToken.delete({
      where: { token }
    }).catch(() => {
      // Игнорируем если токен не найден
    });
  }

  /**
   * Проверяет токен
   */
  async verifyToken(token: string): Promise<SystemAccount | null> {
    // Проверяем JWT
    const payload = verifyJWT(token, this.jwtSecret);
    if (!payload) {
      return null;
    }

    // Проверяем в БД
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      include: { account: true }
    });

    if (!authToken || authToken.expiresAt < new Date()) {
      // Удаляем просроченный токен
      if (authToken) {
        await prisma.authToken.delete({
          where: { id: authToken.id }
        }).catch(() => {});
      }
      return null;
    }

    return authToken.account;
  }

  /**
   * Очищает просроченные токены
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.authToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * Получает аккаунт по username
   */
  async getAccountByUsername(username: string): Promise<SystemAccount | null> {
    return prisma.systemAccount.findUnique({
      where: { username }
    });
  }

  /**
   * Получает аккаунт по ID
   */
  async getAccountById(id: string): Promise<SystemAccount | null> {
    return prisma.systemAccount.findUnique({
      where: { id }
    });
  }
}