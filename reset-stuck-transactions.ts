import { db } from './src/db/index';
const prisma = db.prisma;

async function resetStuckTransactions() {
  try {
    console.log('Resetting stuck transactions...\n');
    
    // Find transactions with high chat steps that don't have our messages
    const stuckTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { chatStep: { gte: 100 } },
          { chatStep: 999 }
        ],
        status: {
          in: ['chat_started', 'pending', 'waiting_payment']
        }
      },
      include: {
        chatMessages: true
      }
    });
    
    console.log(`Found ${stuckTransactions.length} potentially stuck transactions\n`);
    
    for (const transaction of stuckTransactions) {
      // Check if we actually sent messages
      const ourMessages = transaction.chatMessages.filter(msg => msg.sender === 'me');
      const hasGreeting = ourMessages.some(msg => msg.content.includes('Здравствуйте'));
      const hasPaymentDetails = ourMessages.some(msg => msg.content.includes('Реквизиты для оплаты'));
      
      console.log(`Transaction ${transaction.id}:`);
      console.log(`  Order ID: ${transaction.orderId}`);
      console.log(`  Status: ${transaction.status}`);
      console.log(`  Current Chat Step: ${transaction.chatStep}`);
      console.log(`  Our messages: ${ourMessages.length}`);
      console.log(`  Has greeting: ${hasGreeting}`);
      console.log(`  Has payment details: ${hasPaymentDetails}`);
      
      // Determine correct chat step
      let correctChatStep = 0;
      if (hasPaymentDetails) {
        correctChatStep = 999; // Keep as is
      } else if (hasGreeting) {
        correctChatStep = 1;
      } else {
        correctChatStep = 0; // Need to start automation
      }
      
      if (correctChatStep !== transaction.chatStep) {
        console.log(`  -> Resetting chat step from ${transaction.chatStep} to ${correctChatStep}`);
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { 
            chatStep: correctChatStep,
            updatedAt: new Date()
          }
        });
      } else {
        console.log(`  -> Chat step is correct`);
      }
      
      console.log();
    }
    
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetStuckTransactions();