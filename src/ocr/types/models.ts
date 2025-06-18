/**
 * Типы и интерфейсы для OCR модуля
 */

import { Decimal } from 'decimal.js';

/**
 * Данные извлеченные из чека
 */
export interface ReceiptData {
  amount: Decimal;
  bank: string;
  reference: string;
  timestamp: Date;
  phone?: string;
  cardNumber?: string;
  status?: string;
  rawText?: string;
}

/**
 * Информация о чеке из PDF
 */
export interface ReceiptInfo {
  dateTime: Date;
  amount: Decimal;
  recipient?: string;
  sender?: string;
  transactionId?: string;
  bankName?: string;
  cardNumber?: string;
  phoneNumber?: string;
  status?: string;
  rawText: string;
}

/**
 * Опции для OCR процессора
 */
export interface OcrProcessorOptions {
  tesseractLang?: string;
  tesseractPsm?: number;
  tempDir?: string;
}

/**
 * Результат валидации чека
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Параметры для сравнения с транзакцией
 */
export interface TransactionMatchParams {
  receipt: ReceiptData;
  wallet: string;
  bankName?: string;
  amount: Decimal;
}

/**
 * Ошибки OCR
 */
export class OcrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}