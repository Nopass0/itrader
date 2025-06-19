/**
 * Улучшенный парсер чеков Тинькофф v2
 * Корректно обрабатывает оба формата чеков
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
  senderAccount: string;
  
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

export class TinkoffReceiptParserV2 {
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
   * Парсит текст чека
   */
  private parseText(text: string): TinkoffReceiptData {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Определяем структуру чека
    const structure = this.analyzeStructure(lines);
    
    // Извлекаем все поля
    const result: TinkoffReceiptData = {
      datetime: this.extractDateTime(lines),
      amount: this.extractAmount(lines),
      total: this.extractTotal(lines),
      status: this.extractStatus(lines),
      transferType: this.extractTransferType(lines),
      senderName: '',
      senderAccount: '',
      commission: 0,
      operationId: this.extractOperationId(lines),
      sbpCode: this.extractSbpCode(lines),
      receiptNumber: this.extractReceiptNumber(text),
      rawText: text
    };
    
    // Извлекаем поля в зависимости от структуры
    if (structure === 'columnar') {
      this.extractColumnarFields(lines, result);
    } else {
      this.extractSequentialFields(lines, result);
    }
    
    // Валидация
    if (!result.senderName) {
      throw new Error("Не удалось извлечь отправителя из чека");
    }
    
    return result;
  }

  /**
   * Анализирует структуру чека
   */
  private analyzeStructure(lines: string[]): 'columnar' | 'sequential' {
    // Ищем блок лейблов
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    const indices: number[] = [];
    
    labels.forEach(label => {
      const idx = lines.indexOf(label);
      if (idx !== -1) indices.push(idx);
    });
    
    if (indices.length < 4) return 'sequential';
    
    // Проверяем идут ли лейблы подряд
    indices.sort((a, b) => a - b);
    const isConsecutive = indices.every((val, i) => i === 0 || val === indices[i-1] + 1);
    
    return isConsecutive ? 'columnar' : 'sequential';
  }

  /**
   * Извлекает поля из колоночной структуры
   */
  private extractColumnarFields(lines: string[], result: TinkoffReceiptData): void {
    // В колоночной структуре все лейблы идут подряд, затем все значения
    const labelStart = lines.indexOf('Комиссия');
    const labelEnd = lines.indexOf('Счет списания');
    
    if (labelStart === -1 || labelEnd === -1) return;
    
    // Значения начинаются после последнего лейбла
    const valueStart = labelEnd + 1;
    
    // Мапинг позиций
    const mapping: {[key: string]: number} = {
      'Комиссия': 0,
      'Отправитель': 1,
      'Телефон получателя': 2,
      'Получатель': 3,
      'Банк получателя': 4,
      'Счет списания': 5
    };
    
    // Извлекаем значения
    Object.entries(mapping).forEach(([label, offset]) => {
      const valueIdx = valueStart + offset;
      if (valueIdx < lines.length) {
        const value = lines[valueIdx];
        this.assignValue(label, value, result);
      }
    });
  }

  /**
   * Извлекает поля из последовательной структуры
   */
  private extractSequentialFields(lines: string[], result: TinkoffReceiptData): void {
    // В последовательной структуре лейблы и значения перемешаны
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Ищем лейблы и их значения
      switch(line) {
        case 'Комиссия':
          // Комиссия на следующей строке после "Отправитель"
          const afterSender = lines.indexOf('Отправитель');
          if (afterSender !== -1 && afterSender + 1 < lines.length) {
            const val = lines[afterSender + 1];
            if (val === 'Без комиссии' || val.match(/^\d+$/)) {
              result.commission = val === 'Без комиссии' ? 0 : parseInt(val);
            }
          }
          break;
          
        case 'Отправитель':
          // Отправитель через 2 строки после "Телефон получателя"
          const phoneIdx = lines.indexOf('Телефон получателя');
          if (phoneIdx !== -1 && phoneIdx + 2 < lines.length) {
            const val = lines[phoneIdx + 2];
            if (val && val.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/)) {
              result.senderName = val;
            }
          }
          break;
          
        case 'Телефон получателя':
          // Телефон через 3 строки
          if (i + 3 < lines.length) {
            const val = lines[i + 3];
            if (val && val.match(/^\+7/)) {
              result.recipientPhone = val;
            }
          }
          break;
          
        case 'Получатель':
          // Получатель через 3 строки
          if (i + 3 < lines.length) {
            const val = lines[i + 3];
            if (val && val.match(/^[А-ЯЁ][а-яё]+/)) {
              result.recipientName = val;
            }
          }
          break;
          
        case 'Банк получателя':
          // Банк через 2 строки
          if (i + 2 < lines.length) {
            const val = lines[i + 2];
            if (val && (val.includes('банк') || val.includes('Банк'))) {
              result.recipientBank = val;
            }
          }
          break;
          
        case 'Счет списания':
          // Счет через 3 строки
          if (i + 3 < lines.length) {
            const val = lines[i + 3];
            if (val && val.includes('****')) {
              result.senderAccount = val;
            }
          }
          break;
      }
      i++;
    }
  }

  /**
   * Присваивает значение нужному полю
   */
  private assignValue(label: string, value: string, result: TinkoffReceiptData): void {
    switch(label) {
      case 'Комиссия':
        result.commission = value === 'Без комиссии' ? 0 : parseInt(value) || 0;
        break;
      case 'Отправитель':
        if (value.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/)) {
          result.senderName = value;
        }
        break;
      case 'Телефон получателя':
        if (value.match(/^\+7/)) {
          result.recipientPhone = value;
        }
        break;
      case 'Получатель':
        if (value && !value.startsWith('+7') && value.match(/^[А-ЯЁ]/)) {
          result.recipientName = value;
        }
        break;
      case 'Банк получателя':
        if (value.includes('банк') || value.includes('Банк')) {
          result.recipientBank = value;
        }
        break;
      case 'Счет списания':
        if (value.includes('****')) {
          result.senderAccount = value;
        }
        break;
    }
  }

  // Методы извлечения отдельных полей
  private extractDateTime(lines: string[]): Date {
    const dateStr = lines[0]; // Первая строка всегда дата
    const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
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

  private extractAmount(lines: string[]): number {
    const amountIdx = lines.indexOf('Сумма');
    if (amountIdx !== -1) {
      // Try the next line first (sequential format)
      if (amountIdx + 1 < lines.length) {
        const nextLine = lines[amountIdx + 1];
        const amountMatch = nextLine.match(/^([\d\s]+)\s*[₽i]/);
        if (amountMatch) {
          const amountStr = amountMatch[1].replace(/\s/g, '');
          return parseInt(amountStr) || 0;
        }
      }
      // Try line + 2 (columnar format)
      if (amountIdx + 2 < lines.length) {
        const amountStr = lines[amountIdx + 2].replace(/[^\d]/g, '');
        return parseInt(amountStr) || 0;
      }
    }
    return 0;
  }

  private extractTotal(lines: string[]): number {
    const totalIdx = lines.indexOf('Итого');
    if (totalIdx !== -1) {
      // Check next few lines for amount
      for (let i = 1; i <= 3 && totalIdx + i < lines.length; i++) {
        const line = lines[totalIdx + i];
        const match = line.match(/^([\d\s]+)\s*[₽i]/);
        if (match) {
          const totalStr = match[1].replace(/\s/g, '');
          return parseInt(totalStr) || 0;
        }
      }
    }
    return 0;
  }

  private extractStatus(lines: string[]): string {
    const statusIdx = lines.indexOf('Статус');
    if (statusIdx !== -1) {
      // Check next few lines for status value
      for (let i = 1; i <= 3 && statusIdx + i < lines.length; i++) {
        const line = lines[statusIdx + i];
        // Skip if it's another label
        if (line === 'Сумма' || line === 'Перевод' || line === 'Итого') {
          continue;
        }
        // Return the status value
        if (line === 'Успешно' || line === 'Выполнено' || line.length > 0) {
          return line;
        }
      }
    }
    return '';
  }

  private extractTransferType(lines: string[]): string {
    const transferIdx = lines.indexOf('Перевод');
    if (transferIdx !== -1 && transferIdx + 2 < lines.length) {
      return lines[transferIdx + 2];
    }
    return '';
  }

  private extractOperationId(lines: string[]): string {
    for (const line of lines) {
      if (line.startsWith('Идентификатор операции')) {
        return line.replace('Идентификатор операции', '').trim();
      }
    }
    return '';
  }

  private extractSbpCode(lines: string[]): string {
    const sbpIdx = lines.indexOf('СБП');
    if (sbpIdx !== -1 && sbpIdx + 1 < lines.length) {
      return lines[sbpIdx + 1];
    }
    return '';
  }

  private extractReceiptNumber(text: string): string {
    const match = text.match(/Квитанция\s*№\s*([\d-]+)/);
    return match ? match[1] : '';
  }
}