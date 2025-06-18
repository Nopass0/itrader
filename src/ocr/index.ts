/**
 * OCR модуль для обработки чеков
 *
 * Поддерживает:
 * - Извлечение текста из PDF чеков
 * - OCR изображений с помощью Tesseract
 * - Парсинг данных чека (сумма, банк, телефон, карта и т.д.)
 * - Валидацию чеков
 * - Сравнение с транзакциями
 * - Типизированный парсинг чеков Тинькофф
 *
 * @example
 * ```typescript
 * import { OcrProcessor } from './ocr';
 *
 * const processor = new OcrProcessor();
 *
 * // Обработка чека
 * const receiptData = await processor.processReceipt('receipt.pdf');
 *
 * // Обработка с ожидаемой суммой
 * const amount = new Decimal('1000.50');
 * const receipt = await processor.processReceiptWithAmount('receipt.pdf', amount);
 *
 * // Сравнение с транзакцией
 * const matches = await processor.compareWithTransaction(
 *   receipt,
 *   '+79001234567',
 *   'T-Bank',
 *   amount
 * );
 * ```
 *
 * @example Типизированный парсер Тинькофф
 * ```typescript
 * import { TinkoffReceiptParser, TransferType } from './ocr';
 *
 * const parser = new TinkoffReceiptParser();
 * const receipt = await parser.parseReceiptFromFile('receipt.pdf');
 *
 * // TypeScript автоматически определит тип
 * if (receipt.transferType === TransferType.BY_PHONE) {
 *   console.log('Телефон:', receipt.recipientPhone);
 *   console.log('Банк:', receipt.recipientBank);
 * }
 * ```
 */

import { Decimal } from "decimal.js";
import * as fs from "fs/promises";
import { ReceiptProcessor } from "./processor";
import { PDFParser } from "./pdfParser";
import {
  type ReceiptData,
  type ReceiptInfo,
  type TransactionMatchParams,
  OcrError,
  ValidationError,
} from "./types/models";
import { validateAmount } from "./utils/validators";

/**
 * Основной класс для работы с OCR
 */
export class OcrProcessor {
  private processor: ReceiptProcessor;

  constructor() {
    this.processor = new ReceiptProcessor();
  }

  /**
   * Обрабатывает чек из файла
   * @param receiptPath - Путь к файлу чека
   * @returns Данные чека
   */
  async processReceipt(receiptPath: string): Promise<ReceiptData> {
    const receiptData = await fs.readFile(receiptPath);
    const expectedAmount = new Decimal(0); // Будет предоставлена вызывающей стороной
    return this.processor.processReceipt(receiptData, expectedAmount);
  }

  /**
   * Обрабатывает чек с ожидаемой суммой
   * @param receiptPath - Путь к файлу чека
   * @param expectedAmount - Ожидаемая сумма
   * @returns Данные чека
   */
  async processReceiptWithAmount(
    receiptPath: string,
    expectedAmount: Decimal,
  ): Promise<ReceiptData> {
    const receiptData = await fs.readFile(receiptPath);
    return this.processor.processReceipt(receiptData, expectedAmount);
  }

  /**
   * Сравнивает чек с транзакцией
   * @param params - Параметры для сравнения
   * @returns true если чек соответствует транзакции
   */
  async compareWithTransaction(
    params: TransactionMatchParams,
  ): Promise<boolean> {
    const { receipt, wallet, bankName, amount } = params;

    // Проверяем успешность чека
    if (!ReceiptProcessor.isSuccessful(receipt)) {
      return false;
    }

    // Сравниваем сумму
    if (!validateAmount(receipt.amount, amount)) {
      return false;
    }

    // Сравниваем телефон или номер карты
    let walletMatches = false;

    if (receipt.phone) {
      // Нормализуем телефоны для сравнения
      const normalizedPhone = receipt.phone.replace(/\D/g, "");
      const normalizedWallet = wallet.replace(/\D/g, "");

      // Проверяем, является ли wallet телефоном (10-11 цифр)
      if (normalizedWallet.length >= 10 && normalizedWallet.length <= 11) {
        walletMatches =
          normalizedPhone.endsWith(normalizedWallet) ||
          normalizedWallet.endsWith(normalizedPhone);
      }
    } else if (receipt.cardNumber) {
      // Проверяем последние 4 цифры карты
      walletMatches = wallet.endsWith(receipt.cardNumber);
    }

    if (!walletMatches) {
      return false;
    }

    // Сравниваем банк если указан
    if (bankName) {
      const bankLower = receipt.bank.toLowerCase();
      const expectedBankLower = bankName.toLowerCase();

      if (
        !bankLower.includes(expectedBankLower) &&
        !expectedBankLower.includes(bankLower)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Преобразует данные чека в JSON
   */
  toJson(receipt: ReceiptData): any {
    return ReceiptProcessor.toJson(receipt);
  }

  /**
   * Проверяет, успешен ли чек
   */
  isSuccessful(receipt: ReceiptData): boolean {
    return ReceiptProcessor.isSuccessful(receipt);
  }
}

// Экспортируем основные классы и типы
export { ReceiptProcessor, PDFParser };
export * from "./types/models";
export * from "./utils/validators";
export {
  extractTextFromPdf,
  extractTextFromPdfBuffer,
} from "./utils/textExtractor";

// Экспортируем новый типизированный парсер
export { 
  TinkoffReceiptParser, 
  type ParsedReceipt,
  type PhoneTransferReceipt,
  type TBankTransferReceipt,
  type CardTransferReceipt,
  TransferType,
  ReceiptParseError
} from "./receiptParser";
