/**
 * Типизированный парсер чеков Тинькофф
 */

import { extractTextFromPdfBuffer } from "./utils/textExtractor";
import * as fs from "fs/promises";

// Типы переводов
export enum TransferType {
  BY_PHONE = "BY_PHONE", // По номеру телефона
  TO_TBANK = "TO_TBANK", // Клиенту Т-Банка
  TO_CARD = "TO_CARD" // На карту
}

// Базовый интерфейс чека
export interface BaseReceipt {
  // Общие поля для всех типов чеков
  datetime: Date; // Дата и время из чека
  amount: number; // Сумма (не Итого!)
  status: "SUCCESS"; // Только успешные чеки
  sender: string; // Отправитель
  transferType: TransferType;
  commission?: number; // Комиссия (есть у некоторых типов)
}

// Чек с переводом по номеру телефона
export interface PhoneTransferReceipt extends BaseReceipt {
  transferType: TransferType.BY_PHONE;
  recipientPhone: string; // Телефон получателя
  recipientName?: string; // Имя получателя (необязательное)
  recipientBank?: string; // Банк получателя (необязательный)
}

// Чек с переводом клиенту Т-Банка
export interface TBankTransferReceipt extends BaseReceipt {
  transferType: TransferType.TO_TBANK;
  recipientName: string; // Имя получателя (вместо отправителя)
  recipientCard: string; // Последние 4 цифры карты (*4207)
}

// Чек с переводом на карту
export interface CardTransferReceipt extends BaseReceipt {
  transferType: TransferType.TO_CARD;
  recipientCard: string; // Маскированный номер карты (220024******2091)
  commission?: number; // Комиссия (может отсутствовать)
}

// Объединенный тип для всех видов чеков
export type ParsedReceipt = PhoneTransferReceipt | TBankTransferReceipt | CardTransferReceipt;

// Ошибка парсинга чека
export class ReceiptParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptParseError";
  }
}

export class TinkoffReceiptParser {
  public lastExtractedText: string | null = null;

  /**
   * Парсит чек из PDF файла
   */
  async parseFromFile(filePath: string): Promise<ParsedReceipt> {
    const pdfBuffer = await fs.readFile(filePath);
    return this.parseFromBuffer(pdfBuffer);
  }

  /**
   * Парсит чек из буфера PDF
   */
  async parseFromBuffer(pdfBuffer: Buffer): Promise<ParsedReceipt> {
    const text = await extractTextFromPdfBuffer(pdfBuffer);
    this.lastExtractedText = text;
    return this.parseReceiptText(text);
  }

  /**
   * Парсит текст чека
   */
  private parseReceiptText(text: string): ParsedReceipt {
    // Проверяем статус - обязательно должно быть "Успешно"
    if (!text.includes("Успешно")) {
      throw new ReceiptParseError("Чек бракованный: не найден статус 'Успешно'");
    }

    // Извлекаем дату и время
    const datetime = this.extractDateTime(text);
    if (!datetime) {
      throw new ReceiptParseError("Не удалось извлечь дату и время из чека");
    }

    // Извлекаем сумму (не Итого!)
    const amount = this.extractAmount(text);
    if (!amount) {
      throw new ReceiptParseError("Не удалось извлечь сумму из чека");
    }

    // Извлекаем отправителя
    const sender = this.extractSender(text);
    if (!sender) {
      throw new ReceiptParseError("Не удалось извлечь отправителя из чека");
    }

    // Определяем тип перевода
    const transferType = this.detectTransferType(text);

    // Парсим в зависимости от типа
    switch (transferType) {
      case TransferType.BY_PHONE:
        return this.parsePhoneTransfer(text, datetime, amount, sender);
      case TransferType.TO_TBANK:
        return this.parseTBankTransfer(text, datetime, amount, sender);
      case TransferType.TO_CARD:
        return this.parseCardTransfer(text, datetime, amount, sender);
    }
  }

  private extractDateTime(text: string): Date | null {
    // Пробуем несколько форматов даты
    const patterns = [
      // Формат "09.06.2025 17:10:18"
      /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/,
      // Формат "09.06.2025 17:10"
      /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/,
      // Формат с разделителями "09 . 06 . 2025 17 : 10 : 18"
      /(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{4})\s+(\d{2})\s*:\s*(\d{2})\s*:\s*(\d{2})/,
      // Формат с разделителями без секунд
      /(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{4})\s+(\d{2})\s*:\s*(\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const [_, day, month, year, hours, minutes, seconds] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1, // Месяцы в JS начинаются с 0
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          seconds ? parseInt(seconds) : 0
        );
      }
    }

