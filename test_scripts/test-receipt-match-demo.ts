/**
 * Демонстрация работы функции сопоставления payout с чеками
 */

import { TinkoffReceiptParser } from "./src/ocr";
import * as path from "path";

// Симуляция функции сопоставления для демонстрации
async function demonstrateMatching() {
  console.log("=== Демонстрация сопоставления payout с чеками ===\n");
  
  const parser = new TinkoffReceiptParser();
  
  // Примеры payout из БД
  const examplePayouts = [
    {
      id: "test-1",
      createdAt: new Date("2025-06-09T11:00:00Z"), // UTC
      bank: { label: "Альфа-Банк", name: "alfabank" },
      wallet: "79102830677",
      amount: 2880
    },
    {
      id: "test-2", 
      createdAt: new Date("2025-06-02T12:00:00Z"),
      bank: { label: "Озон Банк", name: "ozonbank" },
      wallet: "79374710399",
      amount: 25000
    }
  ];
  
  // Тестовые чеки
  const testReceipts = [
    "2025-06-09T14-10-48-000Z_Receipt.pdf", // Альфа-Банк, 2880 RUB
    "Receipt (33).pdf" // Озон Банк, 25000 RUB
  ];
  
  console.log("Тестовые payout:");
  for (const payout of examplePayouts) {
    console.log(`\nPayout ${payout.id}:`);
    console.log(`  Создан: ${payout.createdAt.toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC`);
    console.log(`  Банк: ${payout.bank.label}`);
    console.log(`  Кошелек: ${payout.wallet}`);
    console.log(`  Сумма: ${payout.amount} RUB`);
  }
  
  console.log("\n\n=== Проверка чеков ===");
  
  for (const receiptFile of testReceipts) {
    const receiptPath = path.join(__dirname, "data/pdf", receiptFile);
    
    try {
      const receipt = await parser.parseReceiptFromFile(receiptPath);
      
      console.log(`\n--- Чек: ${receiptFile} ---`);
      console.log(`Дата чека: ${receipt.datetime.toLocaleString('ru-RU')} (МСК)`);
      console.log(`Сумма: ${receipt.amount} RUB`);
      console.log(`Статус: ${receipt.status}`);
      
      if ('recipientPhone' in receipt) {
        console.log(`Телефон: ${receipt.recipientPhone}`);
      }
      if ('recipientBank' in receipt && receipt.recipientBank) {
        console.log(`Банк: ${receipt.recipientBank}`);
      }
      
      // Симуляция проверки соответствия
      console.log("\nПроверка соответствия:");
      
      for (const payout of examplePayouts) {
        console.log(`\n  С payout ${payout.id}:`);
        
        // 1. Проверка статуса
        const statusOk = receipt.status === "SUCCESS";
        console.log(`    ✓ Статус: ${statusOk ? "✅" : "❌"}`);
        
        // 2. Проверка даты (сравниваем только даты без времени)
        const receiptDateUTC = new Date(receipt.datetime.getTime() - 3 * 60 * 60 * 1000);
        
        // Получаем только даты без времени
        const payoutDateOnly = new Date(payout.createdAt.getFullYear(), payout.createdAt.getMonth(), payout.createdAt.getDate());
        const receiptDateOnly = new Date(receiptDateUTC.getFullYear(), receiptDateUTC.getMonth(), receiptDateUTC.getDate());
        
        const dateOk = receiptDateOnly >= payoutDateOnly;
        console.log(`    ✓ Дата: ${dateOk ? "✅" : "❌"} (сравнение только по дате)`);
        console.log(`       Чек: ${receipt.datetime.toLocaleDateString('ru-RU')} (полное: ${receipt.datetime.toLocaleString('ru-RU')})`);
        console.log(`       Payout: ${payout.createdAt.toLocaleDateString('ru-RU')} (полное: ${payout.createdAt.toLocaleString('ru-RU', {timeZone: 'UTC'})} UTC)`);
        
        // 3. Проверка суммы
        const amountOk = receipt.amount === payout.amount;
        console.log(`    ✓ Сумма: ${amountOk ? "✅" : "❌"} (${receipt.amount} vs ${payout.amount})`);
        
        // 4. Проверка wallet
        let walletOk = false;
        if ('recipientPhone' in receipt && receipt.recipientPhone) {
          const normalizedWallet = payout.wallet.replace(/\D/g, "");
          const normalizedPhone = receipt.recipientPhone.replace(/\D/g, "");
          walletOk = normalizedWallet.slice(-10) === normalizedPhone.slice(-10);
          console.log(`    ✓ Телефон: ${walletOk ? "✅" : "❌"} (...${normalizedWallet.slice(-4)} vs ...${normalizedPhone.slice(-4)})`);
        }
        
        // 5. Проверка банка
        let bankOk = false;
        if ('recipientBank' in receipt && receipt.recipientBank) {
          const receiptBankLower = receipt.recipientBank.toLowerCase();
          const BANK_KEYWORDS: Record<string, string[]> = {
            "alfabank": ["альфа", "alfa"],
            "ozonbank": ["озон", "ozon"],
            "yandexbank": ["яндекс", "yandex"],
            "tbank": ["т-банк", "тинькофф", "t-bank"],
            "sberbank": ["сбер"],
            "vtb": ["втб"]
          };
          
          const payoutBankKeywords = BANK_KEYWORDS[payout.bank.name] || [];
          bankOk = payoutBankKeywords.some(keyword => receiptBankLower.includes(keyword));
          console.log(`    ✓ Банк: ${bankOk ? "✅" : "❌"} (${payout.bank.label} vs ${receipt.recipientBank})`);
        }
        
        const allOk = statusOk && dateOk && amountOk && walletOk && bankOk;
        console.log(`    ИТОГ: ${allOk ? "✅ СОВПАДАЕТ" : "❌ НЕ СОВПАДАЕТ"}`);
      }
      
    } catch (error) {
      console.error(`Ошибка при обработке ${receiptFile}:`, error);
    }
  }
}

demonstrateMatching().catch(console.error);