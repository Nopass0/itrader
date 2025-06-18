import { db } from './src/db/index';
const prisma = db.prisma;

async function markMessagesUnprocessed() {
  try {
    console.log('Marking recent counterparty messages as unprocessed...\n');
    
    // Get active transactions
    const activeTransactions = await prisma.transaction.findMany({
      where: {
        status: {
          in: ['pending', 'chat_started', 'waiting_payment']
        },
        chatStep: { lte: 1 } // Only transactions that need initial messages
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
    
    console.log(`Found ${activeTransactions.length} transactions needing processing\n`);
    
    for (const transaction of activeTransactions) {
      console.log(`Transaction ${transaction.id}:`);
      console.log(`  Status: ${transaction.status}, Chat Step: ${transaction.chatStep}`);
      
      // Find a recent counterparty message to mark as unprocessed
      const counterpartyMessages = transaction.chatMessages.filter(
        msg => msg.sender === 'counterparty' || msg.sender === 'us'
      );
      
      if (counterpartyMessages.length > 0) {
        const messageToProcess = counterpartyMessages[0];
        console.log(`  Marking message as unprocessed: "${messageToProcess.content.substring(0, 50)}..."`);
        
        await prisma.chatMessage.update({
          where: { id: messageToProcess.id },
          data: { isProcessed: false }
        });
        
        console.log(`  ✓ Message marked as unprocessed`);
      } else {
        console.log(`  No counterparty messages found`);
      }
      
      console.log();
    }
    
    // Also check for any transactions at chat step 0 that might need a kickstart
    const zeroStepTransactions = await prisma.transaction.findMany({
      where: {
        chatStep: 0,
        status: {
          in: ['pending', 'chat_started']
        }
      }
    });
    
    if (zeroStepTransactions.length > 0) {
      console.log(`\nFound ${zeroStepTransactions.length} transactions at chat step 0`);
      console.log('Creating trigger messages for them...\n');
      
      for (const transaction of zeroStepTransactions) {
        // Create a dummy unprocessed message to trigger automation
        const triggerMessage = await prisma.chatMessage.create({
          data: {
            transactionId: transaction.id,
            messageId: `trigger_${Date.now()}_${transaction.id}`,
            sender: 'counterparty',
            content: 'start',
            message: 'start',
            messageType: 'TEXT',
            isProcessed: false,
            sentAt: new Date()
          }
        });
        
        console.log(`Created trigger message for transaction ${transaction.id}`);
      }
    }
    
    console.log('\nDone! ChatAutomation should now process these messages.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markMessagesUnprocessed();