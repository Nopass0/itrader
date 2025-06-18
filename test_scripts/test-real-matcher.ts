/**
 * Тест с реальными данными из БД
 */

import { PrismaClient } from "./generated/prisma";
import { ReceiptMatcher } from "./src/services/receiptMatcher";
import * as path from "path";

const prisma = new PrismaClient();

async function testRealMatcher() {
  console.log("=== Тест сопоставления с реальными данными ===\n");
  
  const matcher = new ReceiptMatcher();
  
  try {
    // Создаем тестовый payout для проверки
    console.log("Создаем тестовый payout...");
    
    const testPayout = await prisma.payout.create({
      data: {
        gatePayoutId: 99999,
        paymentMethodId: 1,
        wallet: "79102830677", // Телефон из чека 2025-06-09T14-10-48-000Z_Receipt.pdf
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
        meta: JSON.stringify({})
      }
    });
    
    console.log(`✓ Создан payout с ID: ${testPayout.id}`);
    console.log(`  Банк: Альфа-Банк`);
    console.log(`  Телефон: ${testPayout.wallet}`);
    console.log(`  Сумма: 2880 RUB`);
    console.log(`  Создан: ${testPayout.createdAt.toLocaleString('ru-RU')}\n`);
    
    // Создаем тестовую транзакцию
    const testTransaction = await prisma.transaction.create({
      data: {
        payoutId: testPayout.id,
        advertisementId: "test-ad-id",
        status: "pending"
      }
    });
    
    console.log(`✓ Создана транзакция с ID: ${testTransaction.id}\n`);
    
    // Тестируем сопоставление с чеком
    const receiptPath = path.join(__dirname, "data/pdf/2025-06-09T14-10-48-000Z_Receipt.pdf");
    
    console.log("Проверяем сопоставление с чеком...");
    const matches = await matcher.matchPayoutWithReceipt(testTransaction.id, receiptPath);
    
    console.log(`\nРезультат: ${matches ? "✅ ЧЕКА СООТВЕТСТВУЕТ ТРАНЗАКЦИИ" : "❌ ЧЕК НЕ СООТВЕТСТВУЕТ"}`);
    
    // Проверяем с неподходящим чеком
    console.log("\n--- Проверка с неподходящим чеком ---");
    const wrongReceiptPath = path.join(__dirname, "data/pdf/Receipt (33).pdf");
    const wrongMatches = await matcher.matchPayoutWithReceipt(testTransaction.id, wrongReceiptPath);
    
    console.log(`Результат: ${wrongMatches ? "✅ СОВПАДАЕТ" : "❌ НЕ СОВПАДАЕТ (ожидаемо)"}`);
    
    // Удаляем тестовые данные
    console.log("\nУдаляем тестовые данные...");
    await prisma.transaction.delete({ where: { id: testTransaction.id } });
    await prisma.payout.delete({ where: { id: testPayout.id } });
    console.log("✓ Тестовые данные удалены");
    
  } catch (error) {
    console.error("Ошибка:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealMatcher().catch(console.error);