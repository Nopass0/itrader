import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixChatProcessor() {
  console.log('🔧 Fixing Chat Processor\n');
  
  try {
    // Вернем сообщение в необработанное состояние
    const message = await prisma.chatMessage.findFirst({
      where: {
        content: 'да',
        transactionId: 'cmc3ovhoxgnxa65aikqi'
      }
    });

    if (message) {
      await prisma.chatMessage.update({
        where: { id: message.id },
        data: { isProcessed: false }
      });
      
      console.log('✅ Message marked as unprocessed again');
      console.log(`   Transaction: ${message.transactionId}`);
      console.log(`   Content: "${message.content}"`);
    }

    // Проверим текущее состояние
    const unprocessed = await prisma.chatMessage.count({
      where: { isProcessed: false }
    });

    console.log(`\n📊 Total unprocessed messages: ${unprocessed}`);
    console.log('\n🔄 Now the Chat Processor should pick up and process this message automatically');
    console.log('   Watch the logs for: "[ChatProcessor]" messages');
    console.log('   Or: "🔍 Checking for unprocessed messages"');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixChatProcessor();