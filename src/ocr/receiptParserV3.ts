/**
 * Улучшенный парсер чеков Тинькофф v3
 * Единый алгоритм для всех форматов чеков
 */

import { extractTextFromPdfBuffer } from "./utils/textExtractor";
import * as fs from "fs/promises";

// Все поля чека
export interface TinkoffReceiptData {
  // Основные поля
  datetime: Date;
  amount: number;
  total: number;
  status: string;
  transferType: string;
  
  // Отправитель
  senderName: string;
  senderAccount?: string;
  
  // Получатель
  recipientName?: string;
  recipientPhone?: string;
  recipientBank?: string;
  recipientCard?: string;
  
  // Дополнительные поля
  commission: number;
  operationId: string;
  sbpCode: string;
  receiptNumber: string;
  
  // Технические поля
  rawText: string;
}

// Типы базовых полей (без datetime и rawText)
type BaseMap = Omit<TinkoffReceiptData, 'datetime' | 'rawText' | 'receiptNumber'>;

// Паттерны для валидации
const PATTERNS = {
  phone: /^\+7/,
  maskedCard: /^\d{4,6}\*{4,}\d{4}$/,
  maskedAccount: /^\d{3,}\*{2,}\d{4}$/,
  name: /^[А-ЯЁ][а-яё]+/,
  amount: /^[\d\s]+(?:[,.][\d]+)?(?:\s*[₽i])?$/,
  date: /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
};

// Словарь лейблов с синонимами
const LABELS: Record<keyof BaseMap, string[]> = {
  total: ['Итого'],
  transferType: ['Перевод'],
  status: ['Статус'],
  amount: ['Сумма'],
  commission: ['Комиссия'],
  senderName: ['Отправитель'],
  senderAccount: ['Счёт списания', 'Счет списания'],
  recipientPhone: ['Телефон получателя'],
  recipientName: ['Получатель'],
  recipientBank: ['Банк получателя'],
  recipientCard: ['Карта получателя'],
  operationId: ['Идентификатор операции'],
  sbpCode: ['СБП'],
};

// Лейблы, после которых значение может быть через строку
const MULTILINE_LABELS = ['Итого', 'Перевод', 'Статус', 'Сумма'];

export class TinkoffReceiptParserV3 {
  public lastExtractedText: string | null = null;

  /**
   * Парсит чек из PDF файла
   */
  async parseReceiptPDF(filePath: string): Promise<TinkoffReceiptData> {
    const pdfBuffer = await fs.readFile(filePath);
    const text = await extractTextFromPdfBuffer(pdfBuffer);
    this.lastExtractedText = text;
    
    return this.parseText(text);
  }

  /**
   * Парсит текст чека из буфера
   */
  async parseReceiptBuffer(pdfBuffer: Buffer): Promise<TinkoffReceiptData> {
    const text = await extractTextFromPdfBuffer(pdfBuffer);
    this.lastExtractedText = text;
    
    return this.parseText(text);
  }

  /**
   * Парсит текст чека
   */
  parseText(text: string): TinkoffReceiptData {
    // Preprocessing - НЕ заменяем переносы строк!
    const lines = text
      .replace(/\r/g, '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    
    // Инициализируем результат
    const map: Partial<BaseMap> = {};
    
    // Основной проход по строкам
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Находим лейбл
      const labelKey = this.findLabel(line);
      if (!labelKey) continue;
      
      const label = LABELS[labelKey].find(l => line.startsWith(l))!;
      let value = line.slice(label.length).trim();
      
      // Если значение пустое, ищем в следующих строках
      if (!value) {
        // Для некоторых лейблов значение может быть через пустую строку
        const isMultilineLabel = MULTILINE_LABELS.some(ml => label.startsWith(ml));
        let j = i + 1;
        let skipEmpty = isMultilineLabel;
        
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          
          // Для multiline labels пропускаем первую пустую строку
          if (!nextLine && skipEmpty) {
            skipEmpty = false;
            j++;
            continue;
          }
          
          // Прерываем, если нашли другой лейбл
          if (this.findLabel(nextLine)) break;
          
          // Прерываем на служебных строках
          if (nextLine.startsWith('Квитанция') || 
              nextLine.includes('@') || 
              nextLine.includes('поддержк')) break;
          
          if (nextLine) {
            value = nextLine;
            i = j; // Перепрыгиваем обработанные строки
            break;
          }
          j++;
        }
      }
      
      // Обрабатываем значение
      if (value) {
        const processed = this.processValue(labelKey, value);
        if (processed !== undefined) {
          map[labelKey] = processed;
        }
      }
      
      // Специальная обработка для блока из 3 лейблов (Получатель, Банк получателя, Счет списания)
      if (labelKey === 'recipientName' && 
          i + 2 < lines.length && 
          lines[i + 1] === 'Банк получателя' && 
          lines[i + 2] === 'Счет списания') {
        // Это блок из 3 лейблов подряд, значения идут после
        let j = i + 3;
        if (j < lines.length) {
          const recipientValue = this.processValue('recipientName', lines[j]);
          if (recipientValue) map.recipientName = recipientValue;
          j++;
        }
        if (j < lines.length) {
          const bankValue = this.processValue('recipientBank', lines[j]);
          if (bankValue) map.recipientBank = bankValue;
          j++;
        }
        if (j < lines.length) {
          const accountValue = this.processValue('senderAccount', lines[j]);
          if (accountValue) map.senderAccount = accountValue;
        }
        i = j; // Пропускаем обработанные строки
      }
    }
    