    // Если не нашли, пробуем найти хотя бы дату без времени
    const dateOnlyMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateOnlyMatch) {
      const [_, day, month, year] = dateOnlyMatch;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        12, 0, 0 // Полдень по умолчанию
      );
    }

    return null;
  }

  private extractAmount(text: string): number | null {
    // Ищем сумму - число перед словом "Сумма" с знаком рубля
    // Формат: "16 000 iСумма" или "2 880 i Сумма"
    const match = text.match(/(\d+(?:\s+\d+)*)\s*[₽i]\s*Сумма/);
    if (!match) return null;

    // Убираем пробелы из числа
    const amountStr = match[1].replace(/\s+/g, "");
    return parseInt(amountStr);
  }

  private extractSender(text: string): string | null {
    // Специальная обработка для T-Bank переводов
    // где "Отправитель" идет сразу после суммы
    const tbankPattern = /\d+\s*i\s*Сумма\s*Отправитель([А-Я][а-я]+(?:\s+[А-Я][а-я]+)*)(?=\s*(?:Карта|$))/;
    const tbankMatch = text.match(tbankPattern);
    if (tbankMatch) {
      return tbankMatch[1].trim();
    }

    // Ищем строку перед словом "Отправитель"
    // Паттерн: имя (может быть на отдельной строке) + "Отправитель"
    const patterns = [
      // Имя слиплось с "Отправитель" (например "Максим МасёровОтправитель")
      // Поддерживаем буквы ё и й, но только начинаем с заглавной
      /([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)Отправитель/,
      // Имя на той же строке что и "Отправитель" с пробелом
      /([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)*)\s+Отправитель/,
      // Имя на строке перед "Отправитель"
      /([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)*)\s*\n\s*Отправитель/,
      // Для случаев когда между именем и "Отправитель" есть другой текст
      /(?:Без комиссии|Комиссия.*?)\s*([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)*)\s*Отправитель/,
      // Альтернативный паттерн где имя идет после числа
      /\d+\s*i\s*(?:Сумма)?\s*(?:КомиссияБез комиссии|Комиссия|Без комиссии)\s*([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)*)\s*Отправитель/,
      // Паттерн для "ОтправительИмя" (слова в обратном порядке)
      /Отправитель([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)*)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].trim();
        // Проверяем что это реальное имя, а не служебное слово
        if (!name.match(/^(?:Телефон|Карта|Счет|Банк|Получатель|Отправитель|Сумма)$/) && name.length > 2) {
          return name;
        }
      }
    }

    return null;
  }

  private detectTransferType(text: string): TransferType {
    if (text.includes("По номеру телефона")) {
      return TransferType.BY_PHONE;
    } else if (text.includes("Клиенту Т-Банка")) {
      return TransferType.TO_TBANK;
    } else if (text.includes("На карту")) {
      return TransferType.TO_CARD;
    }
    
    throw new ReceiptParseError("Не удалось определить тип перевода");
  }

  private parsePhoneTransfer(
    text: string,
    datetime: Date,
    amount: number,
    sender: string
  ): PhoneTransferReceipt {
    // Извлекаем телефон получателя (с учетом разных форматов)
    const phoneMatch = text.match(/Телефон получателя[\s\n]*(\+7\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2})/);
    if (!phoneMatch) {
      throw new ReceiptParseError("Не найден телефон получателя");
    }

    // Извлекаем имя получателя (идет после "Получатель") - включая инициалы
    const recipientMatch = text.match(/Получатель[\s\n]*([А-Я][а-я]+(?:\s+[А-Я]\.?)+?)(?=\s*(?:Служба|Банк|$))/);
    
    // Извлекаем банк получателя (может быть на следующей строке)
    const bankMatch = text.match(/Банк получателя[\s\n]*([^\n]+?)(?=\s*Счет|\s*Идентификатор|\s*$)/);

    // Проверяем комиссию
    const commission = this.extractCommission(text);

    const result: PhoneTransferReceipt = {
      datetime,
      amount,
      status: "SUCCESS",
      sender,
      transferType: TransferType.BY_PHONE,
      recipientPhone: phoneMatch[1].trim()
    };

    // Добавляем имя получателя если найдено
    if (recipientMatch) {
      result.recipientName = recipientMatch[1].trim();
    }

    if (bankMatch) {
      result.recipientBank = bankMatch[1].trim();
    }

    if (commission !== null && commission !== 0) {
      result.commission = commission;
    }

    return result;
  }

  private parseTBankTransfer(
    text: string,
    datetime: Date,
    amount: number,
    sender: string
  ): TBankTransferReceipt {
    // Извлекаем имя получателя
    const recipientMatch = text.match(/Получатель[\s\n]*([^\n]+?)(?=\s*(?:Квитанция|Служба|$))/);
    if (!recipientMatch) {
      throw new ReceiptParseError("Не найден получатель");
    }

    // Извлекаем последние 4 цифры карты
    const cardMatch = text.match(/Карта получателя[\s\n]*\*(\d{4})/);
    if (!cardMatch) {
      throw new ReceiptParseError("Не найдена карта получателя");
    }

    return {
      datetime,
      amount,
      status: "SUCCESS",
      sender,
      transferType: TransferType.TO_TBANK,
      recipientName: recipientMatch[1].trim(),
      recipientCard: `*${cardMatch[1]}`
    };
  }

  private parseCardTransfer(
    text: string,
    datetime: Date,
    amount: number,
    sender: string
  ): CardTransferReceipt {
    // Извлекаем маскированный номер карты
    const cardMatch = text.match(/Карта получателя[\s\n]*(\d{6}\*{6}\d{4})/);
    if (!cardMatch) {
      throw new ReceiptParseError("Не найдена карта получателя");
    }

    // Извлекаем комиссию (может быть 0 или отсутствовать)
    const commission = this.extractCommission(text);

    const result: CardTransferReceipt = {
      datetime,
      amount,
      status: "SUCCESS",
      sender,
      transferType: TransferType.TO_CARD,
      recipientCard: cardMatch[1]
    };

    // Добавляем комиссию только если она есть
    if (commission !== null && commission !== 0) {
      result.commission = commission;
    }

    return result;
  }

  private extractCommission(text: string): number | null {
    // Ищем комиссию (может быть на следующей строке)
    const match = text.match(/Комиссия[\s\n]*(\d+(?:\s+\d+)*)/);
    if (!match) {
      // Проверяем "Без комиссии"
      if (text.includes("Без комиссии")) {
        return 0;
      }
      return null;
    }

    // Убираем пробелы из числа
    const commissionStr = match[1].replace(/\s+/g, "");
    return parseInt(commissionStr);
  }
}