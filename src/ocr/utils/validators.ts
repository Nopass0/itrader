/**
 * Валидаторы для OCR данных
 */

import { Decimal } from "decimal.js";
import { type ReceiptData, ValidationError } from "../types/models";

/**
 * Валидирует чек T-Bank
 * @param text - Текст чека
 * @returns true если это чек T-Bank
 */
export function validateTBankReceipt(text: string): boolean {
  const tbankPatterns = [
    "Т-Банк",
    "T-Bank",
    "Тинькофф",
    "Tinkoff",
    "t-bank",
    "т-банк",
    "тиньк",
    "fb@tbank.ru",
  ];

  const lowerText = text.toLowerCase();
  return tbankPatterns.some((pattern) =>
    lowerText.includes(pattern.toLowerCase()),
  );
}

/**
 * Извлекает сумму из текста
 * @param text - Текст для анализа
 * @param expectedAmount - Ожидаемая сумма
 * @returns Извлеченная сумма
 */
export function extractAmountFromText(
  text: string,
  expectedAmount: Decimal,
): Decimal {
  // Нормализуем текст
  const normalized = text.replace(/\s+/g, " ");

  // Паттерны для поиска суммы
  const patterns = [
    // Сумма: 10 000,00 руб
    /(?:сумма|amount|итого|total)[:\s]*([0-9\s]+[,.]?[0-9]*)\s*(?:руб|rub|₽)?/gi,
    // 10 000,00 руб
    /([0-9]{1,3}(?:[\s,][0-9]{3})*(?:[.,][0-9]{1,2})?)\s*(?:руб|rub|₽)/gi,
    // ₽ 10,000.00
    /(?:₽|rub)\s*([0-9]{1,3}(?:[\s,][0-9]{3})*(?:[.,][0-9]{1,2})?)/gi,
    // Простые числа
    /([0-9]+(?:[.,][0-9]{1,2})?)/g,
  ];

  const foundAmounts: Decimal[] = [];

  for (const pattern of patterns) {
    const matches = normalized.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const amountStr = match[1].replace(/\s/g, "").replace(",", ".");

        try {
          const amount = new Decimal(amountStr);
          // Фильтруем слишком маленькие или большие суммы
          if (amount.gte(100) && amount.lte(10000000)) {
            foundAmounts.push(amount);
          }
        } catch (e: unknown) {
          // Игнорируем ошибки парсинга
        }
      }
    }
  }

  if (foundAmounts.length === 0) {
    throw new ValidationError("Не найдена сумма в чеке");
  }

  // Если expectedAmount = 0, возвращаем первую найденную сумму
  if (expectedAmount.isZero()) {
    return foundAmounts[0];
  }

  // Ищем сумму, наиболее близкую к ожидаемой
  let bestMatch = foundAmounts[0];
  let bestDiff = bestMatch.minus(expectedAmount).abs();

  for (const amount of foundAmounts.slice(1)) {
    const diff = amount.minus(expectedAmount).abs();
    if (diff.lt(bestDiff)) {
      bestMatch = amount;
      bestDiff = diff;
    }
  }

  // Проверяем, что разница не слишком большая (10% допуск для OCR)
  const maxTolerance = expectedAmount.mul(0.1);
  if (bestDiff.gt(maxTolerance)) {
    throw new ValidationError(
      `Сумма ${bestMatch} слишком отличается от ожидаемой ${expectedAmount}`,
    );
  }

  return bestMatch;
}

/**
 * Валидирует сумму
 * @param ocrAmount - Сумма из OCR
 * @param expectedAmount - Ожидаемая сумма
 * @returns true если суммы совпадают с учетом допуска
 */
export function validateAmount(
  ocrAmount: Decimal,
  expectedAmount: Decimal,
): boolean {
  // Допуск 0.01% для ошибок OCR
  const tolerance = expectedAmount.mul(0.0001);
  const minAllowed = expectedAmount.minus(tolerance);
  const maxAllowed = expectedAmount.plus(tolerance);

  return ocrAmount.gte(minAllowed) && ocrAmount.lte(maxAllowed);
}

/**
 * Валидирует данные чека
 * @param receipt - Данные чека
 * @param expectedAmount - Ожидаемая сумма
 */
export function validateReceiptData(
  receipt: ReceiptData,
  expectedAmount: Decimal,
): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Проверяем сумму
  if (!validateAmount(receipt.amount, expectedAmount)) {
    errors.push(
      `Сумма чека ${receipt.amount} не совпадает с ожидаемой ${expectedAmount}`,
    );
  }

  // Проверяем банк
  if (receipt.bank === "Unknown Bank") {
    warnings.push("Не удалось определить банк из чека");
  }

  // Проверяем reference
  if (receipt.reference.startsWith("AUTO-")) {
    warnings.push(
      `Используется автосгенерированный reference: ${receipt.reference}`,
    );
  }

  // Проверяем timestamp
  const now = new Date();
  const age = now.getTime() - receipt.timestamp.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (age > sevenDays) {
    errors.push("Чек старше 7 дней");
  }

  if (age < 0) {
    errors.push("Дата чека в будущем");
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join("; "));
  }

  // Логируем предупреждения
  if (warnings.length > 0) {
    console.warn("Предупреждения валидации чека:", warnings);
  }
}

/**
 * Извлекает сумму из текста (упрощенная версия)
 * @param text - Текст для анализа
 * @returns Извлеченная сумма или undefined
 */
export function extractAmount(text: string): Decimal | undefined {
  try {
    return extractAmountFromText(text, new Decimal(0));
  } catch {
    // Намеренно игнорируем ошибку
    return undefined;
  }
}
