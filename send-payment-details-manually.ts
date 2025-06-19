import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function sendPaymentDetailsManually() {
  console.log('📤 Sending payment details manually\n');
  
  try {
    const orderId = '1935774322475847680';
    
    // Найдем или создадим транзакцию
    let transaction = await prisma.transaction.findFirst({
      where: { orderId },
      include: {
        advertisement: {
          include: {
            bybitAccount: true
          }
        },
        payout: true
      }
    });
    
    if (!transaction) {
      console.log('❌ No transaction found for order', orderId);
      
      // Найдем advertisement
      const ad = await prisma.advertisement.findFirst({
        where: { bybitAdId: '1935760227540914176' },
        include: {
          bybitAccount: true,
          payout: true
        }
      });
      
      if (!ad) {
        console.log('❌ No advertisement found');
        return;
      }
      
      // Создадим транзакцию
      transaction = await prisma.transaction.create({
        data: {
          orderId,
          advertisementId: ad.id,
          payoutId: ad.payoutId,
          amount: 3226,
          counterpartyName: 'CyberExc',
          status: 'chat_started',
          chatStep: 0
        },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          },
          payout: true
        }
      });
      
      console.log('✅ Transaction created:', transaction.id);
    }
    
    // Подготовим реквизиты
    const paymentDetails = `Реквизиты для оплаты:
Банк: Т-Банк
Карта: 2200 0000 0000 0000

Сумма: 3226 RUB

Email для чека: receipts@example.com

После оплаты отправьте чек в формате PDF на указанный email с официальной почты банка.`;

    console.log('📝 Payment details to send:');
    console.log(paymentDetails);
    console.log('');
    
    // Сохраним в БД для отправки через основное приложение
    if (transaction.advertisement?.bybitAccount) {
      console.log('📝 Saving payment details for chat automation...');
      
      // Обновим статус транзакции
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'chat_started',
          chatStep: 1, // Готов к отправке реквизитов
          paymentDetails: JSON.stringify({
            bank: 'Т-Банк',
            card: '2200000000000000',
            amount: 3226,
            email: 'receipts@example.com'
          })
        }
      });
      
      // Создадим сообщение "да" от покупателя чтобы триггернуть отправку
      await prisma.chatMessage.create({
        data: {
          transactionId: transaction.id,
          messageId: `buyer_${Date.now()}`,
          content: 'да',
          isFromUs: false,
          isProcessed: false // Необработанное сообщение
        }
      });
      
      console.log('\n✅ Transaction prepared for payment details sending');
      console.log('✅ Created unprocessed "да" message to trigger automation');
      console.log('\n⏳ The chat processor should pick this up and send payment details');
      console.log('   Watch the logs for chat automation activity...');
      
    } else {
      console.log('❌ No Bybit account found for transaction');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

sendPaymentDetailsManually();