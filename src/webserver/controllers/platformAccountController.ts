/**
 * Контроллер управления платформенными аккаунтами (Gate, Bybit)
 */

import type { AuthenticatedSocket } from "../types";
import { handleError, handleSuccess } from "../middleware/auth";
import { validatePaginationParams, paginatePrisma } from "../utils/pagination";
import { PrismaClient } from "../../../generated/prisma";
import {
  getActiveGateAccounts,
  upsertGateAccount,
  getActiveBybitAccounts,
  upsertBybitAccount,
} from "../../db";

const prisma = new PrismaClient();

export class PlatformAccountController {
  /**
   * Список Gate аккаунтов
   */
  static async listGateAccounts(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function,
  ) {
    try {
      const params = validatePaginationParams(data);

      const response = await paginatePrisma(prisma.gateAccount, {
        ...params,
        where:
          data.isActive !== undefined ? { isActive: data.isActive } : undefined,
        orderBy: { createdAt: "desc" },
      });

      // Скрываем пароль и API ключи
      const sanitizedData = response.data.map((account: any) => ({
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        email: account.email,
        isActive: account.isActive,
        lastSync: account.lastSync,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        // Добавляем placeholder для API ключей
        apiKey: account.apiKey ? "***" + account.apiKey.slice(-4) : null,
        hasApiKey: !!account.apiKey,
        hasApiSecret: !!account.apiSecret,
      }));

      handleSuccess(
        {
          ...response,
          data: sanitizedData,
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание Gate аккаунта
   */
  static async createGateAccount(
    socket: AuthenticatedSocket,
    data: {
      accountId?: string;
      email: string;
      password: string;
      apiKey: string;
      apiSecret: string;
      accountName?: string;
    },
    callback: Function,
  ) {
    try {
      // Проверяем, не существует ли уже аккаунт с таким email или accountId
      const existing = await prisma.gateAccount.findFirst({
        where: {
          OR: [{ email: data.email }, { accountId: data.accountId || "" }],
        },
      });

      if (existing) {
        throw new Error("Account with this email or ID already exists");
      }

      // Создаем аккаунт
      const account = await prisma.gateAccount.create({
        data: {
          accountId: data.accountId || `gate_${Date.now()}`, // Используем переданный ID или генерируем новый
          email: data.email,
          password: data.password,
          apiKey: data.apiKey || "",
          apiSecret: data.apiSecret || "",
          accountName: data.accountName || data.email,
          isActive: false,
        },
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          email: account.email,
          accountName: account.accountName,
          isActive: account.isActive,
          createdAt: account.createdAt,
        },
        "Gate account created successfully",
        callback,
      );

      // Emit event for real-time updates
      socket.emit("platform:accountCreated", {
        platform: "gate",
        account: {
          id: account.id,
          email: account.email,
          accountName: account.accountName,
        },
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление Gate аккаунта
   */
  static async deleteGateAccount(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function,
  ) {
    try {
      // Soft delete - just mark as inactive
      const account = await prisma.gateAccount.update({
        where: { id: data.id },
        data: { isActive: false },
      });

      handleSuccess(null, "Gate account deleted successfully", callback);

      // Emit event for real-time updates
      socket.emit("platform:accountDeleted", {
        platform: "gate",
        accountId: data.id,
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Список Bybit аккаунтов
   */
  static async listBybitAccounts(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function,
  ) {
    try {
      const params = validatePaginationParams(data);

      const response = await paginatePrisma(prisma.bybitAccount, {
        ...params,
        where:
          data.isActive !== undefined ? { isActive: data.isActive } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          advertisements: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      });

      // Скрываем API ключи
      const sanitizedData = response.data.map((account: any) => ({
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        isActive: account.isActive,
        activeAdsCount: account.advertisements?.length || 0,
        lastSync: account.lastSync,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        // Добавляем placeholder для API ключей
        apiKey: account.apiKey ? "***" + account.apiKey.slice(-4) : null,
        hasApiKey: !!account.apiKey,
        hasApiSecret: !!account.apiSecret,
      }));

      handleSuccess(
        {
          ...response,
          data: sanitizedData,
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание Bybit аккаунта
   */
  static async createBybitAccount(
    socket: AuthenticatedSocket,
    data: { apiKey: string; apiSecret: string; accountName?: string },
    callback: Function,
  ) {
    try {
      // Проверяем, не существует ли уже аккаунт с таким API ключом
      const existing = await prisma.bybitAccount.findFirst({
        where: { apiKey: data.apiKey },
      });

      if (existing) {
        throw new Error("Account with this API key already exists");
      }

      // Создаем аккаунт
      const account = await prisma.bybitAccount.create({
        data: {
          accountId: `bybit_${Date.now()}`, // Уникальный ID
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          accountName: data.accountName || "Bybit Account",
          isActive: true,
        },
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName,
          isActive: account.isActive,
          createdAt: account.createdAt,
        },
        "Bybit account created successfully",
        callback,
      );

      // Emit event for real-time updates
      socket.emit("platform:accountCreated", {
        platform: "bybit",
        account: {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName,
        },
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление Bybit аккаунта
   */
  static async deleteBybitAccount(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function,
  ) {
    try {
      // Soft delete - just mark as inactive
      const account = await prisma.bybitAccount.update({
        where: { id: data.id },
        data: { isActive: false },
      });

      handleSuccess(null, "Bybit account deleted successfully", callback);

      // Emit event for real-time updates
      socket.emit("platform:accountDeleted", {
        platform: "bybit",
        accountId: data.id,
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление Gate аккаунта
   */
  static async updateGateAccount(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function,
  ) {
    try {
      const allowedUpdates = [
        "accountName",
        "apiKey",
        "apiSecret",
        "password",
        "isActive",
      ];
      const filteredUpdates: any = {};

      // Фильтруем разрешенные поля
      for (const key of allowedUpdates) {
        if (data.updates[key] !== undefined) {
          filteredUpdates[key] = data.updates[key];
        }
      }

      // Импортируем логгер для отладки
      const { createLogger } = await import('../../logger');
      const logger = createLogger('PlatformAccountController');

      // Проверяем, включается ли аккаунт
      const currentAccount = await prisma.gateAccount.findUnique({
        where: { id: data.id },
        select: { isActive: true }
      });
      const wasInactive = currentAccount?.isActive === false;
      
      logger.info('Gate account update', {
        accountId: data.id,
        wasInactive,
        currentIsActive: currentAccount?.isActive,
        newIsActive: filteredUpdates.isActive,
        updates: filteredUpdates
      });

      const account = await prisma.gateAccount.update({
        where: { id: data.id },
        data: filteredUpdates,
      });

      // Если аккаунт был включен, устанавливаем баланс 10 млн
      if (wasInactive && filteredUpdates.isActive === true) {
        logger.info('Attempting to set balance for newly activated Gate account', {
          accountId: account.accountId,
          email: account.email
        });
        try {
          // Импортируем необходимые модули
          const { GateAccountManager } = await import('../../gate/accountManager');
          const { createLogger } = await import('../../logger');
          const logger = createLogger('PlatformAccountController');
          
          // Получаем менеджер аккаунтов из глобального контекста
          // Попробуем разные способы получить gateAccountManager
          let gateAccountManager = (global as any).gateAccountManager;
          
          // Если не в global, попробуем через app context
          if (!gateAccountManager) {
            const appContext = (global as any).appContext;
            if (appContext) {
              gateAccountManager = appContext.gateAccountManager;
            }
          }
          
          // Если все еще нет, попробуем через orchestratorContext
          if (!gateAccountManager) {
            const orchestratorContext = (global as any).orchestratorContext;
            if (orchestratorContext && orchestratorContext.shared) {
              gateAccountManager = orchestratorContext.shared.gateAccountManager;
            }
          }
          
          if (gateAccountManager && gateAccountManager instanceof GateAccountManager) {
            // Загружаем аккаунт в менеджер, если его там нет
            // Аккаунты в GateAccountManager индексируются по email
            if (!gateAccountManager.getAccounts().find((acc: any) => acc.email === account.email)) {
              await gateAccountManager.addAccount(
                account.email,
                account.password || '',
                false, // autoLogin = false, мы сами будем управлять авторизацией
                account.accountId // передаем accountId для загрузки cookies
              );
            }
            
            // Используем новый метод, который гарантирует авторизацию
            const client = await gateAccountManager.getAuthenticatedClient(account.email);
            if (client) {
              try {
                // Устанавливаем баланс
                await client.setBalance(10_000_000);
                logger.info(`Successfully set balance to 10m RUB for Gate account ${account.accountId}`);
              } catch (error: any) {
                logger.error('Failed to set balance for Gate account after authentication', error, { 
                  accountId: account.accountId,
                  email: account.email,
                  errorMessage: error.message 
                });
              }
            } else {
              logger.error('Could not get authenticated client for Gate account', { 
                accountId: account.accountId,
                email: account.email 
              });
            }
          } else {
            logger.warn('GateAccountManager not available in global context');
          }
        } catch (error) {
          // Логируем ошибку, но не прерываем основной процесс
          logger.error('Failed to set balance for Gate account', error as Error, { accountId: account.accountId });
        }
      } else {
        logger.debug('Balance not set - conditions not met', {
          wasInactive,
          newIsActive: filteredUpdates.isActive,
          condition: `wasInactive=${wasInactive} && filteredUpdates.isActive=${filteredUpdates.isActive}`
        });
      }

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          email: account.email,
          accountName: account.accountName,
          isActive: account.isActive,
          updatedAt: account.updatedAt,
        },
        "Gate account updated successfully",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление Bybit аккаунта
   */
  static async updateBybitAccount(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function,
  ) {
    try {
      const allowedUpdates = ["accountName", "apiKey", "apiSecret", "isActive"];
      const filteredUpdates: any = {};

      // Фильтруем разрешенные поля
      for (const key of allowedUpdates) {
        if (data.updates[key] !== undefined) {
          filteredUpdates[key] = data.updates[key];
        }
      }

      const account = await prisma.bybitAccount.update({
        where: { id: data.id },
        data: filteredUpdates,
      });

      handleSuccess(
        {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName,
          isActive: account.isActive,
          updatedAt: account.updatedAt,
        },
        "Bybit account updated successfully",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики Gate аккаунта
   */
  static async getGateAccountStats(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function,
  ) {
    try {
      const account = await prisma.gateAccount.findUnique({
        where: { id: data.id },
        include: {
          _count: {
            select: {
              payouts: true,
            },
          },
        },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Получаем статистику по выплатам
      const payoutStats = await prisma.payout.groupBy({
        by: ["status"],
        where: {
          gateAccountId: data.id,
        },
        _count: true,
      });

      handleSuccess(
        {
          account: {
            id: account.id,
            email: account.email,
            accountName: account.accountName,
            lastSync: account.lastSync,
          },
          stats: {
            totalPayouts: account._count.payouts,
            payoutsByStatus: payoutStats,
          },
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики Bybit аккаунта
   */
  static async getBybitAccountStats(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function,
  ) {
    try {
      const account = await prisma.bybitAccount.findUnique({
        where: { id: data.id },
        include: {
          advertisements: {
            where: { isActive: true },
          },
          _count: {
            select: {
              advertisements: true,
            },
          },
        },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Получаем статистику по транзакциям
      const transactionStats = await prisma.transaction.groupBy({
        by: ["status"],
        where: {
          advertisement: {
            bybitAccountId: data.id,
          },
        },
        _count: true,
      });

      handleSuccess(
        {
          account: {
            id: account.id,
            accountId: account.accountId,
            accountName: account.accountName,
            lastSync: account.lastSync,
          },
          stats: {
            totalAds: account._count.advertisements,
            activeAds: account.advertisements.length,
            transactionsByStatus: transactionStats,
          },
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Начало OAuth авторизации Gmail
   */
  static async startGmailOAuth(
    socket: AuthenticatedSocket,
    data: { returnUrl?: string },
    callback: Function,
  ) {
    try {
      // Проверяем наличие файла с credentials
      const fs = await import("fs/promises");
      const path = await import("path");
      const credentialsPath = path.join(
        process.cwd(),
        "data",
        "gmail-credentials.json",
      );

      let credentials: any;
      try {
        const credentialsContent = JSON.parse(
          await fs.readFile(credentialsPath, "utf-8"),
        );
        // Приоритет: web > installed > root
        credentials =
          credentialsContent.web ||
          credentialsContent.installed ||
          credentialsContent;

        if (!credentials.client_id || !credentials.client_secret) {
          throw new Error("Invalid credentials file");
        }
      } catch (error) {
        handleError(
          new Error(
            "Gmail credentials not configured. Please set up gmail-credentials.json",
          ),
          callback,
        );
        return;
      }

      // Создаем OAuth2 клиент
      const { google } = await import("googleapis");
      // Используем первый redirect_uri из credentials файла, если он есть
      const redirectUri =
        credentials.redirect_uris?.[0] ||
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/panel/gmail-callback`;

      const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        redirectUri,
      );

      // Сохраняем state для проверки
      const state = Math.random().toString(36).substring(7);
      const userId = (socket as any).user?.id;

      // Сохраняем state в базе для последующей проверки
      await prisma.settings.upsert({
        where: { key: `gmail_oauth_state_${state}` },
        create: {
          key: `gmail_oauth_state_${state}`,
          value: JSON.stringify({
            userId,
            returnUrl: data.returnUrl || "/panel/accounts",
            createdAt: new Date().toISOString(),
          }),
        },
        update: {
          value: JSON.stringify({
            userId,
            returnUrl: data.returnUrl || "/panel/accounts",
            createdAt: new Date().toISOString(),
          }),
        },
      });

      // Генерируем URL авторизации
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
        prompt: "consent",
        state: state,
      });

      handleSuccess(
        {
          authUrl,
          state,
        },
        "OAuth URL generated",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Завершение OAuth авторизации Gmail
   */
  static async completeGmailOAuth(
    socket: AuthenticatedSocket,
    data: { code: string; state: string },
    callback: Function,
  ) {
    try {
      const userId = (socket as any).user?.id;

      // Проверяем state
      const stateData = await prisma.settings.findUnique({
        where: { key: `gmail_oauth_state_${data.state}` },
      });

      if (!stateData) {
        throw new Error("Invalid OAuth state");
      }

      const stateInfo = JSON.parse(stateData.value);
      if (stateInfo.userId !== userId) {
        throw new Error("Unauthorized OAuth callback");
      }

      // Проверяем, не истек ли state (15 минут)
      const stateAge = Date.now() - new Date(stateInfo.createdAt).getTime();
      if (stateAge > 15 * 60 * 1000) {
        throw new Error(
          "Время авторизации истекло. Пожалуйста, начните процесс заново.",
        );
      }

      // Удаляем использованный state
      await prisma.settings.delete({
        where: { key: `gmail_oauth_state_${data.state}` },
      });

      // Загружаем credentials
      const fs = await import("fs/promises");
      const path = await import("path");
      const credentialsPath = path.join(
        process.cwd(),
        "data",
        "gmail-credentials.json",
      );
      const credentialsContent = JSON.parse(
        await fs.readFile(credentialsPath, "utf-8"),
      );
      const credentials =
        credentialsContent.web ||
        credentialsContent.installed ||
        credentialsContent;

      // Обмениваем код на токены
      const { google } = await import("googleapis");
      // Используем первый redirect_uri из credentials файла, если он есть
      const redirectUri =
        credentials.redirect_uris?.[0] ||
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/panel/gmail-callback`;

      const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        redirectUri,
      );

      let tokens;
      try {
        const tokenResponse = await oauth2Client.getToken(data.code);
        tokens = tokenResponse.tokens;
      } catch (error: any) {
        // Обрабатываем специфичные ошибки OAuth
        if (error.message?.includes("invalid_grant")) {
          throw new Error(
            "Код авторизации недействителен или уже был использован. Пожалуйста, начните процесс авторизации заново.",
          );
        } else if (error.message?.includes("redirect_uri_mismatch")) {
          throw new Error(
            "Неверный redirect URI. Проверьте настройки OAuth в Google Console.",
          );
        } else {
          throw new Error(
            `Ошибка при обмене кода на токен: ${error.message || "Неизвестная ошибка"}`,
          );
        }
      }

      if (!tokens.refresh_token) {
        throw new Error(
          "Не получен refresh token. Возможно, приложение уже авторизовано. Попробуйте отозвать доступ в настройках Google и повторить авторизацию.",
        );
      }

      // Получаем информацию о пользователе
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });

      const email = profile.data.emailAddress;
      if (!email) {
        throw new Error("Could not get email address");
      }

      // Сохраняем или обновляем аккаунт в базе
      const account = await prisma.gmailAccount.upsert({
        where: { email },
        create: {
          email,
          refreshToken: tokens.refresh_token,
          isActive: true,
        },
        update: {
          refreshToken: tokens.refresh_token,
          isActive: true,
        },
      });

      handleSuccess(
        {
          id: account.id,
          email: account.email,
          isActive: account.isActive,
          returnUrl: stateInfo.returnUrl,
        },
        "Gmail account authorized successfully",
        callback,
      );

      // Emit event for real-time updates
      socket.emit("platform:accountCreated", {
        platform: "gmail",
        account: {
          id: account.id,
          email: account.email,
        },
      });
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Список Gmail аккаунтов
   */
  static async listGmailAccounts(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function,
  ) {
    try {
      const params = validatePaginationParams(data);

      const response = await paginatePrisma(prisma.gmailAccount, {
        ...params,
        where:
          data.isActive !== undefined ? { isActive: data.isActive } : undefined,
        orderBy: { createdAt: "desc" },
      });

      // Скрываем refresh token
      const sanitizedData = response.data.map((account: any) => ({
        id: account.id,
        email: account.email,
        isActive: account.isActive,
        lastSync: account.lastSync,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        hasRefreshToken: !!account.refreshToken,
      }));

      handleSuccess(
        {
          ...response,
          data: sanitizedData,
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление Gmail аккаунта
   */
  static async deleteGmailAccount(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function,
  ) {
    try {
      await prisma.gmailAccount.delete({
        where: { id: data.id },
      });

      handleSuccess(null, "Gmail аккаунт удален", callback);

      // Emit event for real-time updates
      socket.emit("platform:accountDeleted", {
        platform: "gmail",
        accountId: data.id,
      });
    } catch (error) {
      handleError(error, callback);
    }
  }
}
