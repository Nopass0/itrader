/**
 * Тест функции сопоставления payout с чеками
 */

import { PrismaClient } from "./generated/prisma";
import { ReceiptMatcher } from "./src/services/receiptMatcher";
import { TinkoffReceiptParser } from "./src/ocr";
import * as path from "path";

const prisma = new PrismaClient();

async function testReceiptMatcher() {
  console.log("=== Тест сопоставления payout с чеками ===\n");
  
  const matcher = new ReceiptMatcher();
  const parser = new TinkoffReceiptParser();
  
  try {
    // Получаем последние транзакции с payout
    const transactions = await prisma.transaction.findMany({
      where: {
        payoutId: {
          not: null
        }
      },
      include: {
        payout: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log(`Найдено ${transactions.length} транзакций с payout\n`);
    
    if (transactions.length === 0) {
      console.log("Нет транзакций для тестирования");
      return;
    }
    
    // Показываем информацию о транзакциях
    for (const tx of transactions) {
      if (!tx.payout) continue;
      
      const bank = JSON.parse(tx.payout.bank);
      const amount = JSON.parse(tx.payout.amountTrader);
      
      console.log(`--- Транзакция ${tx.id} ---`);
      console.log(`  Создана: ${tx.payout.createdAt.toLocaleString('ru-RU')}`);
      console.log(`  Банк: ${bank.label}`);
      console.log(`  Wallet: ${tx.payout.wallet}`);
      console.log(`  Сумма: ${amount["643"]} RUB`);
      console.log();
    }
    
    // Пример теста с конкретным чеком
    const testReceiptPath = path.join(__dirname, "data/pdf/2025-06-09T14-10-48-000Z_Receipt.pdf");
    
    try {
      const receipt = await parser.parseReceiptFromFile(testReceiptPath);
      console.log("\n=== Тестовый чек ===");
      console.log(`Дата: ${receipt.datetime.toLocaleString('ru-RU')}`);
      console.log(`Сумма: ${receipt.amount} RUB`);
      console.log(`Отправитель: ${receipt.sender}`);
      
      if ('recipientPhone' in receipt) {
        console.log(`Телефон получателя: ${receipt.recipientPhone}`);
      }
      if ('recipientBank' in receipt && receipt.recipientBank) {
        console.log(`Банк получателя: ${receipt.recipientBank}`);
      }
      
      // Тестируем сопоставление с первой транзакцией
      if (transactions.length > 0) {
        console.log("\n=== Тест сопоставления ===");
        const testTx = transactions[0];
        const matches = await matcher.matchPayoutWithReceipt(testTx.id, testReceiptPath);
        
        console.log(`Транзакция ${testTx.id}: ${matches ? "✅ СОВПАДАЕТ" : "❌ НЕ СОВПАДАЕТ"}`);
      }
      
    } catch (error) {
      console.error("Ошибка при парсинге тестового чека:", error);
    }
    
  } catch (error) {
    console.error("Ошибка:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем тест
testReceiptMatcher().catch(console.error);