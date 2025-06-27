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
  total?: number; // Итого
  status: "SUCCESS" | "Успешно"; // Только успешные чеки
  sender: string; // Отправитель
  senderAccount?: string; // Счет списания
  transferType: TransferType;
  commission?: number; // Комиссия (есть у некоторых типов)
  operationId?: string; // Идентификатор операции
  sbpCode?: string; // СБП код
  receiptNumber?: string; // Номер квитанции
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
   * Парсит чек из PDF файла (для обратной совместимости)
   * Возвращает упрощенный формат для старого кода
   */
  async parseReceiptPDF(filePath: string): Promise<{
    amount: number;
    senderName: string;
    recipientName: string;
    recipientCard?: string;
    recipientPhone?: string;
    recipientBank?: string;
    senderAccount?: string;
    transactionDate?: string;
    transferType?: string;
    status?: string;
    commission?: number;
    operationId?: string;
    sbpCode?: string;
    receiptNumber?: string;
    total?: number;
    rawText: string;
  }> {
    const result = await this.parseFromFile(filePath);
    
    // Преобразуем в старый формат
    const oldFormat: any = {
      amount: result.amount,
      senderName: result.sender,
      recipientName: '',
      rawText: this.lastExtractedText || '',
      transferType: result.transferType,
      status: result.status,
      commission: result.commission,
      operationId: result.operationId,
      sbpCode: result.sbpCode,
      receiptNumber: result.receiptNumber,
      total: result.total,
      senderAccount: result.senderAccount
    };

    // Заполняем recipientName и recipientCard в зависимости от типа
    switch (result.transferType) {
      case TransferType.BY_PHONE:
        const phoneResult = result as PhoneTransferReceipt;
        oldFormat.recipientName = phoneResult.recipientName || phoneResult.recipientPhone;
        oldFormat.recipientPhone = phoneResult.recipientPhone;
        oldFormat.recipientBank = phoneResult.recipientBank;
        break;
      case TransferType.TO_TBANK:
        const tbankResult = result as TBankTransferReceipt;
        oldFormat.recipientName = tbankResult.recipientName;
        oldFormat.recipientCard = tbankResult.recipientCard;
        break;
      case TransferType.TO_CARD:
        const cardResult = result as CardTransferReceipt;
        oldFormat.recipientCard = cardResult.recipientCard;
        oldFormat.recipientName = 'Card Transfer';
        break;
    }

    if (result.datetime) {
      oldFormat.transactionDate = result.datetime.toISOString();
    }

    return oldFormat;
  }

  /**
   * Парсит чек из буфера PDF
   */
  async parseFromBuffer(pdfBuffer: Buffer): Promise<ParsedReceipt> {
    console.log('[TinkoffReceiptParser] Starting parse from buffer, size:', pdfBuffer.length);
    const text = await extractTextFromPdfBuffer(pdfBuffer);
    console.log('[TinkoffReceiptParser] Extracted text length:', text.length);
    this.lastExtractedText = text;
    return this.parseReceiptText(text);
  }

  /**
   * Парсит текст чека
   */
  private parseReceiptText(text: string): ParsedReceipt {
    console.log('[TinkoffReceiptParser] Parsing text, first 200 chars:', text.substring(0, 200));
    
    // Проверяем статус - обязательно должно быть "Успешно"
    if (!text.includes("Успешно")) {
      console.error('[TinkoffReceiptParser] Receipt rejected: no "Успешно" status found');
      throw new ReceiptParseError("Чек бракованный: не найден статус 'Успешно'");
    }

    // Определяем формат чека
    const receiptFormat = this.detectReceiptFormat(text);
    console.log('[TinkoffReceiptParser] Detected format:', receiptFormat);
    
    // Извлекаем дату и время
    const datetime = this.extractDateTime(text);
    if (!datetime) {
      console.error('[TinkoffReceiptParser] Failed to extract datetime');
      throw new ReceiptParseError("Не удалось извлечь дату и время из чека");
    }
    console.log('[TinkoffReceiptParser] Extracted datetime:', datetime);

    // Извлекаем сумму (не Итого!)
    const amount = this.extractAmount(text);
    if (!amount) {
      console.error('[TinkoffReceiptParser] Failed to extract amount');
      throw new ReceiptParseError("Не удалось извлечь сумму из чека");
    }
    console.log('[TinkoffReceiptParser] Extracted amount:', amount);

    // Извлекаем отправителя с учетом формата
    const sender = this.extractSenderV2(text, receiptFormat);
    if (!sender) {
      console.error('[TinkoffReceiptParser] Failed to extract sender');
      throw new ReceiptParseError("Не удалось извлечь отправителя из чека");
    }
    console.log('[TinkoffReceiptParser] Extracted sender:', sender);

    // Определяем тип перевода
    const transferType = this.detectTransferType(text);

    // Парсим в зависимости от типа с учетом формата
    switch (transferType) {
      case TransferType.BY_PHONE:
        return this.parsePhoneTransferV2(text, datetime, amount, sender, receiptFormat);
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
    // Ищем сумму - число после слова "Сумма" с знаком рубля
    // Форматы: "Сумма\n\n4 500 i" или "16 000 iСумма"
    const patterns = [
      // Сумма после слова "Сумма" (с переносом строки)
      /Сумма\s*\n?\s*(\d+(?:\s+\d+)*)\s*[₽i]/,
      // Сумма перед словом "Сумма" (старый формат)
      /(\d+(?:\s+\d+)*)\s*[₽i]\s*Сумма/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Убираем пробелы из числа
        const amountStr = match[1].replace(/\s+/g, "");
        return parseInt(amountStr);
      }
    }
    
    return null;
  }

  private extractSender(text: string): string | null {
    // Новый подход: ищем структуру с лейблами и значениями
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Находим индекс лейбла "Отправитель"
    const senderLabelIdx = lines.findIndex(l => l === 'Отправитель');
    
    if (senderLabelIdx !== -1) {
      // Ищем имя отправителя после лейбла
      // Проверяем несколько строк вперед, пропуская другие лейблы
      for (let i = senderLabelIdx + 1; i < Math.min(senderLabelIdx + 10, lines.length); i++) {
        const line = lines[i];
        
        // Пропускаем известные лейблы
        if (line === 'Телефон получателя' || 
            line === 'Получатель' || 
            line === 'Банк получателя' || 
            line === 'Счет списания' ||
            line === 'Комиссия' ||
            line === 'Без комиссии' ||
            line.startsWith('+7') ||
            line.includes('****')) {
          continue;
        }
        
        // Проверяем, что это имя
        if (line && line.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/) && line.length > 2) {
          return line;
        }
      }
    }
    
    // Старые паттерны как запасной вариант
    const patterns = [
      /([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)Отправитель/,
      /Отправитель([А-Яа-яЁё]+(?:\s+[А-Яа-яЁё]+)*)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].trim();
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

  // Определяет формат чека (колоночный или последовательный)
  private detectReceiptFormat(text: string): 'columns' | 'sequential' {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Находим все лейблы
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    const labelIndices = labels.map(label => lines.findIndex(l => l === label)).filter(idx => idx !== -1);
    
    if (labelIndices.length < 2) return 'sequential';
    
    // Проверяем, идут ли лейблы подряд
    labelIndices.sort((a, b) => a - b);
    let consecutive = true;
    for (let i = 1; i < labelIndices.length; i++) {
      if (labelIndices[i] - labelIndices[i-1] !== 1) {
        consecutive = false;
        break;
      }
    }
    
    return consecutive ? 'columns' : 'sequential';
  }

  // Улучшенный экстрактор отправителя
  private extractSenderV2(text: string, format: 'columns' | 'sequential'): string | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const senderIdx = lines.findIndex(l => l === 'Отправитель');
    
    if (senderIdx === -1) return null;
    
    if (format === 'columns') {
      // В колоночном формате сначала идут все лейблы, потом все значения
      const labelCount = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания']
        .filter(label => lines.includes(label)).length;
      
      // Находим позицию лейбла "Отправитель" среди других лейблов
      const labelPosition = lines.slice(0, senderIdx).filter(l => 
        ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'].includes(l)
      ).length;
      
      // Значение находится через количество лейблов
      const valueIdx = senderIdx + (labelCount - labelPosition) + 1;
      if (valueIdx < lines.length) {
        const value = lines[valueIdx];
        if (value && value.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/)) {
          return value;
        }
      }
    } else {
      // В последовательном формате значение идет после лейбла
      for (let i = senderIdx + 1; i < Math.min(senderIdx + 5, lines.length); i++) {
        const line = lines[i];
        if (line && line.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/) && 
            !['Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'].includes(line)) {
          return line;
        }
      }
    }
    
    return null;
  }

  // Улучшенный парсер для переводов по телефону
  private parsePhoneTransferV2(
    text: string,
    datetime: Date,
    amount: number,
    sender: string,
    format: 'columns' | 'sequential'
  ): PhoneTransferReceipt {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Базовый результат
    const result: PhoneTransferReceipt = {
      datetime,
      amount,
      status: "Успешно",
      sender,
      transferType: TransferType.BY_PHONE,
      recipientPhone: ''
    };
    
    // Извлекаем все общие поля
    this.extractCommonFields(text, result);
    
    // Специфичные поля для phone transfer
    if (format === 'columns') {
      this.extractFieldsFromColumns(lines, result);
    } else {
      this.extractFieldsSequentially(lines, result);
    }
    
    if (!result.recipientPhone) {
      throw new ReceiptParseError("Не найден телефон получателя");
    }
    
    return result;
  }

  // Извлекает общие поля для всех типов
  private extractCommonFields(text: string, receipt: BaseReceipt): void {
    // Итого
    const totalMatch = text.match(/Итого\s*\n\s*[^\n]+\s*\n\s*(\d+(?:\s+\d+)*)\s*[₽i]/);
    if (totalMatch) {
      receipt.total = parseInt(totalMatch[1].replace(/\s+/g, ''));
    }
    
    // Идентификатор операции
    const operationMatch = text.match(/Идентификатор операции\s+(\S+)/);
    if (operationMatch) {
      receipt.operationId = operationMatch[1];
    }
    
    // СБП код
    const sbpMatch = text.match(/СБП\s*\n\s*(\d+)/);
    if (sbpMatch) {
      receipt.sbpCode = sbpMatch[1];
    }
    
    // Номер квитанции
    const receiptNumMatch = text.match(/Квитанция\s*№\s*([\d-]+)/);
    if (receiptNumMatch) {
      receipt.receiptNumber = receiptNumMatch[1];
    }
  }

  // Извлекает поля из колоночного формата
  private extractFieldsFromColumns(lines: string[], receipt: any): void {
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    const labelIndices: {[key: string]: number} = {};
    
    // Находим индексы всех лейблов
    labels.forEach(label => {
      const idx = lines.findIndex(l => l === label);
      if (idx !== -1) labelIndices[label] = idx;
    });
    
    // Находим начало блока значений
    const firstLabelIdx = Math.min(...Object.values(labelIndices));
    const lastLabelIdx = Math.max(...Object.values(labelIndices));
    const valuesStartIdx = lastLabelIdx + 1;
    
    // Извлекаем значения
    Object.entries(labelIndices).forEach(([label, idx]) => {
      const position = Object.values(labelIndices).filter(i => i <= idx).length - 1;
      const valueIdx = valuesStartIdx + position;
      
      if (valueIdx < lines.length) {
        const value = lines[valueIdx];
        
        switch(label) {
          case 'Комиссия':
            receipt.commission = value === 'Без комиссии' ? 0 : parseInt(value);
            break;
          case 'Телефон получателя':
            if (value.match(/^\+7/)) receipt.recipientPhone = value;
            break;
          case 'Получатель':
            if (value && !value.startsWith('+7')) receipt.recipientName = value;
            break;
          case 'Банк получателя':
            if (value.includes('банк') || value.includes('Банк')) receipt.recipientBank = value;
            break;
          case 'Счет списания':
            if (value.includes('****')) receipt.senderAccount = value;
            break;
        }
      }
    });
  }

  // Извлекает поля последовательно
  private extractFieldsSequentially(lines: string[], receipt: any): void {
    // В последовательном формате значения могут быть как после блока лейблов, так и между ними
    const labelIndices: {[key: string]: number} = {};
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    
    // Находим индексы лейблов
    labels.forEach(label => {
      const idx = lines.findIndex(l => l === label);
      if (idx !== -1) labelIndices[label] = idx;
    });
    
    // Сначала ищем значения непосредственно после каждого лейбла
    Object.entries(labelIndices).forEach(([label, idx]) => {
      // Проверяем несколько строк после лейбла
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        
        // Пропускаем другие лейблы
        if (labels.includes(line)) continue;
        
        // Пропускаем идентификатор операции и далее
        if (line.startsWith('Идентификатор операции') || line === 'СБП' || line.startsWith('Квитанция')) {
          break;
        }
        
        switch(label) {
          case 'Комиссия':
            if (receipt.commission === undefined && (line === 'Без комиссии' || line.match(/^\d+$/))) {
              receipt.commission = line === 'Без комиссии' ? 0 : parseInt(line);
              return;
            }
            break;
          case 'Телефон получателя':
            if (!receipt.recipientPhone && line.match(/^\+7/)) {
              receipt.recipientPhone = line;
              return;
            }
            break;
          case 'Счет списания':
            if (!receipt.senderAccount && line.includes('****')) {
              receipt.senderAccount = line;
              return;
            }
            break;
          case 'Банк получателя':
            if (!receipt.recipientBank && (line.includes('банк') || line.includes('Банк'))) {
              receipt.recipientBank = line;
              return;
            }
            break;
          case 'Получатель':
            if (!receipt.recipientName && line.match(/^[А-ЯЁ][а-яё]+/) && !line.includes('Банк')) {
              receipt.recipientName = line;
              return;
            }
            break;
        }
      }
    });
    
    // Если не нашли что-то, пробуем поискать в конце (старая логика как fallback)
    const lastLabelIdx = Math.max(...Object.values(labelIndices).filter(idx => idx !== -1));
    
    for (let i = lastLabelIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Пропускаем идентификатор операции и далее
      if (line.startsWith('Идентификатор операции') || line === 'СБП' || line.startsWith('Квитанция')) {
        break;
      }
      
      // Комиссия
      if (receipt.commission === undefined && (line === 'Без комиссии' || line.match(/^\d+$/))) {
        receipt.commission = line === 'Без комиссии' ? 0 : parseInt(line);
        continue;
      }
      
      // Телефон
      if (!receipt.recipientPhone && line.match(/^\+7/)) {
        receipt.recipientPhone = line;
        continue;
      }
      
      // Счет списания
      if (!receipt.senderAccount && line.includes('****')) {
        receipt.senderAccount = line;
        continue;
      }
      
      // Банк
      if (!receipt.recipientBank && (line.includes('банк') || line.includes('Банк'))) {
        receipt.recipientBank = line;
        continue;
      }
      
      // Имя получателя - должно быть после всех остальных значений
      if (!receipt.recipientName && line.match(/^[А-ЯЁ][а-яё]+/) && !line.includes('Банк')) {
        receipt.recipientName = line;
        continue;
      }
    }
  }

  private parsePhoneTransfer(
    text: string,
    datetime: Date,
    amount: number,
    sender: string
  ): PhoneTransferReceipt {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Находим индексы лейблов
    const phoneIdx = lines.findIndex(l => l === 'Телефон получателя');
    const recipientIdx = lines.findIndex(l => l === 'Получатель');
    const bankIdx = lines.findIndex(l => l === 'Банк получателя');
    const commissionIdx = lines.findIndex(l => l === 'Комиссия');
    
    // Извлекаем телефон - ищем первый номер телефона после лейбла
    let phone: string | null = null;
    if (phoneIdx !== -1) {
      for (let i = phoneIdx + 1; i < Math.min(phoneIdx + 10, lines.length); i++) {
        if (lines[i].match(/^\+7\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2}$/)) {
          phone = lines[i];
          break;
        }
      }
    }
    
    if (!phone) {
      throw new ReceiptParseError("Не найден телефон получателя");
    }
    
    const result: PhoneTransferReceipt = {
      datetime,
      amount,
      status: "Успешно",
      sender,
      transferType: TransferType.BY_PHONE,
      recipientPhone: phone
    };
    
    // Извлекаем имя получателя - ищем первое имя после лейбла
    if (recipientIdx !== -1) {
      for (let i = recipientIdx + 1; i < Math.min(recipientIdx + 10, lines.length); i++) {
        const line = lines[i];
        // Пропускаем лейблы и специальные значения
        if (line === 'Банк получателя' || 
            line === 'Счет списания' ||
            line.startsWith('+7') ||
            line.includes('****') ||
            line.includes('Банк') ||
            line.includes('банк')) {
          continue;
        }
        // Проверяем, что это имя
        if (line && line.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][.,]?)$/) && !line.startsWith('+')) {
          result.recipientName = line;
          break;
        }
      }
    }
    
    // Извлекаем банк - ищем строку с "банк" после лейбла
    if (bankIdx !== -1) {
      for (let i = bankIdx + 1; i < Math.min(bankIdx + 10, lines.length); i++) {
        const line = lines[i];
        if (line && (line.includes('банк') || line.includes('Банк'))) {
          result.recipientBank = line;
          break;
        }
      }
    }
    
    // Комиссия - ищем значение после лейбла
    if (commissionIdx !== -1) {
      for (let i = commissionIdx + 1; i < Math.min(commissionIdx + 5, lines.length); i++) {
        const line = lines[i];
        if (line === 'Без комиссии') {
          result.commission = 0;
          break;
        } else if (line && line.match(/^\d+$/)) {
          result.commission = parseInt(line);
          break;
        }
      }
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
      status: "Успешно",
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
    const cardMatch = text.match(/Карта получателя[\s\S]*?(\d{6}\*{6}\d{4})/);
    if (!cardMatch) {
      throw new ReceiptParseError("Не найдена карта получателя");
    }

    // Извлекаем комиссию (может быть 0 или отсутствовать)
    const commission = this.extractCommission(text);

    const result: CardTransferReceipt = {
      datetime,
      amount,
      status: "Успешно",
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