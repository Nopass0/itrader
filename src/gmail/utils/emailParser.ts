/**
 * Утилиты для парсинга писем и извлечения информации
 */

import { Decimal } from "decimal.js";
import {
  type GmailMessage,
  type EmailReceiptInfo,
  type EmailAttachment,
  EmailParseError,
} from "../types/models";

/**
 * Класс для парсинга писем и извлечения информации о платежах
 */
export class EmailParser {
  // Паттерны для извлечения суммы из письма
  private amountPatterns = [
    // Русские варианты
    /(?:сумма|итого|к оплате|оплачено|перевод на сумму)[:\s]*([0-9\s]+[,.]?[0-9]*)\s*(?:руб|рублей|₽)?/i,
    /([0-9]{1,3}(?:\s?[0-9]{3})*(?:[,.][0-9]{2})?)\s*(?:руб|рублей|₽)/,
    /₽\s*([0-9\s,.]+)/,
    
    // Английские варианты
    /(?:amount|total|payment|sum)[:\s]*\$?([0-9,]+\.?[0-9]*)/i,
    /\$\s*([0-9,]+\.?[0-9]*)/,
    
    // Универсальные
    /(?:RUB|USD|EUR)\s*([0-9,]+\.?[0-9]*)/i,
  ];

  // Паттерны для извлечения ID транзакции
  private transactionIdPatterns = [
    /(?:номер операции|операция|transaction|order|payment)[\s#:]*([A-Za-z0-9\-_]+)/i,
    /(?:ID|№|#)[\s:]*([A-Za-z0-9\-_]+)/i,
    /(?:код подтверждения|confirmation code)[\s:]*([A-Za-z0-9\-_]+)/i,
  ];

  // Известные отправители платежных систем
  private paymentSenders = [
    // Российские банки
    { pattern: /sberbank|сбербанк/i, name: "Сбербанк" },
    { pattern: /tinkoff|тинькофф|t-bank|т-банк/i, name: "T-Банк (Тинькофф)" },
    { pattern: /alfa-?bank|альфа-?банк/i, name: "Альфа-Банк" },
    { pattern: /vtb|втб/i, name: "ВТБ" },
    { pattern: /raiff|райфф/i, name: "Райффайзенбанк" },
    
    // Платежные системы
    { pattern: /qiwi|киви/i, name: "QIWI" },
    { pattern: /yoomoney|юmoney|яндекс\.деньги/i, name: "ЮMoney" },
    { pattern: /paypal/i, name: "PayPal" },
    
    // Криптобиржи
    { pattern: /binance/i, name: "Binance" },
    { pattern: /bybit/i, name: "Bybit" },
    { pattern: /okx|okex/i, name: "OKX" },
    { pattern: /gate\.io/i, name: "Gate.io" },
  ];

  /**
   * Парсит письмо и извлекает информацию о платеже
   * @param message - Письмо Gmail
   * @returns Информация о чеке
   */
  parseReceipt(message: GmailMessage): EmailReceiptInfo {
    const text = this.getMessageText(message);
    
    const amount = this.extractAmount(text);
    const transactionId = this.extractTransactionId(text);
    const sender = this.identifySender(message);
    const pdfAttachment = this.findPdfAttachment(message);

    return {
      email: message,
      pdfAttachment,
      amount,
      date: message.date,
      sender,
      transactionId,
    };
  }

  /**
   * Проверяет, является ли письмо платежным уведомлением
   * @param message - Письмо Gmail
   * @returns true если письмо похоже на платежное уведомление
   */
  isPaymentEmail(message: GmailMessage): boolean {
    const text = this.getMessageText(message).toLowerCase();
    const subject = (message.subject || "").toLowerCase();
    const from = (message.from || "").toLowerCase();

    // Проверяем отправителя
    if (this.paymentSenders.some(s => s.pattern.test(from))) {
      return true;
    }

    // Проверяем ключевые слова в теме
    const subjectKeywords = [
      "платеж", "payment", "оплата", "перевод", "transfer",
      "транзакция", "transaction", "чек", "receipt", "квитанция",
      "подтверждение", "confirmation",
    ];

    if (subjectKeywords.some(keyword => subject.includes(keyword))) {
      return true;
    }

    // Проверяем ключевые слова в тексте
    const textKeywords = [
      "оплачено", "paid", "сумма", "amount", "итого", "total",
      "перевод выполнен", "transfer completed", "операция выполнена",
      "transaction completed",
    ];

    return textKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Извлекает все платежные письма из списка
   * @param messages - Массив писем
   * @returns Массив платежных писем с информацией
   */
  extractPaymentEmails(messages: GmailMessage[]): EmailReceiptInfo[] {
    const paymentEmails: EmailReceiptInfo[] = [];

    for (const message of messages) {
      if (this.isPaymentEmail(message)) {
        try {
          const receiptInfo = this.parseReceipt(message);
          paymentEmails.push(receiptInfo);
        } catch (error: unknown) {
          console.warn(
            `[EmailParser] Не удалось распарсить платежное письмо ${message.id}:`,
            error,
          );
        }
      }
    }

    return paymentEmails;
  }

  /**
   * Получает текст письма
   */
  private getMessageText(message: GmailMessage): string {
    // Приоритет: plain text > html (без тегов) > snippet
    if (message.textPlain) {
      return message.textPlain;
    }

    if (message.textHtml) {
      // Удаляем HTML теги
      return message.textHtml
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    }

    return message.snippet || "";
  }

  /**
   * Извлекает сумму из текста
   */
  private extractAmount(text: string): Decimal | undefined {
    for (const pattern of this.amountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amountStr = match[1]
          .replace(/\s/g, "")
          .replace(",", ".");

        try {
          const amount = new Decimal(amountStr);
          // Проверяем, что сумма разумная (от 0.01 до 10 млн)
          if (amount.gte(0.01) && amount.lte(10000000)) {
            return amount;
          }
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  /**
   * Извлекает ID транзакции
   */
  private extractTransactionId(text: string): string | undefined {
    for (const pattern of this.transactionIdPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const id = match[1].trim();
        // Проверяем, что ID выглядит разумно
        if (id.length >= 4 && id.length <= 100) {
          return id;
        }
      }
    }

    return undefined;
  }

  /**
   * Определяет отправителя платежа
   */
  private identifySender(message: GmailMessage): string | undefined {
    const from = message.from || "";

    for (const sender of this.paymentSenders) {
      if (sender.pattern.test(from)) {
        return sender.name;
      }
    }

    // Извлекаем домен из email
    const domainMatch = from.match(/@([^>\s]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      
      // Проверяем домен
      for (const sender of this.paymentSenders) {
        if (sender.pattern.test(domain)) {
          return sender.name;
        }
      }

      // Возвращаем домен как отправителя
      return domain;
    }

    return undefined;
  }

  /**
   * Находит PDF вложение в письме
   */
  private findPdfAttachment(
    message: GmailMessage,
  ): EmailAttachment | undefined {
    if (!message.attachments || message.attachments.length === 0) {
      return undefined;
    }

    // Ищем первый PDF файл
    return message.attachments.find(
      (att) =>
        att.mimeType === "application/pdf" ||
        att.filename.toLowerCase().endsWith(".pdf"),
    );
  }

  /**
   * Проверяет, содержит ли письмо чек
   * @param message - Письмо Gmail
   * @returns true если письмо содержит чек (PDF или в тексте)
   */
  hasReceipt(message: GmailMessage): boolean {
    // Проверяем наличие PDF
    if (this.findPdfAttachment(message)) {
      return true;
    }

    // Проверяем ключевые слова в тексте
    const text = this.getMessageText(message).toLowerCase();
    const receiptKeywords = [
      "чек", "receipt", "квитанция", "invoice",
      "детали платежа", "payment details",
      "подтверждение оплаты", "payment confirmation",
    ];

    return receiptKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Группирует письма по отправителям
   * @param messages - Массив писем
   * @returns Map с группировкой по отправителям
   */
  groupBySender(
    messages: GmailMessage[],
  ): Map<string, GmailMessage[]> {
    const groups = new Map<string, GmailMessage[]>();

    for (const message of messages) {
      const sender = this.identifySender(message) || "Unknown";
      
      if (!groups.has(sender)) {
        groups.set(sender, []);
      }

      groups.get(sender)!.push(message);
    }

    return groups;
  }
}