import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixPaymentDetails() {
  console.log('🔧 Fixing payment details for transaction\n');
  
  try {
    // Обновим payout с тестовыми реквизитами
    const payout = await prisma.payout.update({
      where: { id: 'cmc3o8t6546euik8v2bj6n6ym' },
      data: {
        amount: 2500,
        receiver_card: '2200000000000000',
        receiver_phone: '+79001234567',
        receiver_name: 'ИВАН ИВАНОВ',
        bank_name: 'Т-Банк'
      }
    });
    
    console.log('✅ Updated payout with payment details:');
    console.log(`   Amount: ${payout.amount}`);
    console.log(`   Card: ${payout.receiver_card}`);
    console.log(`   Phone: ${payout.receiver_phone}`);
    console.log(`   Name: ${payout.receiver_name}`);
    console.log(`   Bank: ${payout.bank_name}`);
    
    // Сбросим chatStep чтобы попробовать снова
    const transaction = await prisma.transaction.update({
      where: { id: 'cmc3ovhoxgnxa65aikqi' },
      data: { 
        chatStep: 1,
        paymentDetails: JSON.stringify({
          card: '2200000000000000',
          phone: '+79001234567',
          name: 'ИВАН ИВАНОВ',
          bank: 'Т-Банк'
        })
      }
    });
    
    console.log('\n✅ Reset transaction chatStep to 1');
    console.log('   Transaction will try to send payment details again');
    
    // Отметим последнее сообщение как необработанное
    const lastMessage = await prisma.chatMessage.findFirst({
      where: {
        transactionId: 'cmc3ovhoxgnxa65aikqi',
        content: 'да'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (lastMessage) {
      await prisma.chatMessage.update({
        where: { id: lastMessage.id },
        data: { isProcessed: false }
      });
      console.log('\n✅ Marked last "да" message as unprocessed');
    }
    
    // Проверим MailSlurp конфигурацию
    const mailslurpKey = await prisma.setting.findUnique({
      where: { key: 'mailslurp_api_key' }
    });
    
    if (!mailslurpKey?.value) {
      console.log('\n⚠️  WARNING: MailSlurp API key is not configured!');
      console.log('   The system may still fail to send payment details.');
      console.log('   Consider disabling MailSlurp requirement or configuring it properly.');
      
      // Временно отключим MailSlurp
      await prisma.setting.upsert({
        where: { key: 'use_mailslurp' },
        update: { value: 'false' },
        create: { key: 'use_mailslurp', value: 'false' }
      });
      
      console.log('\n✅ Disabled MailSlurp requirement temporarily');
    }
    
    console.log('\n🔄 Chat processor should now process the message and send payment details');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPaymentDetails();