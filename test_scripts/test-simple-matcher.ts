/**
 * Простой тест функции сопоставления
 */

import { ReceiptMatcher } from "./src/services/receiptMatcher";
import { TinkoffReceiptParser } from "./src/ocr";
import * as path from "path";

// Мок payout объекта для тестирования
const mockPayout = {
  id: "test-payout-1",
  gatePayoutId: 99999,
  paymentMethodId: 1,
  wallet: "79102830677",
  amountTrader: JSON.stringify({ "643": 2880, "000001": 36.35 }),
  totalTrader: JSON.stringify({ "643": 2880, "000001": 36.35 }),
  status: 1,
  createdAt: new Date("2025-06-09T10:00:00Z"), // За 4 часа до чека
  updatedAt: new Date("2025-06-09T10:00:00Z"),
  bank: JSON.stringify({
    id: 13,
    name: "alfabank",
    code: "100000000008",
    label: "АЛЬФА-БАНК",
    active: true
  }),
  method: JSON.stringify({}),
  attachments: JSON.stringify([]),
  tooltip: JSON.stringify({}),
  trader: JSON.stringify({}),
  gateAccount: "test-account",
  meta: JSON.stringify({}),
  approvedAt: null,
  expiredAt: null
};

async function testSimpleMatcher() {
  console.log("=== Простой тест сопоставления ===\n");
  
  const matcher = new ReceiptMatcher();
  const parser = new TinkoffReceiptParser();
  
  try {
    // Тестируем прямое сопоставление payout с чеком
    const receiptPath = path.join(__dirname, "data/pdf/2025-06-09T14-10-48-000Z_Receipt.pdf");
    
    // Парсим чек для проверки
    const receipt = await parser.parseReceiptFromFile(receiptPath);
    console.log("Информация о чеке:");
    console.log(`  Дата: ${receipt.datetime.toLocaleString('ru-RU')} (МСК)`);
    console.log(`  Сумма: ${receipt.amount} RUB`);
    console.log(`  Статус: ${receipt.status}`);
    if ('recipientPhone' in receipt) {
      console.log(`  Телефон: ${receipt.recipientPhone}`);
    }
    if ('recipientBank' in receipt && receipt.recipientBank) {
      console.log(`  Банк: ${receipt.recipientBank}`);
    }
    
    console.log("\nИнформация о payout:");
    console.log(`  Создан: ${mockPayout.createdAt.toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC`);
    const bank = JSON.parse(mockPayout.bank);
    console.log(`  Банк: ${bank.label}`);
    console.log(`  Телефон: ${mockPayout.wallet}`);
    const amount = JSON.parse(mockPayout.amountTrader);
    console.log(`  Сумма: ${amount["643"]} RUB`);
    
    // Вручную проверяем критерии
    console.log("\n=== Проверка критериев сопоставления ===");
    
    // 1. Статус
    const statusOk = receipt.status === "SUCCESS";
    console.log(`1. Статус "Успешно": ${statusOk ? "✅" : "❌"}`);
    
    // 2. Дата
    const receiptDateUTC = new Date(receipt.datetime.getTime() - 3 * 60 * 60 * 1000);
    const dateOk = receiptDateUTC >= mockPayout.createdAt;
    console.log(`2. Дата чека после payout: ${dateOk ? "✅" : "❌"}`);
    console.log(`   - Чек (UTC): ${receiptDateUTC.toISOString()}`);
    console.log(`   - Payout: ${mockPayout.createdAt.toISOString()}`);
    
    // 3. Сумма
    const amountOk = receipt.amount === amount["643"];
    console.log(`3. Сумма совпадает: ${amountOk ? "✅" : "❌"} (${receipt.amount} = ${amount["643"]})`);
    
    // 4. Телефон
    let phoneOk = false;
    if ('recipientPhone' in receipt && receipt.recipientPhone) {
      const normalizedWallet = mockPayout.wallet.replace(/\D/g, "");
      const normalizedPhone = receipt.recipientPhone.replace(/\D/g, "");
      phoneOk = normalizedWallet.slice(-10) === normalizedPhone.slice(-10);
      console.log(`4. Телефон совпадает: ${phoneOk ? "✅" : "❌"}`);
      console.log(`   - Payout: ${normalizedWallet}`);
      console.log(`   - Чек: ${normalizedPhone}`);
    }
    
    // 5. Банк
    let bankOk = false;
    if ('recipientBank' in receipt && receipt.recipientBank) {
      const receiptBankLower = receipt.recipientBank.toLowerCase();
      bankOk = receiptBankLower.includes("альфа");
      console.log(`5. Банк совпадает: ${bankOk ? "✅" : "❌"} ("${bank.label}" ~ "${receipt.recipientBank}")`);
    }
    
    const allOk = statusOk && dateOk && amountOk && phoneOk && bankOk;
    console.log(`\n✨ ИТОГОВЫЙ РЕЗУЛЬТАТ: ${allOk ? "✅ ВСЕ КРИТЕРИИ ВЫПОЛНЕНЫ" : "❌ НЕ ВСЕ КРИТЕРИИ ВЫПОЛНЕНЫ"}`);
    
  } catch (error) {
    console.error("Ошибка:", error);
  }
}

testSimpleMatcher().catch(console.error);