    // Post-processing
    const datetime = this.extractDateTime(lines[0]);
    const receiptNumber = this.extractReceiptNumber(text);
    
    // Специальная обработка для имени получателя в конце документа
    if (!map.recipientName && map.transferType === 'По номеру телефона') {
      const name = this.findRecipientNameAtEnd(lines);
      if (name) map.recipientName = name;
    }
    
    // Собираем результат
    const result: TinkoffReceiptData = {
      datetime,
      rawText: text,
      receiptNumber,
      total: map.total ?? 0,
      amount: map.amount ?? 0,
      status: map.status ?? '',
      transferType: map.transferType ?? '',
      senderName: map.senderName ?? '',
      senderAccount: map.senderAccount,
      recipientName: map.recipientName,
      recipientPhone: map.recipientPhone,
      recipientBank: map.recipientBank,
      recipientCard: map.recipientCard,
      commission: map.commission ?? 0,
      operationId: map.operationId ?? '',
      sbpCode: map.sbpCode ?? ''
    };
    
    // Валидация
    this.validate(result);
    
    return result;
  }
  
  /**
   * Находит лейбл в строке
   */
  private findLabel(line: string): keyof BaseMap | null {
    return (Object.keys(LABELS) as (keyof BaseMap)[])
      .find(key => LABELS[key].some(label => line.startsWith(label))) || null;
  }
  
  /**
   * Обрабатывает значение в зависимости от типа поля
   */
  private processValue(field: keyof BaseMap, raw: string): any {
    switch (field) {
      case 'total':
      case 'amount':
        return this.parseMoney(raw);
        
      case 'commission':
        return /без\s+комиссии/i.test(raw) ? 0 : this.parseMoney(raw);
        
      case 'senderAccount':
        return PATTERNS.maskedAccount.test(raw) ? raw : undefined;
        
      case 'recipientCard':
        return PATTERNS.maskedCard.test(raw) ? raw : undefined;
        
      case 'recipientPhone':
        return PATTERNS.phone.test(raw) ? raw : undefined;
        
      case 'recipientName':
      case 'senderName':
        // Проверяем, что это имя, а не телефон или что-то еще
        if (PATTERNS.phone.test(raw) || raw === 'Без комиссии') return undefined;
        return PATTERNS.name.test(raw) ? raw : undefined;
        
      case 'recipientBank':
        // Пропускаем, если это явно не банк
        if (PATTERNS.phone.test(raw) || PATTERNS.maskedAccount.test(raw)) return undefined;
        return raw;
        
      case 'operationId':
        // Операционный ID обычно содержит буквы и цифры
        return raw.replace('Идентификатор операции', '').trim();
        
      default:
        return raw;
    }
  }
  
  /**
   * Парсит денежную сумму
   */
  private parseMoney(raw: string): number {
    // Убираем всё, кроме цифр, пробелов, запятой и точки
    const cleanAmount = raw
      .replace(/[^\d\s,\.]/g, '')
      .trim()
      .replace(/\s+/g, '') // Убираем пробелы между цифрами
      .replace(',', '.');
    
    return parseFloat(cleanAmount) || 0;
  }
  
  /**
   * Извлекает дату и время
   */
  private extractDateTime(firstLine: string): Date {
    const match = firstLine.match(PATTERNS.date);
    
    if (match) {
      const [_, day, month, year, hours, minutes, seconds] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      );
    }
    
    return new Date();
  }
  
  /**
   * Извлекает номер квитанции
   */
  private extractReceiptNumber(text: string): string {
    const match = text.match(/Квитанция\s*№\s*([\d-]+)/);
    return match ? match[1] : '';
  }
  
  /**
   * Ищет имя получателя в конце документа
   */
  private findRecipientNameAtEnd(lines: string[]): string | undefined {
    // Ищем в последних 5 строках
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
      const line = lines[i];
      
      // Пропускаем служебные строки
      if (line.includes('@') || line.includes('поддержк')) continue;
      
      // Проверяем, что это похоже на имя с инициалом
      if (line.match(/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.?$/)) {
        return line;
      }
    }
    
    return undefined;
  }
  
  /**
   * Валидация результата
   */
  private validate(result: TinkoffReceiptData): void {
    const errors: string[] = [];
    
    if (!result.datetime || isNaN(result.datetime.getTime())) {
      errors.push('Неверная дата');
    }
    
    if (!result.amount || result.amount <= 0) {
      errors.push('Неверная сумма');
    }
    
    if (!result.senderName) {
      errors.push('Не удалось извлечь отправителя');
    }
    
    if (errors.length > 0) {
      throw new Error(`Ошибки парсинга: ${errors.join(', ')}`);
    }
  }
}

// Экспорт для обратной совместимости
export default TinkoffReceiptParserV3;