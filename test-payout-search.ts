import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function testPayoutSearch() {
  try {
    // Test searching for amount 4700
    console.log('\n🔍 Testing search for amount 4700:');
    
    // Direct query
    const payout4700 = await prisma.payout.findFirst({
      where: {
        OR: [
          { amount: 4700 },
          { 
            amountTrader: {
              path: '$.643',
              equals: 4700
            }
          }
        ]
      }
    });
    
    console.log('Found payout:', payout4700 ? `${payout4700.id} (Gate: ${payout4700.gatePayoutId})` : 'NOT FOUND');
    
    if (payout4700) {
      console.log('  AmountTrader:', payout4700.amountTrader);
      console.log('  Amount:', payout4700.amount);
      console.log('  Status:', payout4700.status);
    }
    
    // Test searching for amount 4500
    console.log('\n🔍 Testing search for amount 4500:');
    
    const payout4500 = await prisma.payout.findFirst({
      where: {
        OR: [
          { amount: 4500 },
          { 
            amountTrader: {
              path: '$.643',
              equals: 4500
            }
          }
        ]
      }
    });
    
    console.log('Found payout:', payout4500 ? `${payout4500.id} (Gate: ${payout4500.gatePayoutId})` : 'NOT FOUND');
    
    if (payout4500) {
      console.log('  AmountTrader:', payout4500.amountTrader);
      console.log('  Amount:', payout4500.amount);
      console.log('  Status:', payout4500.status);
    }
    
    // Test searching for payout that has amount 4700 in amountTrader
    console.log('\n🔍 Checking if 4700 exists in any payout:');
    const allPayoutsCheck = await prisma.payout.findMany();
    
    const payoutsWith4700 = allPayoutsCheck.filter(p => {
      const amountTrader = p.amountTrader as any;
      return amountTrader && amountTrader['643'] === 4700;
    });
    
    console.log(`Found ${payoutsWith4700.length} payouts with 4700 RUB`);
    for (const p of payoutsWith4700) {
      console.log(`  - ${p.id} (Gate: ${p.gatePayoutId}, Status: ${p.status})`);
    }
    
    // Check all payouts with amountTrader
    console.log('\n📊 All payouts with amountTrader:');
    const allPayouts = await prisma.payout.findMany({
      where: {
        amountTrader: { not: null }
      }
    });
    
    for (const p of allPayouts) {
      const amountTrader = p.amountTrader as any;
      if (amountTrader && amountTrader['643']) {
        console.log(`  Payout ${p.id}: ${amountTrader['643']} RUB (status: ${p.status})`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPayoutSearch();