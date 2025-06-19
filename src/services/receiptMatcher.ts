/**
 * Сервис для сопоставления payout транзакций с чеками
 */

import { PrismaClient } from "../../generated/prisma";
import { TinkoffReceiptParser, TransferType, type ParsedReceipt } from "../ocr";

const prisma = new PrismaClient();

// Интерфейс для банка из payout
interface PayoutBank {
  id: number;
  name: string;
  code: string;
  label: string;
  active: boolean;
  meta?: any;
}

// Интерфейс для суммы из payout
interface AmountTrader {
  "643": number; // RUB
  "000001"?: number;
}

// Маппинг названий банков для сопоставления
const BANK_MAPPING: Record<string, string[]> = {
  "alfabank": ["альфа", "alfa", "альфа-банк", "alfa-bank", "альфабанк", "альфа банк"],
  "yandexbank": ["яндекс", "yandex", "яндекс банк", "yandex bank", "я.банк"],
  "ozonbank": ["озон", "ozon", "озон банк", "ozon bank", "озонбанк"],
  "tbank": ["т-банк", "t-bank", "тинькофф", "tinkoff", "т банк", "тбанк"],
  "sberbank": ["сбер", "sber", "сбербанк", "sberbank", "сбер банк"],
  "vtb": ["втб", "vtb", "втб банк", "vtb bank"]
};

export class ReceiptMatcher {
  private parser: TinkoffReceiptParser;

  constructor() {
    this.parser = new TinkoffReceiptParser();
  }

  /**
   * Сопоставляет payout транзакцию с чеком
   * @param transactionId - ID транзакции
   * @param receiptPath - Путь к PDF чеку
   * @returns true если чек соответствует транзакции, false если нет
   */
  async matchPayoutWithReceipt(
    transactionId: string,
    receiptPath: string
  ): Promise<boolean> {
    try {
      // Получаем транзакцию с payout данными
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { payout: true }
      });

      if (!transaction || !transaction.payout) {
        console.error("Transaction or payout not found");
        return false;
      }

      const payout = transaction.payout;

      // Парсим чек
      let receipt: ParsedReceipt;
      try {
        receipt = await this.parser.parseFromFile(receiptPath);
      } catch (error) {
        console.error("Failed to parse receipt:", error);
        return false;
      }

      // 1. Проверяем статус - должен быть SUCCESS
      if (receipt.status !== "SUCCESS") {
        console.log("Receipt status is not SUCCESS");
        return false;
      }

      // 2. Проверяем дату - сравниваем только даты без времени
      // Время в чеке московское (UTC+3)
      const payoutDate = new Date(payout.createdAt);
      const receiptDate = receipt.datetime;
      
      // Конвертируем время чека в UTC
      const receiptDateUTC = new Date(receiptDate.getTime() - 3 * 60 * 60 * 1000);
      
      // Получаем только даты без времени
      const payoutDateOnly = new Date(payoutDate.getFullYear(), payoutDate.getMonth(), payoutDate.getDate());
      const receiptDateOnly = new Date(receiptDateUTC.getFullYear(), receiptDateUTC.getMonth(), receiptDateUTC.getDate());
      
      // Чек должен быть создан в тот же день или позже
      if (receiptDateOnly < payoutDateOnly) {
        console.log("Receipt date is before payout date (comparing dates only)");
        return false;
      }

      // 3. Проверяем банк
      const payoutBank = JSON.parse(payout.bank) as PayoutBank;
      if (!this.matchBank(payoutBank, receipt)) {
        console.log("Bank mismatch");
        return false;
      }

      // 4. Проверяем wallet (телефон или карта)
      if (!this.matchWallet(payout.wallet, receipt)) {
        console.log("Wallet mismatch");
        return false;
      }

      // 5. Проверяем сумму
      const amountTrader = JSON.parse(payout.amountTrader) as AmountTrader;
      const payoutAmount = amountTrader["643"]; // RUB
      
      if (payoutAmount !== receipt.amount) {
        console.log(`Amount mismatch: payout ${payoutAmount} vs receipt ${receipt.amount}`);
        return false;
      }

      // Все проверки пройдены
      return true;

    } catch (error) {
      console.error("Error matching payout with receipt:", error);
      return false;
    }
  }

  /**
   * Сопоставляет банк из payout с банком в чеке
   */
  private matchBank(payoutBank: PayoutBank, receipt: ParsedReceipt): boolean {
    // Для переводов клиенту Т-Банка банк всегда Т-Банк
    if (receipt.transferType === TransferType.TO_TBANK) {
      const payoutBankName = payoutBank.name.toLowerCase();
      // Проверяем что payout тоже для Т-Банка
      return payoutBankName === "tbank" || 
             BANK_MAPPING["tbank"].some(alias => 
               payoutBank.label.toLowerCase().includes(alias)
             );
    }

    // Для переводов на карту банк не указывается в чеке
    if (receipt.transferType === TransferType.TO_CARD) {
      return true; // Пропускаем проверку банка для карточных переводов
    }

    // Для переводов по телефону проверяем recipientBank
    if (receipt.transferType === TransferType.BY_PHONE && receipt.recipientBank) {
      const receiptBankLower = receipt.recipientBank.toLowerCase();
      const payoutBankName = payoutBank.name.toLowerCase();

      // Получаем алиасы для банка из payout
      const payoutAliases = BANK_MAPPING[payoutBankName] || [];
      
      // Проверяем, содержит ли название банка из чека любой из алиасов payout банка
      for (const alias of payoutAliases) {
        if (receiptBankLower.includes(alias)) {
          return true;
        }
      }

      // Дополнительная проверка: ищем какой банк упоминается в чеке
      for (const [bankKey, aliases] of Object.entries(BANK_MAPPING)) {
        for (const alias of aliases) {
          if (receiptBankLower.includes(alias)) {
            // Нашли банк в чеке, проверяем совпадает ли с payout
            return bankKey === payoutBankName;
          }
        }
      }

      // Если не нашли по алиасам, проверяем прямое вхождение названия
      if (receiptBankLower.includes(payoutBankName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Сопоставляет wallet (телефон или карта)
   */
  private matchWallet(payoutWallet: string, receipt: ParsedReceipt): boolean {
    const wallet = payoutWallet.trim();
    
    console.log('[ReceiptMatcher] matchWallet:', {
      payoutWallet,
      receiptType: receipt.transferType,
      recipientPhone: (receipt as any).recipientPhone,
      recipientCard: (receipt as any).recipientCard
    });

    // Проверяем тип перевода
    switch (receipt.transferType) {
      case TransferType.BY_PHONE:
        // Сравниваем телефоны
        const phone = (receipt as any).recipientPhone;
        if (!phone) {
          console.log('[ReceiptMatcher] No recipientPhone in receipt');
          return false;
        }
        
        // Нормализуем телефоны для сравнения
        const normalizedWallet = wallet.replace(/\D/g, "");
        const normalizedReceiptPhone = phone.replace(/\D/g, "");
        
        // Сравниваем последние 10 цифр (без кода страны)
        const walletLast10 = normalizedWallet.slice(-10);
        const phoneLast10 = normalizedReceiptPhone.slice(-10);
        
        return walletLast10 === phoneLast10;

      case TransferType.TO_TBANK:
      case TransferType.TO_CARD:
        // Сравниваем карты по последним 4 цифрам
        if (!receipt.recipientCard) return false;
        
        // Извлекаем последние 4 цифры из wallet
        const walletLast4 = wallet.slice(-4);
        
        // Извлекаем последние 4 цифры из карты в чеке
        const cardLast4 = receipt.recipientCard.replace(/\D/g, "").slice(-4);
        
        return walletLast4 === cardLast4;

      default:
        return false;
    }
  }

  /**
   * Сопоставляет payout с чеком из Buffer
   */
  async matchPayoutWithReceiptBuffer(
    transactionId: string,
    receiptBuffer: Buffer
  ): Promise<boolean> {
    try {
      // Получаем транзакцию с payout данными
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { payout: true }
      });

      if (!transaction || !transaction.payout) {
        console.error("Transaction or payout not found");
        return false;
      }

      const payout = transaction.payout;

      // Парсим чек
      let receipt: ParsedReceipt;
      try {
        receipt = await this.parser.parseFromBuffer(receiptBuffer);
      } catch (error) {
        console.error("Failed to parse receipt:", error);
        return false;
      }

      // Используем ту же логику проверки
      return this.performMatching(payout, receipt);
    } catch (error) {
      console.error("Error matching payout with receipt buffer:", error);
      return false;
    }
  }

  /**
   * Выполняет сопоставление payout с распарсенным чеком
   */
  private performMatching(payout: any, receipt: ParsedReceipt): boolean {
    console.log('[ReceiptMatcher] performMatching called with:', {
      payoutId: payout.id,
      receiptAmount: receipt.amount,
      receiptStatus: receipt.status
    });
    
    // 1. Проверяем статус
    if (receipt.status !== "SUCCESS") {
      console.log('[ReceiptMatcher] Receipt status is not SUCCESS:', receipt.status);
      return false;
    }

    // 2. Проверяем дату - сравниваем только даты без времени
    const payoutDate = new Date(payout.createdAt);
    // Поддерживаем и datetime (из ParsedReceipt) и transactionDate (из parsedData)
    const receiptDateRaw = receipt.datetime || (receipt as any).transactionDate;
    if (!receiptDateRaw) {
      return false;
    }
    const receiptDate = new Date(receiptDateRaw);
    const receiptDateUTC = new Date(receiptDate.getTime() - 3 * 60 * 60 * 1000);
    
    // Получаем только даты без времени
    const payoutDateOnly = new Date(payoutDate.getFullYear(), payoutDate.getMonth(), payoutDate.getDate());
    const receiptDateOnly = new Date(receiptDateUTC.getFullYear(), receiptDateUTC.getMonth(), receiptDateUTC.getDate());
    
    // Чек должен быть создан в тот же день или позже
    if (receiptDateOnly < payoutDateOnly) {
      return false;
    }

    // 3. Проверяем банк
    const payoutBank = typeof payout.bank === 'string' 
      ? JSON.parse(payout.bank) as PayoutBank
      : payout.bank as PayoutBank;
    if (!this.matchBank(payoutBank, receipt)) {
      return false;
    }

    // 4. Проверяем wallet
    if (!this.matchWallet(payout.wallet, receipt)) {
      return false;
    }

    // 5. Проверяем сумму
    const amountTrader = typeof payout.amountTrader === 'string'
      ? JSON.parse(payout.amountTrader) as AmountTrader
      : payout.amountTrader as AmountTrader;
    const payoutAmount = amountTrader["643"];
    
    if (payoutAmount !== receipt.amount) {
      return false;
    }

    return true;
  }

  /**
   * Match receipt to any transaction
   * Returns transaction and payout IDs if match found
   */
  async matchReceiptToTransaction(receipt: any): Promise<{
    success: boolean;
    transactionId?: string;
    payoutId?: string;
    confidence?: number;
  }> {
    try {
      // Get all active transactions with payouts
      const transactions = await prisma.transaction.findMany({
        where: {
          status: {
            in: ['pending', 'chat_started', 'waiting_payment', 'payment_confirmed']
          },
          payout: {
            status: {
              in: [5, 7] // Waiting confirmation or processing
            }
          }
        },
        include: {
          payout: true
        }
      });

      console.log(`[ReceiptMatcher] Checking receipt against ${transactions.length} active transactions`);

      for (const transaction of transactions) {
        if (!transaction.payout) continue;

        // Parse receipt if raw text provided
        let parsedReceipt: ParsedReceipt;
        if (receipt.rawText && !receipt.parsedData) {
          try {
            // Parse from raw text
            parsedReceipt = await this.parser.parseFromBuffer(Buffer.from(receipt.rawText));
          } catch (error) {
            console.error('Failed to parse receipt:', error);
            continue;
          }
        } else if (receipt.parsedData) {
          console.log('[ReceiptMatcher] Using parsedData from database');
          // Ensure status is set from parsedData
          const parsedData = receipt.parsedData as any;
          parsedReceipt = {
            ...parsedData,
            status: parsedData.status || 'SUCCESS',
            datetime: parsedData.datetime || parsedData.transactionDate ? new Date(parsedData.transactionDate) : new Date(),
            recipientBank: parsedData.recipientBank || parsedData.bankReceiver
          } as ParsedReceipt;
        } else {
          console.error('No parsable data in receipt');
          continue;
        }

        // Try to match
        const matches = this.performMatching(transaction.payout, parsedReceipt);
        
        if (matches) {
          console.log(`[ReceiptMatcher] ✅ Receipt matches transaction ${transaction.id}`);
          return {
            success: true,
            transactionId: transaction.id,
            payoutId: transaction.payoutId,
            confidence: 0.95
          };
        }
      }

      console.log('[ReceiptMatcher] No matching transaction found');
      return { success: false };

    } catch (error) {
      console.error('[ReceiptMatcher] Error matching receipt:', error);
      return { success: false };
    }
  }
}

// Экспортируем функцию для удобства использования
export async function matchPayoutWithReceipt(
  transactionId: string,
  receiptPath: string
): Promise<boolean> {
  const matcher = new ReceiptMatcher();
  return matcher.matchPayoutWithReceipt(transactionId, receiptPath);
}