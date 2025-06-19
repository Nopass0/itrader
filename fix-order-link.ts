import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixOrderLink() {
  console.log('🔧 Fixing order link for 1935774322475847680\n');
  
  try {
    // Найдем advertisement
    const ad = await prisma.advertisement.findFirst({
      where: { bybitAdId: '1935760227540914176' },
      include: {
        transaction: {
          include: {
            chatMessages: true
          }
        }
      }
    });
    
    if (!ad) {
      console.log('❌ Advertisement not found');
      return;
    }
    
    console.log('✅ Advertisement found:', ad.id);
    
    if (ad.transaction) {
      console.log('\n📋 Current transaction:');
      console.log('   Transaction ID:', ad.transaction.id);
      console.log('   Order ID:', ad.transaction.orderId);
      console.log('   Status:', ad.transaction.status);
      console.log('   Chat Step:', ad.transaction.chatStep);
      console.log('   Messages:', ad.transaction.chatMessages.length);
      
      const correctOrderId = '1935774322475847680';
      
      if (ad.transaction.orderId !== correctOrderId) {
        console.log('\n⚠️  Transaction is linked to different order!');
        console.log('   Expected:', correctOrderId);
        console.log('   Actual:', ad.transaction.orderId);
        
        // Обновим orderId и сбросим состояние чата
        await prisma.transaction.update({
          where: { id: ad.transaction.id },
          data: { 
            orderId: correctOrderId,
            status: 'chat_started',
            chatStep: 0
          }
        });
        
        console.log('\n✅ Updated transaction with correct order ID');
        console.log('   Status reset to: chat_started');
        console.log('   Chat step reset to: 0');
        console.log('\n🤖 Chat automation should now start for this order');
        console.log('   The system will send the initial question message');
      } else {
        console.log('\n✅ Order ID is already correct');
        
        if (ad.transaction.chatStep === 0) {
          console.log('   Chat step is 0 - automation should start soon');
        } else {
          console.log('   Chat step:', ad.transaction.chatStep);
          console.log('   Resetting to 0 to restart automation...');
          
          await prisma.transaction.update({
            where: { id: ad.transaction.id },
            data: { 
              chatStep: 0,
              status: 'chat_started'
            }
          });
          
          console.log('   ✅ Reset complete');
        }
      }
    } else {
      console.log('\n❌ No transaction linked to advertisement');
      console.log('   Creating new transaction...');
      
      const newTransaction = await prisma.transaction.create({
        data: {
          orderId: '1935774322475847680',
          advertisementId: ad.id,
          payoutId: ad.payoutId,
          amount: 3226,
          counterpartyName: 'CyberExc',
          status: 'chat_started',
          chatStep: 0
        }
      });
      
      console.log('\n✅ Transaction created:', newTransaction.id);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrderLink();