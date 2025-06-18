/**
 * Процессор чеков с OCR
 */

import { Decimal } from "decimal.js";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  type ReceiptData,
  OcrError,
  ValidationError,
  type OcrProcessorOptions,
} from "./types/models";
import { extractAmountFromText, validateReceiptData } from "./utils/validators";
import { extractTextFromPdf } from "./utils/textExtractor";

const execAsync = promisify(exec);

/**
 * Процессор чеков с поддержкой OCR
 */
export class ReceiptProcessor {
  private tesseractLang: string;
  private tesseractPsm: number;
  private tempDir: string;

  constructor(options: OcrProcessorOptions = {}) {
    this.tesseractLang = options.tesseractLang || "rus+eng";
    this.tesseractPsm = options.tesseractPsm || 6;
    this.tempDir = options.tempDir || os.tmpdir();
  }

  /**
   * Обрабатывает чек
   * @param imageData - Данные изображения или PDF
   * @param expectedAmount - Ожидаемая сумма
   * @returns Данные чека
   */
  async processReceipt(
    imageData: Buffer,
    expectedAmount: Decimal,
  ): Promise<ReceiptData> {
    console.log(`[OCR] Обработка чека, ожидаемая сумма: ${expectedAmount}`);

    // Проверяем, является ли это PDF
    if (imageData.subarray(0, 4).toString() === "%PDF") {
      return this.processPdfReceipt(imageData, expectedAmount);
    }

    // Обрабатываем как изображение
    return this.processImageReceipt(imageData, expectedAmount);
  }

  /**
   * Обрабатывает PDF чек
   */
  private async processPdfReceipt(
    pdfData: Buffer,
    expectedAmount: Decimal,
  ): Promise<ReceiptData> {
    console.log("[OCR] Обработка PDF чека");

    // Сохраняем во временный файл
    const tempFile = path.join(this.tempDir, `receipt_${uuidv4()}.pdf`);

    try {
      await fs.writeFile(tempFile, pdfData);

      // Извлекаем текст
      const text = await extractTextFromPdf(tempFile);
      console.log(
        "[OCR] Извлечен текст из PDF:",
        text.substring(0, 200) + "...",
      );

      // Парсим данные чека
      return this.parseReceiptText(text, expectedAmount);
    } finally {
      // Удаляем временный файл
      try {
        await fs.unlink(tempFile);
      } catch (e: unknown) {
        console.warn("Не удалось удалить временный файл:", e);
      }
    }
  }

