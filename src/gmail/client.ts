/**
 * Клиент для работы с Gmail API
 */

import { google, gmail_v1 } from "googleapis";
import { OAuth2Manager } from "./utils/oauth2";
import {
  type OAuth2Token,
  type EmailFilter,
  type GmailMessage,
  type EmailAttachment,
  type EmailSearchResult,
  type GmailClientOptions,
  GmailApiError,
  GmailAuthError,
  GmailQuotaError,
  EmailParseError,
} from "./types/models";

/**
 * Клиент для работы с Gmail API
 */
export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private oauth2Manager: OAuth2Manager;
  private email?: string;
  private tokens?: OAuth2Token;

  /**
   * Создает новый экземпляр GmailClient
   * @param oauth2Manager - Менеджер OAuth2
   * @param options - Дополнительные опции
   */
  constructor(
    oauth2Manager: OAuth2Manager,
    options: GmailClientOptions = {},
  ) {
    this.oauth2Manager = oauth2Manager;

    // Создаем Gmail клиент
    this.gmail = google.gmail({
      version: "v1",
      auth: oauth2Manager.getOAuth2Client(),
    });
  }

  /**
   * Устанавливает токены и получает email пользователя
   * @param tokens - OAuth2 токены
   * @returns Email пользователя
   */
  async setTokens(tokens: OAuth2Token): Promise<string> {
    this.tokens = tokens;
    this.oauth2Manager.setTokens(tokens);

    // Получаем email пользователя
    try {
      const profile = await this.gmail.users.getProfile({ userId: "me" });
      this.email = profile.data.emailAddress || undefined;
      
      if (!this.email) {
        throw new GmailAuthError("Не удалось получить email пользователя");
      }

      console.log(`[GmailClient] Авторизован как ${this.email}`);
      return this.email;
    } catch (error: unknown) {
      this.handleApiError(error);
      throw error;
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
   * Получает текущие токены
   * @returns Токены или undefined
   */
  getTokens(): OAuth2Token | undefined {
    return this.tokens;
  }

  /**
   * Возвращает профиль пользователя Gmail
   */
  async getUserProfile(): Promise<gmail_v1.Schema$Profile> {
    await this.refreshTokensIfNeeded();
    try {
      const response = await this.gmail.users.getProfile({ userId: "me" });
      return response.data;
    } catch (error: unknown) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Обновляет токены если они истекли
   * @returns Обновленные токены или текущие
   */
  async refreshTokensIfNeeded(): Promise<OAuth2Token> {
    if (!this.tokens) {
      throw new GmailAuthError("Токены не установлены");
    }

    if (this.oauth2Manager.isTokenExpired(this.tokens)) {
      console.log("[GmailClient] Токен истек, обновляем...");
      this.tokens = await this.oauth2Manager.refreshTokens();
    }

    return this.tokens;
  }

  /**
   * Получает список писем с фильтрами
   * @param filter - Фильтры для поиска
   * @returns Результаты поиска
   */
  async getEmails(filter: EmailFilter = {}): Promise<EmailSearchResult> {
    await this.refreshTokensIfNeeded();

    try {
      // Строим поисковый запрос
      const query = this.buildSearchQuery(filter);

      // Выполняем поиск
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: filter.maxResults || 50,
        pageToken: filter.pageToken,
      });

      const messages: GmailMessage[] = [];

      if (response.data.messages) {
        // Получаем детали каждого письма
        for (const message of response.data.messages) {
          if (message.id) {
            const fullMessage = await this.getMessage(message.id);
            messages.push(fullMessage);
          }
        }
      }

      return {
        messages,
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    } catch (error: unknown) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Получает письма за определенный период
   * @param after - После указанной даты
   * @param before - До указанной даты (опционально)
   * @param additionalFilter - Дополнительные фильтры
   * @returns Результаты поиска
   */
  async getEmailsByDateRange(
    after: Date | string,
    before?: Date | string,
    additionalFilter: EmailFilter = {},
  ): Promise<EmailSearchResult> {
    return this.getEmails({
      ...additionalFilter,
      after,
      before,
    });
  }

  /**
   * Получает письма с PDF вложениями
   * @param filter - Дополнительные фильтры
   * @returns Результаты поиска
   */
  async getEmailsWithPdfAttachments(
    filter: EmailFilter = {},
  ): Promise<EmailSearchResult> {
    return this.getEmails({
      ...filter,
      hasAttachment: true,
      attachmentType: "pdf",
    });
  }

  /**
   * Получает письма от определенного отправителя
   * @param from - Email отправителя
   * @param filterOrLimit - Фильтры или количество писем
   * @returns Результаты поиска или массив писем
   */
  async getEmailsFromSender(
    from: string,
    filterOrLimit: EmailFilter | number = {},
  ): Promise<EmailSearchResult | GmailMessage[]> {
    // Backward compatibility: if number is passed, return array
    if (typeof filterOrLimit === 'number') {
      const result = await this.getEmails({
        from,
        maxResults: filterOrLimit,
      });
      return result.messages || [];
    }
    
    // Normal case: return EmailSearchResult
    return this.getEmails({
      ...filterOrLimit,
      from,
    });
  }

  /**
   * Получает одно письмо по ID
   * @param messageId - ID письма
   * @returns Полная информация о письме
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    await this.refreshTokensIfNeeded();

    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      return this.parseMessage(response.data);
    } catch (error: unknown) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Скачивает вложение из письма
   * @param messageId - ID письма
   * @param attachmentIdOrInfo - ID вложения или информация о вложении
   * @returns Данные вложения
   */
  async downloadAttachment(
    messageId: string,
    attachmentIdOrInfo: string | EmailAttachment,
  ): Promise<EmailAttachment> {
    await this.refreshTokensIfNeeded();

    let attachmentId: string;
    let attachmentInfo: Partial<EmailAttachment> = {};
    
    if (typeof attachmentIdOrInfo === 'string') {
      attachmentId = attachmentIdOrInfo;
    } else {
      attachmentId = attachmentIdOrInfo.id;
      attachmentInfo = attachmentIdOrInfo;
    }

    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

      if (!response.data.data) {
        throw new GmailApiError("Вложение не содержит данных");
      }

      // Return attachment data with provided info or defaults
      return {
        id: attachmentId,
        filename: attachmentInfo.filename || "attachment",
        mimeType: attachmentInfo.mimeType || "application/octet-stream",
        size: attachmentInfo.size || response.data.size || 0,
        data: response.data.data,
      };
    } catch (error: unknown) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Скачивает все PDF вложения из письма
   * @param messageId - ID письма
   * @returns Массив PDF вложений
   */
  async downloadPdfAttachments(
    messageId: string,
  ): Promise<EmailAttachment[]> {
    const message = await this.getMessage(messageId);
    const pdfAttachments: EmailAttachment[] = [];

    if (message.attachments) {
      for (const attachment of message.attachments) {
        if (
          attachment.mimeType === "application/pdf" ||
          attachment.filename.toLowerCase().endsWith(".pdf")
        ) {
          const fullAttachment = await this.downloadAttachment(
            messageId,
            attachment.id,
          );
          pdfAttachments.push(fullAttachment);
        }
      }
    }

    return pdfAttachments;
  }

  /**
   * Помечает письмо как прочитанное
   * @param messageId - ID письма
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.refreshTokensIfNeeded();

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  /**
   * Помечает письмо как непрочитанное
   * @param messageId - ID письма
   */
  async markAsUnread(messageId: string): Promise<void> {
    await this.refreshTokensIfNeeded();

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["UNREAD"],
        },
      });
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  /**
   * Добавляет звезду к письму
   * @param messageId - ID письма
   */
  async addStar(messageId: string): Promise<void> {
    await this.refreshTokensIfNeeded();

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["STARRED"],
        },
      });
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  /**
   * Удаляет звезду с письма
   * @param messageId - ID письма
   */
  async removeStar(messageId: string): Promise<void> {
    await this.refreshTokensIfNeeded();

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["STARRED"],
        },
      });
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  /**
   * Строит поисковый запрос из фильтров
   */
  private buildSearchQuery(filter: EmailFilter): string {
    const parts: string[] = [];

    if (filter.from) {
      parts.push(`from:${filter.from}`);
    }

    if (filter.to) {
      parts.push(`to:${filter.to}`);
    }

    if (filter.subject) {
      parts.push(`subject:"${filter.subject}"`);
    }

    if (filter.after) {
      const afterDate = filter.after instanceof Date
        ? filter.after.toISOString().split('T')[0]
        : filter.after;
      parts.push(`after:${afterDate}`);
    }

    if (filter.before) {
      const beforeDate = filter.before instanceof Date
        ? filter.before.toISOString().split('T')[0]
        : filter.before;
      parts.push(`before:${beforeDate}`);
    }

    if (filter.hasAttachment) {
      parts.push("has:attachment");
    }

    if (filter.attachmentType === "pdf") {
      parts.push("filename:pdf");
    }

    if (filter.isUnread) {
      parts.push("is:unread");
    }

    if (filter.isImportant) {
      parts.push("is:important");
    }

    if (filter.isStarred) {
      parts.push("is:starred");
    }

    if (filter.query) {
      parts.push(filter.query);
    }

    return parts.join(" ");
  }

  /**
   * Парсит сообщение Gmail в наш формат
   */
  private parseMessage(data: gmail_v1.Schema$Message): GmailMessage {
    const headers = data.payload?.headers || [];
    const labelIds = data.labelIds || [];

    // Извлекаем заголовки
    const getHeader = (name: string): string | undefined => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase(),
      );
      return header?.value || undefined;
    };

    // Извлекаем текст и вложения
    const { textPlain, textHtml, attachments } = this.extractContent(
      data.payload,
    );

    // Парсим дату
    const dateStr = getHeader("Date");
    const date = dateStr ? new Date(dateStr) : undefined;

    return {
      id: data.id!,
      threadId: data.threadId!,
      labelIds,
      snippet: data.snippet || "",
      historyId: data.historyId || "",
      internalDate: data.internalDate || "",
      
      // Заголовки
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      date,
      messageId: getHeader("Message-ID"),
      
      // Содержимое
      textPlain,
      textHtml,
      attachments,
      
      // Флаги
      isUnread: labelIds.includes("UNREAD"),
      isImportant: labelIds.includes("IMPORTANT"),
      isStarred: labelIds.includes("STARRED"),
      
      // Сырые данные
      raw: data,
    };
  }

  /**
   * Извлекает содержимое из payload
   */
  private extractContent(
    payload?: gmail_v1.Schema$MessagePart,
  ): {
    textPlain?: string;
    textHtml?: string;
    attachments: EmailAttachment[];
  } {
    let textPlain: string | undefined;
    let textHtml: string | undefined;
    const attachments: EmailAttachment[] = [];

    if (!payload) {
      return { textPlain, textHtml, attachments };
    }

    // Рекурсивно обходим части сообщения
    const processPart = (part: gmail_v1.Schema$MessagePart) => {
      const mimeType = part.mimeType || "";
      const filename = part.filename || "";

      // Если это вложение
      if (filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename,
          mimeType,
          size: part.body.size || 0,
        });
        return;
      }

      // Если это текст
      if (part.body?.data) {
        const text = Buffer.from(part.body.data, "base64").toString("utf-8");

        if (mimeType === "text/plain") {
          textPlain = text;
        } else if (mimeType === "text/html") {
          textHtml = text;
        }
      }

      // Рекурсивно обрабатываем вложенные части
      if (part.parts) {
        for (const subPart of part.parts) {
          processPart(subPart);
        }
      }
    };

    processPart(payload);

    return { textPlain, textHtml, attachments };
  }

  /**
   * Обрабатывает ошибки API
   */
  private handleApiError(error: unknown): void {
    if (error instanceof Error && 'code' in error) {
      const apiError = error as any;
      const code = apiError.code;
      const message = apiError.message || error.message;

      switch (code) {
        case 401:
          throw new GmailAuthError(message);
        case 429:
          throw new GmailQuotaError(message);
        case 400:
        case 404:
        case 500:
          throw new GmailApiError(message, code.toString(), code);
        default:
          throw new GmailApiError(message);
      }
    }

    throw error;
  }
}