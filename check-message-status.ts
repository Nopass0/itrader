import { db } from './src/db';

(async () => {
  const messages = await db.getUnprocessedChatMessages();
  console.log('Unprocessed messages:', messages.length);
  if (messages.length > 0) {
    console.log('First message:', {
      id: messages[0].id,
      sender: messages[0].sender,
      content: messages[0].content,
      isProcessed: messages[0].isProcessed
    });
  }
  
  // Check transaction status
  const tx = await db.getTransactionWithDetails('cmc0j7dab05scikn70t56guri');
  console.log('Transaction status:', {
    id: tx?.id,
    status: tx?.status,
    chatStep: tx?.chatStep
  });
  
  // Check messages for this transaction
  const txMessages = await db.getChatMessages('cmc0j7dab05scikn70t56guri');
  console.log('Transaction messages:', txMessages.length);
  txMessages.forEach((msg, i) => {
    console.log(`Message ${i+1}:`, {
      sender: msg.sender,
      content: msg.content?.substring(0, 50),
      isProcessed: msg.isProcessed
    });
  });
  
  await db.prisma.$disconnect();
})();