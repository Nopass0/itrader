/**
 * Менеджер для управления несколькими Gmail аккаунтами
 */

import fs from "fs/promises";
import path from "path";
import { GmailClient } from "./client";
import { OAuth2Manager } from "./utils/oauth2";
import {
  saveTokensToFile,
  loadTokensFromFile,
  hasRequiredScopes,
} from "./utils/oauth2";
import {
  type GmailAccount,
  type OAuth2Token,
  type EmailFilter,
  type EmailSearchResult,
  type GmailMessage,
  type EmailAttachment,
  type CredentialsFile,
  type GmailManagerOptions,
  GmailError,
  GmailAuthError,
} from "./types/models";

/**
 * Менеджер для работы с несколькими Gmail аккаунтами
 */
export class GmailManager {
  private accounts: Map<string, GmailAccount> = new Map();
  private clients: Map<string, GmailClient> = new Map();
  private oauth2Manager: OAuth2Manager;
  private tokensDir: string;
  private autoSaveTokens: boolean;
  private scopes: string[];

  /**
   * Создает новый экземпляр GmailManager
   * @param options - Опции для настройки менеджера
   */
  constructor(options: GmailManagerOptions) {
    this.tokensDir = options.tokensDir || "./data/gmail-tokens";
    this.autoSaveTokens = options.autoSaveTokens !== false;
    this.scopes = options.clientOptions?.scopes || [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ];

    // Инициализируем OAuth2Manager
    if (!options.credentials) {
      throw new GmailError(
        "Необходимо указать credentials в опциях",
      );
    }

    if (typeof options.credentials === "string") {
      // Если передан путь к файлу, читаем его синхронно
      throw new GmailError(
        "Используйте GmailManager.fromCredentialsFile для загрузки из файла",
      );
    }

    this.oauth2Manager = OAuth2Manager.fromCredentialsJson(
      options.credentials,
      this.scopes,
    );
  }

  /**
   * Создает GmailManager из файла credentials
   * @param credentialsPath - Путь к файлу credentials.json
   * @param options - Дополнительные опции
   * @returns GmailManager
   */
  static async fromCredentialsFile(
    credentialsPath: string,
    options: Omit<GmailManagerOptions, "credentials"> = {},
  ): Promise<GmailManager> {
    const content = await fs.readFile(credentialsPath, "utf-8");
    const credentials = JSON.parse(content) as CredentialsFile;

    return new GmailManager({
      ...options,
      credentials,
    });
  }

  /**
   * Инициализирует менеджер
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.tokensDir, { recursive: true });
    console.log(
      `[GmailManager] Инициализирован. Токены сохраняются в: ${this.tokensDir}`,
    );
  }

  /**
   * Добавляет новый аккаунт интерактивно
   * @returns Email добавленного аккаунта
   */
  async addAccountInteractive(): Promise<string> {
    // Авторизуем пользователя
    const tokens = await this.oauth2Manager.authorizeInteractive();

    // Создаем клиент и устанавливаем токены
    const client = new GmailClient(this.oauth2Manager, {
      scopes: this.scopes,
    });
    const email = await client.setTokens(tokens);

    // Сохраняем аккаунт
    const account: GmailAccount = {
      email,
      tokens,
      lastUsed: new Date(),
      isActive: true,
    };

    this.accounts.set(email, account);
    this.clients.set(email, client);

    // Сохраняем токены
    if (this.autoSaveTokens) {
      await this.saveTokensForAccount(email);
    }

    console.log(`[GmailManager] Аккаунт ${email} успешно добавлен`);
    return email;
  }

  /**
   * Добавляет аккаунт с существующими токенами
   * @param tokens - OAuth2 токены
   * @returns Email добавленного аккаунта
   */
  async addAccountWithTokens(tokens: OAuth2Token): Promise<string> {
    // Проверяем scopes только если есть access_token
    // Для refresh token scopes будут получены при обновлении токена
    if (tokens.access_token && !hasRequiredScopes(tokens, this.scopes)) {
      throw new GmailAuthError(
        "Токены не содержат необходимых прав доступа",
      );
    }

    // Создаем клиент и устанавливаем токены
    const client = new GmailClient(this.oauth2Manager, {
      scopes: this.scopes,
    });
    const email = await client.setTokens(tokens);

    // Сохраняем аккаунт
    const account: GmailAccount = {
      email,
      tokens,
      lastUsed: new Date(),
      isActive: true,
    };

    this.accounts.set(email, account);
    this.clients.set(email, client);

    // Сохраняем токены
    if (this.autoSaveTokens) {
      await this.saveTokensForAccount(email);
    }

    console.log(`[GmailManager] Аккаунт ${email} добавлен с существующими токенами`);
    return email;
  }

