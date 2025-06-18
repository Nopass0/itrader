import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Проверяем количество записей в таблицах
    const payoutCount = await prisma.payout.count();
    const transactionCount = await prisma.transaction.count();
    const adCount = await prisma.bybitAdvertisement.count();
    
    console.log("=== Состояние базы данных ===");
    console.log(`Payouts: ${payoutCount}`);
    console.log(`Transactions: ${transactionCount}`);
    console.log(`Advertisements: ${adCount}`);
    
    // Получаем первые несколько payout для примера
    if (payoutCount > 0) {
      const payouts = await prisma.payout.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log("\n=== Примеры Payout ===");
      for (const payout of payouts) {
        const bank = typeof payout.bank === 'string' ? JSON.parse(payout.bank) : payout.bank;
        const amount = typeof payout.amountTrader === 'string' ? JSON.parse(payout.amountTrader) : payout.amountTrader;
        console.log(`ID: ${payout.id}`);
        console.log(`  Bank: ${bank.label}`);
        console.log(`  Wallet: ${payout.wallet}`);
        console.log(`  Amount: ${amount["643"]} RUB`);
        console.log(`  CreatedAt: ${payout.createdAt.toLocaleString('ru-RU')}`);
        console.log();
      }
    }
    
  } catch (error) {
    console.error("Ошибка:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase().catch(console.error);