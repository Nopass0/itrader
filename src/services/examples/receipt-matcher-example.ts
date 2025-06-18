/**
 * Пример использования ReceiptMatcher для сопоставления payout с чеками
 */

import { ReceiptMatcher, matchPayoutWithReceipt } from "../receiptMatcher";

async function example() {
  // Способ 1: Использование функции
  const transactionId = "some-transaction-id";
  const receiptPath = "/path/to/receipt.pdf";
  
  const matches = await matchPayoutWithReceipt(transactionId, receiptPath);
  
  if (matches) {
    console.log("✅ Чек соответствует транзакции payout");
  } else {
    console.log("❌ Чек НЕ соответствует транзакции payout");
  }
  
  // Способ 2: Использование класса (больше контроля)
  const matcher = new ReceiptMatcher();
  
  // Можно использовать с файлом
  const result1 = await matcher.matchPayoutWithReceipt(
    transactionId,
    receiptPath
  );
  
  // Или с буфером (например, из email attachment)
  const receiptBuffer = Buffer.from("..."); // PDF данные
  const result2 = await matcher.matchPayoutWithReceiptBuffer(
    transactionId,
    receiptBuffer
  );
}

// Пример интеграции с обработкой email
async function processEmailWithReceipt(
  emailAttachment: Buffer,
  transactionId: string
) {
  const matcher = new ReceiptMatcher();
  
  try {
    const isMatch = await matcher.matchPayoutWithReceiptBuffer(
      transactionId,
      emailAttachment
    );
    
    if (isMatch) {
      console.log("Чек подтвержден для транзакции:", transactionId);
      // Обновить статус транзакции в БД
      // await updateTransactionStatus(transactionId, "CONFIRMED");
    } else {
      console.log("Чек не подходит для транзакции:", transactionId);
      // Логировать несоответствие
      // await logMismatch(transactionId, "Receipt mismatch");
    }
  } catch (error) {
    console.error("Ошибка при проверке чека:", error);
  }
}

/**
 * Что проверяет функция:
 * 
 * 1. Статус чека - всегда должен быть "Успешно"
 * 2. Дата чека - должна быть после создания payout (с учетом московского времени)
 * 3. Банк - сопоставление по алиасам (Альфа-Банк = alfabank и т.д.)
 * 4. Wallet - телефон или последние 4 цифры карты
 * 5. Сумма - точное совпадение с полем 643 из amountTrader
 * 
 * Возвращает true только если ВСЕ проверки пройдены
 */