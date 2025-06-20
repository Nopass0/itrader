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
    
    // Проверяем, не является ли это смешанным блочным форматом
    if (this.isMixedBlockFormat(lines)) {
      this.extractMixedBlockFields(lines, result);
    } else if (structure === 'columnar') {
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
   * Проверяет, является ли формат смешанным блочным
   */
  private isMixedBlockFormat(lines: string[]): boolean {
    // Ищем первый блок лейблов
    const firstBlockLabels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель'];
    const firstBlockStart = lines.indexOf('Комиссия');
    
    if (firstBlockStart === -1) return false;
    
    // Проверяем, идут ли первые 4 лейбла подряд
    let allLabelsFound = true;
    for (let i = 0; i < firstBlockLabels.length; i++) {
      if (lines[firstBlockStart + i] !== firstBlockLabels[i]) {
        allLabelsFound = false;
        break;
      }
    }
    
    if (!allLabelsFound) return false;
    
    // Проверяем, есть ли значения сразу после лейблов
    const valueStart = firstBlockStart + firstBlockLabels.length;
    if (valueStart + 4 > lines.length) return false;
    
    // Проверяем типичные значения
    const possibleCommission = lines[valueStart];
    const possibleSender = lines[valueStart + 1];
    const possiblePhone = lines[valueStart + 2];
    
    return (possibleCommission === 'Без комиссии' || /^\d+$/.test(possibleCommission)) &&
           /^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/.test(possibleSender) &&
           /^\+7/.test(possiblePhone);
  }

  /**
   * Извлекает поля из смешанного блочного формата
   */
  private extractMixedBlockFields(lines: string[], result: TinkoffReceiptData): void {
    // Первый блок
    const firstBlockStart = lines.indexOf('Комиссия');
    if (firstBlockStart !== -1) {
      const valueStart = firstBlockStart + 4; // После 4 лейблов
      
      if (valueStart + 3 < lines.length) {
        result.commission = lines[valueStart] === 'Без комиссии' ? 0 : parseInt(lines[valueStart]) || 0;
        result.senderName = lines[valueStart + 1];
        result.recipientPhone = lines[valueStart + 2];
        result.recipientName = lines[valueStart + 3];
      }
    }
    
    // Второй блок
    const secondBlockStart = lines.indexOf('Банк получателя');
    if (secondBlockStart !== -1) {
      const valueStart = secondBlockStart + 2; // После 2 лейблов
      
      if (valueStart + 1 < lines.length) {
        result.recipientBank = lines[valueStart];
        result.senderAccount = lines[valueStart + 1];
      }
    }
  }

  /**
   * Анализирует структуру чека
   */
  private analyzeStructure(lines: string[]): 'columnar' | 'sequential' {
    // Ищем блок лейблов
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    const labelPositions: { label: string; index: number }[] = [];
    
    labels.forEach(label => {
      const idx = lines.indexOf(label);
      if (idx !== -1) {
        labelPositions.push({ label, index: idx });
      }
    });
    
    if (labelPositions.length < 4) return 'sequential';
    
    // Сортируем по позиции
    labelPositions.sort((a, b) => a.index - b.index);
    
    // Проверяем структуру между первыми 4 лейблами
    const firstFour = labelPositions.slice(0, 4);
    
    // Если между лейблами есть значения (не-лейблы), это смешанный формат
    for (let i = 1; i < firstFour.length; i++) {
      const prevIdx = firstFour[i-1].index;
      const currIdx = firstFour[i].index;
      
      // Проверяем строки между лейблами
      for (let j = prevIdx + 1; j < currIdx; j++) {
        const line = lines[j];
        // Если между лейблами есть значения (не другие лейблы), это смешанный формат
        if (line && !labels.includes(line)) {
          return 'sequential'; // На самом деле это смешанный формат
        }
      }
    }
    
    return 'columnar';
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
    
    // Специальная обработка для имени получателя в конце документа
    if (result.transferType === 'По номеру телефона' && !result.recipientName) {
      // Ищем имя получателя в последних строках (после email поддержки)
      for (let j = lines.length - 1; j >= Math.max(0, lines.length - 5); j--) {
        const lastLine = lines[j];
        // Проверяем что это имя (начинается с заглавной буквы, может содержать инициалы)
        if (lastLine && lastLine.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.?)+$/)) {
          result.recipientName = lastLine;
          break;
        }
      }
    }
  }

  /**
   * Извлекает поля из последовательной структуры
   */
  private extractSequentialFields(lines: string[], result: TinkoffReceiptData): void {
    // В последовательной структуре значения могут быть как после лейблов, так и между ними
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    
    // Находим индексы лейблов
    const labelIndices: {[key: string]: number} = {};
    labels.forEach(label => {
      const idx = lines.indexOf(label);
      if (idx !== -1) labelIndices[label] = idx;
    });
    
    // Для каждого лейбла ищем значение сразу после него
    Object.entries(labelIndices).forEach(([label, idx]) => {
      // Проверяем следующие строки после лейбла
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        
        // Пропускаем другие лейблы
        if (labels.includes(line)) continue;
        
        // Пропускаем служебные строки
        if (line.startsWith('Идентификатор операции') || line === 'СБП' || line.startsWith('Квитанция')) {
          break;
        }
        
        // Проверяем и присваиваем значение в зависимости от лейбла
        switch(label) {
          case 'Комиссия':
            if (result.commission === undefined && (line === 'Без комиссии' || line.match(/^\d+$/))) {
              result.commission = line === 'Без комиссии' ? 0 : parseInt(line);
              break;
            }
            continue;
            
          case 'Отправитель':
            if (!result.senderName && line.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/)) {
              result.senderName = line;
              break;
            }
            continue;
            
          case 'Телефон получателя':
            if (!result.recipientPhone && line.match(/^\+7/)) {
              result.recipientPhone = line;
              break;
            }
            continue;
            
          case 'Получатель':
            // Для блока из 3 лейблов подряд (Получатель, Банк получателя, Счет списания)
            // значения идут после последнего лейбла в том же порядке
            if (labelIndices['Банк получателя'] === idx + 1 && labelIndices['Счет списания'] === idx + 2) {
              // Это блок из 3 лейблов подряд, ищем значения после последнего
              const valuesStart = idx + 3;
              if (valuesStart < lines.length && !result.recipientName) {
                const recipientLine = lines[valuesStart];
                if (recipientLine && recipientLine.match(/^[А-ЯЁ][а-яё]+/) && !recipientLine.includes('@')) {
                  result.recipientName = recipientLine;
                }
              }
              if (valuesStart + 1 < lines.length && !result.recipientBank) {
                const bankLine = lines[valuesStart + 1];
                if (bankLine && (bankLine.includes('банк') || bankLine.includes('Банк'))) {
                  result.recipientBank = bankLine;
                }
              }
              if (valuesStart + 2 < lines.length && !result.senderAccount) {
                const accountLine = lines[valuesStart + 2];
                if (accountLine && accountLine.includes('****')) {
                  result.senderAccount = accountLine;
                }
              }
              break;
            } else if (!result.recipientName && line.match(/^[А-ЯЁ][а-яё]+/) && !line.includes('@')) {
              // Обычный случай - значение сразу после лейбла
              result.recipientName = line;
              break;
            }
            continue;
            
          case 'Банк получателя':
            // Пропускаем если это часть блока из 3 лейблов (уже обработано выше)
            if (labelIndices['Получатель'] === idx - 1 && labelIndices['Счет списания'] === idx + 1) {
              break;
            }
            if (!result.recipientBank && (line.includes('банк') || line.includes('Банк'))) {
              result.recipientBank = line;
              break;
            }
            continue;
            
          case 'Счет списания':
            // Пропускаем если это часть блока из 3 лейблов (уже обработано выше)
            if (labelIndices['Получатель'] === idx - 2 && labelIndices['Банк получателя'] === idx - 1) {
              break;
            }
            if (!result.senderAccount && line.includes('****')) {
              result.senderAccount = line;
              break;
            }
            continue;
        }
        
        // Если нашли значение, прерываем цикл для этого лейбла
        break;
      }
    });
    
    // Специальная обработка для имени получателя в конце документа (для некоторых форматов)
    if (result.transferType === 'По номеру телефона' && !result.recipientName) {
      // Ищем имя получателя в последних строках (после email поддержки)
      for (let j = lines.length - 1; j >= Math.max(0, lines.length - 5); j--) {
        const lastLine = lines[j];
        // Проверяем что это имя (начинается с заглавной буквы, может содержать инициалы)
        if (lastLine && lastLine.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.?)+$/)) {
          result.recipientName = lastLine;
          break;
        }
      }
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