  /**
   * Загружает аккаунт из сохраненных токенов
   * @param email - Email аккаунта
   * @returns true если аккаунт загружен
   */
  async loadAccount(email: string): Promise<boolean> {
    const tokensPath = this.getTokensPath(email);
    const tokens = await loadTokensFromFile(tokensPath);

    if (!tokens) {
      return false;
    }

    try {
      await this.addAccountWithTokens(tokens);
      console.log(`[GmailManager] Аккаунт ${email} загружен из сохраненных токенов`);
      return true;
    } catch (error: unknown) {
      console.error(`[GmailManager] Ошибка загрузки аккаунта ${email}:`, error);
      return false;
    }
  }

  /**
   * Загружает все сохраненные аккаунты
   * @returns Количество загруженных аккаунтов
   */
  async loadAllAccounts(): Promise<number> {
    try {
      const files = await fs.readdir(this.tokensDir);
      let loaded = 0;

      for (const file of files) {
        if (file.endsWith(".json")) {
          const email = file.replace(".json", "").replace(/_/g, ".");
          if (await this.loadAccount(email)) {
            loaded++;
          }
        }
      }

      console.log(`[GmailManager] Загружено ${loaded} аккаунтов`);
      return loaded;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Получает клиент для аккаунта
   * @param email - Email аккаунта
   * @returns GmailClient
   */
  getClient(email: string): GmailClient {
    const client = this.clients.get(email);
    if (!client) {
      throw new GmailError(`Аккаунт ${email} не найден`);
    }

    // Обновляем время последнего использования
    const account = this.accounts.get(email);
    if (account) {
      account.lastUsed = new Date();
    }

    return client;
  }

  /**
   * Получает письма для аккаунта
   * @param email - Email аккаунта
   * @param filter - Фильтры
   * @returns Результаты поиска
   */
  async getEmails(
    email: string,
    filter: EmailFilter = {},
  ): Promise<EmailSearchResult> {
    const client = this.getClient(email);
    
    try {
      const result = await client.getEmails(filter);
      
      // Сохраняем обновленные токены
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
      
      return result;
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Получает письма за период
   * @param email - Email аккаунта
   * @param after - После указанной даты
   * @param before - До указанной даты (опционально)
   * @param additionalFilter - Дополнительные фильтры
   * @returns Результаты поиска
   */
  async getEmailsByDateRange(
    email: string,
    after: Date | string,
    before?: Date | string,
    additionalFilter: EmailFilter = {},
  ): Promise<EmailSearchResult> {
    const client = this.getClient(email);
    
    try {
      const result = await client.getEmailsByDateRange(after, before, additionalFilter);
      
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
      
      return result;
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Получает письма с PDF вложениями
   * @param email - Email аккаунта
   * @param filter - Дополнительные фильтры
   * @returns Результаты поиска
   */
  async getEmailsWithPdfAttachments(
    email: string,
    filter: EmailFilter = {},
  ): Promise<EmailSearchResult> {
    const client = this.getClient(email);
    
    try {
      const result = await client.getEmailsWithPdfAttachments(filter);
      
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
      
      return result;
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Получает письма от отправителя
   * @param email - Email аккаунта
   * @param from - Email отправителя
   * @param filter - Дополнительные фильтры
   * @returns Результаты поиска
   */
  async getEmailsFromSender(
    email: string,
    from: string,
    filter: EmailFilter = {},
  ): Promise<EmailSearchResult> {
    const client = this.getClient(email);
    
    try {
      const result = await client.getEmailsFromSender(from, filter);
      
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
      
      return result;
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Скачивает вложение
   * @param email - Email аккаунта
   * @param messageId - ID письма
   * @param attachmentId - ID вложения
   * @returns Данные вложения
   */
  async downloadAttachment(
    email: string,
    messageId: string,
    attachmentId: string,
  ): Promise<EmailAttachment> {
    const client = this.getClient(email);
    
    try {
      const attachment = await client.downloadAttachment(messageId, attachmentId);
      
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
      
      return attachment;
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Скачивает все PDF вложения из письма
   * @param email - Email аккаунта
   * @param messageId - ID письма
   * @returns Массив PDF вложений
   */
  async downloadPdfAttachments(
    email: string,
    messageId: string,
  ): Promise<EmailAttachment[]> {
    const client = this.getClient(email);
    
    try {
      const attachments = await client.downloadPdfAttachments(messageId);
      
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
      
      return attachments;
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Скачивает PDF вложение в файл
   * @param email - Email аккаунта
   * @param messageId - ID письма
   * @param attachmentId - ID вложения
   * @param filePath - Путь для сохранения файла
   */
  async downloadPdfToFile(
    email: string,
    messageId: string,
    attachmentId: string,
    filePath: string,
  ): Promise<void> {
    const attachment = await this.downloadAttachment(email, messageId, attachmentId);
    
    if (!attachment.data) {
      throw new GmailError("Вложение не содержит данных");
    }
    
    // Декодируем base64 и сохраняем
    const buffer = Buffer.from(attachment.data, "base64");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    
    console.log(`[GmailManager] PDF сохранен: ${filePath} (${attachment.size} байт)`);
  }

  /**
   * Помечает письмо как прочитанное
   * @param email - Email аккаунта
   * @param messageId - ID письма
   */
  async markAsRead(email: string, messageId: string): Promise<void> {
    const client = this.getClient(email);
    
    try {
      await client.markAsRead(messageId);
      
      if (this.autoSaveTokens) {
        await this.saveTokensForAccount(email);
      }
    } catch (error: unknown) {
      await this.handleAuthError(email, error);
      throw error;
    }
  }

  /**
   * Получает список всех аккаунтов
   * @returns Массив с информацией об аккаунтах
   */
  getAccounts(): Array<{
    email: string;
    isActive: boolean;
    lastUsed?: Date;
    hasTokens: boolean;
  }> {
    return Array.from(this.accounts.entries()).map(([email, account]) => ({
      email,
      isActive: account.isActive,
      lastUsed: account.lastUsed,
      hasTokens: !!account.tokens,
    }));
  }

  /**
   * Удаляет аккаунт
   * @param email - Email аккаунта
   * @param deleteTokens - Удалить сохраненные токены
   */
  async removeAccount(
    email: string,
    deleteTokens: boolean = false,
  ): Promise<void> {
    this.accounts.delete(email);
    this.clients.delete(email);

    if (deleteTokens) {
      try {
        const tokensPath = this.getTokensPath(email);
        await fs.unlink(tokensPath);
        console.log(`[GmailManager] Удалены токены для ${email}`);
      } catch (error: unknown) {
        // Игнорируем ошибки удаления
      }
    }

    console.log(`[GmailManager] Аккаунт ${email} удален`);
  }

  /**
   * Сохраняет токены для аккаунта
   * @param email - Email аккаунта
   */
  private async saveTokensForAccount(email: string): Promise<void> {
    const account = this.accounts.get(email);
    const client = this.clients.get(email);

    if (!account || !client) {
      return;
    }

    const tokens = client.getTokens();
    if (tokens) {
      account.tokens = tokens;
      const tokensPath = this.getTokensPath(email);
      await saveTokensToFile(tokens, tokensPath);
    }
  }

  /**
   * Обрабатывает ошибки авторизации
   * @param email - Email аккаунта
   * @param error - Ошибка
   */
  private async handleAuthError(
    email: string,
    error: unknown,
  ): Promise<void> {
    if (error instanceof GmailAuthError) {
      const account = this.accounts.get(email);
      if (account) {
        account.isActive = false;
        console.error(
          `[GmailManager] Ошибка авторизации для ${email}. Необходима повторная авторизация.`,
        );
      }
    }
  }

  /**
   * Получает путь к файлу токенов
   * @param email - Email аккаунта
   * @returns Путь к файлу
   */
  private getTokensPath(email: string): string {
    // Заменяем специальные символы в email для имени файла
    const safeEmail = email.replace(/[^a-zA-Z0-9.-]/g, "_");
    return path.join(this.tokensDir, `${safeEmail}.json`);
  }

  /**
   * Получает URL для авторизации
   * @param state - Дополнительный state параметр
   * @returns URL для авторизации
   */
  getAuthUrl(state?: string): string {
    return this.oauth2Manager.getAuthUrl(state);
  }

  /**
   * Добавляет аккаунт по коду авторизации
   * @param code - Код авторизации из OAuth flow
   * @returns Email добавленного аккаунта
   */
  async addAccountWithAuthCode(code: string): Promise<string> {
    const tokens = await this.oauth2Manager.getTokenFromCode(code);
    return this.addAccountWithTokens(tokens);
  }
}