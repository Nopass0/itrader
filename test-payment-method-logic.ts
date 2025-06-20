import { db } from './src/db';

async function testPaymentMethodLogic() {
  console.log('🔍 Testing payment method selection logic\n');
  
  // Get recent payouts
  const payouts = await db.prisma.payout.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${payouts.length} payouts\n`);
  
  // Test payment method selection for each payout
  payouts.forEach(payout => {
    let paymentMethod: string;
    
    // Check if it's SBP payment method (payment_method_id = 5)
    if (payout.paymentMethodId === 5) {
      paymentMethod = "SBP";
    } else {
      // Check bank information
      const bank = payout.bank as any;
      if (!bank || !bank.id) {
        // Default to Tinkoff if no bank info
        paymentMethod = "Tinkoff";
      } else {
        // Map bank to payment method
        switch (bank.id) {
          case 37: // Sovcombank
            paymentMethod = "Sovcombank";
            break;
          case 23: // Promsvyazbank
            paymentMethod = "Promsvyazbank";
            break;
          default: // All other banks including Tinkoff
            paymentMethod = "Tinkoff";
            break;
        }
      }
    }
    
    console.log(`Payout ${payout.id}:`);
    console.log(`  Payment Method ID: ${payout.paymentMethodId}`);
    console.log(`  Bank ID: ${(payout.bank as any)?.id}`);
    console.log(`  Bank Name: ${(payout.bank as any)?.name}`);
    console.log(`  Bank Label: ${(payout.bank as any)?.label}`);
    console.log(`  ➡️ Selected Payment Method: ${paymentMethod}`);
    console.log('');
  });
  
  // Summary
  console.log('\n📊 Payment Method Mapping Summary:');
  console.log('- Payment Method ID 5 → SBP');
  console.log('- Bank ID 37 (Sovcombank) → Sovcombank');
  console.log('- Bank ID 23 (Promsvyazbank) → Promsvyazbank');
  console.log('- All other banks → Tinkoff');
}

testPaymentMethodLogic()
  .catch(console.error)
  .finally(() => db.prisma.$disconnect());