  /**
   * Обрабатывает изображение чека с помощью Tesseract
   */
  private async processImageReceipt(
    imageData: Buffer,
    expectedAmount: Decimal,
  ): Promise<ReceiptData> {
    console.log("[OCR] Обработка изображения чека с Tesseract");

    // Сохраняем во временный файл
    const tempFile = path.join(this.tempDir, `receipt_${uuidv4()}.png`);

    try {
      await fs.writeFile(tempFile, imageData);

      // Запускаем Tesseract
      const command = `tesseract "${tempFile}" stdout -l ${this.tesseractLang} --psm ${this.tesseractPsm}`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes("Warning")) {
        throw new OcrError(`Ошибка Tesseract: ${stderr}`);
      }

      console.log(
        "[OCR] Tesseract извлек текст:",
        stdout.substring(0, 200) + "...",
      );

      // Парсим данные чека
      return this.parseReceiptText(stdout, expectedAmount);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        throw new OcrError(
          "Tesseract не установлен. Установите: apt-get install tesseract-ocr tesseract-ocr-rus",
        );
      }
      throw error;
    } finally {
      // Удаляем временный файл
      try {
        await fs.unlink(tempFile);
      } catch (e: unknown) {
        console.warn("Не удалось удалить временный файл:", e);
      }
    }
  }

  /**
   * Парсит текст чека
   */
  private parseReceiptText(text: string, expectedAmount: Decimal): ReceiptData {
    // Извлекаем сумму
    const amount = extractAmountFromText(text, expectedAmount);

    // Извлекаем банк
    const bank = this.extractBankName(text);

    // Извлекаем референс
    const reference = this.extractReference(text);

    // Извлекаем timestamp
    const timestamp = this.extractTimestamp(text) || new Date();

    // Извлекаем телефон
    const phone = this.extractPhoneNumber(text);

    // Извлекаем номер карты
    const cardNumber = this.extractCardNumber(text);

    // Извлекаем статус
    const status = this.extractStatus(text);

    const receipt: ReceiptData = {
      amount,
      bank,
      reference,
      timestamp,
      phone,
      cardNumber,
      status,
      rawText: text,
    };

    // Валидируем данные
    validateReceiptData(receipt, expectedAmount);

    return receipt;
  }

  /**
   * Извлекает название банка
   */
  private extractBankName(text: string): string {
    const textLower = text.toLowerCase();

    const banks = [
      { patterns: ["т-банк", "t-bank", "тинькофф", "tinkoff"], name: "T-Bank" },
      { patterns: ["сбербанк", "сбер", "sberbank", "sber"], name: "Sberbank" },
      {
        patterns: ["альфа-банк", "альфа банк", "alfa-bank", "alfa bank"],
        name: "Alfa-Bank",
      },
      { patterns: ["райффайзен", "raiffeisen"], name: "Raiffeisen" },
      { patterns: ["втб", "vtb"], name: "VTB" },
      { patterns: ["газпромбанк", "gazprombank"], name: "Gazprombank" },
      { patterns: ["открытие", "otkritie"], name: "Otkritie" },
      {
        patterns: ["россельхозбанк", "rosselkhozbank"],
        name: "Rosselkhozbank",
      },
      { patterns: ["почта банк", "pochta bank"], name: "Pochta Bank" },
      { patterns: ["qiwi", "киви"], name: "QIWI" },
      { patterns: ["юмани", "yoomoney", "яндекс.деньги"], name: "YooMoney" },
    ];

    for (const bank of banks) {
      for (const pattern of bank.patterns) {
        if (textLower.includes(pattern)) {
          return bank.name;
        }
      }
    }

    return "Unknown Bank";
  }

  /**
   * Извлекает референс
   */
  private extractReference(text: string): string {
    const patterns = [
      /(?:номер операции|операция|transaction|чек|квитанция|reference)[:\s]*([\d\-A-Za-z]+)/i,
      /№\s*([\d\-A-Za-z]+)/,
      /ID[:\s]*([\d\-A-Za-z]+)/i,
      /([\d]{6,})/, // Минимум 6 цифр
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const ref = match[1].trim();
        if (ref.length >= 6) {
          return ref;
        }
      }
    }

    // Генерируем референс если не найден
    return `AUTO-${Date.now()}`;
  }

  /**
   * Извлекает номер телефона
   */
  private extractPhoneNumber(text: string): string | undefined {
    const patterns = [
      /\+7\s*\(?\d{3}\)?\s*\d{3}[-\s]?\d{2}[-\s]?\d{2}/,
      /8\s*\(?\d{3}\)?\s*\d{3}[-\s]?\d{2}[-\s]?\d{2}/,
      /\+7\d{10}/,
      /8\d{10}/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let phone = match[0].replace(/[^\d+]/g, "");

        // Нормализуем к формату +7
        if (phone.startsWith("8") && phone.length === 11) {
          phone = "+7" + phone.substring(1);
        }

        return phone;
      }
    }

    return undefined;
  }

  /**
   * Извлекает номер карты
   */
  private extractCardNumber(text: string): string | undefined {
    const patterns = [
      /\*+\s*(\d{4})\b/,
      /(?:карта|card|счет|счёт).*?(\d{4})\b/i,
      /(?:заканчивается на|ending with|оканчивается)\s*(\d{4})/i,
      /\b(\d{4})\s*(?:карта|card)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Извлекает статус
   */
  private extractStatus(text: string): string | undefined {
    const textLower = text.toLowerCase();

    const statusPatterns = [
      {
        patterns: [
          "успешно",
          "успешный",
          "успешная",
          "выполнено",
          "completed",
          "success",
        ],
        status: "Успешно",
      },
      {
        patterns: ["отклонено", "отклонен", "declined", "rejected", "failed"],
        status: "Отклонено",
      },
      {
        patterns: ["в обработке", "обрабатывается", "processing", "pending"],
        status: "В обработке",
      },
      {
        patterns: ["отменено", "отменен", "cancelled", "canceled"],
        status: "Отменено",
      },
    ];

    for (const { patterns, status } of statusPatterns) {
      for (const pattern of patterns) {
        if (textLower.includes(pattern)) {
          return status;
        }
      }
    }

    return undefined;
  }

  /**
   * Извлекает timestamp
   */
  private extractTimestamp(text: string): Date | undefined {
    const patterns = [
      {
        regex: /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/,
        parser: (m: RegExpMatchArray) => {
          const [, day, month, year, hours, minutes, seconds = "0"] = m;
          return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
        },
      },
      {
        regex: /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/,
        parser: (m: RegExpMatchArray) => {
          const [, year, month, day, hours, minutes, seconds = "0"] = m;
          return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
        },
      },
    ];

    for (const { regex, parser } of patterns) {
      const match = text.match(regex);
      if (match) {
        try {
          return parser(match);
        } catch (e: unknown) {
          console.warn("Ошибка парсинга даты:", e);
        }
      }
    }

    return undefined;
  }

  /**
   * Преобразует данные чека в JSON
   */
  static toJson(receipt: ReceiptData): any {
    return {
      amount: receipt.amount.toString(),
      bank: receipt.bank,
      reference: receipt.reference,
      timestamp: receipt.timestamp.toISOString(),
      phone: receipt.phone,
      cardNumber: receipt.cardNumber,
      status: receipt.status,
    };
  }

  /**
   * Проверяет, успешен ли чек
   */
  static isSuccessful(receipt: ReceiptData): boolean {
    return receipt.status === "Успешно";
  }
}
