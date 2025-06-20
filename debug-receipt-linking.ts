import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function debugReceiptLinking() {
  try {
    // Get unlinked receipts
    const unlinkedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: true,
        payoutId: null,
        amount: { not: null },
        parseError: null
      }
    });

    console.log(`\n📋 Found ${unlinkedReceipts.length} unlinked receipts:\n`);

    for (const receipt of unlinkedReceipts) {
      console.log(`\n📄 Receipt ${receipt.id}:`);
      console.log(`  Filename: ${receipt.filename}`);
      console.log(`  Amount: ${receipt.amount}`);
      console.log(`  Recipient Name: ${receipt.recipientName}`);
      console.log(`  Recipient Phone: ${receipt.recipientPhone}`);
      console.log(`  Recipient Card: ${receipt.recipientCard}`);
      console.log(`  Recipient Bank: ${receipt.recipientBank}`);

      // Check parsed data
      const parsedData = receipt.parsedData as any;
      if (parsedData) {
        console.log(`  📊 Parsed data:`, parsedData);
      }

      // Search for matching payouts
      console.log(`\n  🔍 Searching for matching payouts...`);

      // 1. Search by phone (if available)
      if (receipt.recipientPhone) {
        const normalizedPhone = receipt.recipientPhone.replace(/\D/g, '');
        console.log(`  Normalized phone: ${normalizedPhone}`);
        
        // Search in wallet field
        const payoutsByWallet = await prisma.payout.findMany({
          where: {
            wallet: {
              contains: normalizedPhone
            },
            status: { in: [5, 7] }
          }
        });

        if (payoutsByWallet.length > 0) {
          console.log(`  ✅ Found ${payoutsByWallet.length} payouts by wallet phone:`);
          for (const p of payoutsByWallet) {
            console.log(`    - ID: ${p.id}, Gate: ${p.gatePayoutId}, Amount: ${p.amount}, Status: ${p.status}`);
            console.log(`      Wallet: ${p.wallet}, Name: ${p.recipientName}`);
          }
        }

        // Search in trader.phone field
        const payoutsWithTraderPhone = await prisma.payout.findMany({
          where: {
            status: { in: [5, 7] }
          }
        });

        const matchingByTraderPhone = payoutsWithTraderPhone.filter(p => {
          const trader = p.trader as any;
          if (trader?.phone) {
            const traderPhoneNorm = trader.phone.replace(/\D/g, '');
            return traderPhoneNorm.includes(normalizedPhone) || normalizedPhone.includes(traderPhoneNorm);
          }
          return false;
        });

        if (matchingByTraderPhone.length > 0) {
          console.log(`  ✅ Found ${matchingByTraderPhone.length} payouts by trader.phone:`);
          for (const p of matchingByTraderPhone) {
            const trader = p.trader as any;
            console.log(`    - ID: ${p.id}, Gate: ${p.gatePayoutId}, Amount: ${p.amount}, Status: ${p.status}`);
            console.log(`      Trader phone: ${trader.phone}, Name: ${p.recipientName}`);
          }
        }
      }

      // 2. Search by amount
      const payoutsByAmount = await prisma.payout.findMany({
        where: {
          amount: receipt.amount,
          status: { in: [5, 7] }
        }
      });

      if (payoutsByAmount.length > 0) {
        console.log(`  💰 Found ${payoutsByAmount.length} payouts with same amount:`);
        for (const p of payoutsByAmount) {
          const trader = p.trader as any;
          console.log(`    - ID: ${p.id}, Gate: ${p.gatePayoutId}, Status: ${p.status}`);
          console.log(`      Name: ${p.recipientName}, Wallet: ${p.wallet}`);
          if (trader?.phone) {
            console.log(`      Trader phone: ${trader.phone}`);
          }
        }
      }

      // 3. Search by recipient name
      if (receipt.recipientName) {
        const payoutsByName = await prisma.payout.findMany({
          where: {
            recipientName: {
              contains: receipt.recipientName
            },
            status: { in: [5, 7] }
          }
        });

        if (payoutsByName.length > 0) {
          console.log(`  👤 Found ${payoutsByName.length} payouts by recipient name:`);
          for (const p of payoutsByName) {
            console.log(`    - ID: ${p.id}, Gate: ${p.gatePayoutId}, Amount: ${p.amount}, Status: ${p.status}`);
            console.log(`      Name: ${p.recipientName}`);
          }
        }
      }
    }

    // Check all payouts without receipts
    console.log(`\n\n📊 Checking all payouts with status 5 (waiting confirmation):`);
    const waitingPayouts = await prisma.payout.findMany({
      where: {
        status: 5
      },
      include: {
        transaction: true
      }
    });

    console.log(`Found ${waitingPayouts.length} payouts waiting confirmation:\n`);
    for (const p of waitingPayouts) {
      const trader = p.trader as any;
      console.log(`Payout ${p.id} (Gate: ${p.gatePayoutId}):`);
      console.log(`  Amount: ${p.amount}`);
      console.log(`  Name: ${p.recipientName}`);
      console.log(`  Wallet: ${p.wallet}`);
      if (trader?.phone) {
        console.log(`  Trader phone: ${trader.phone}`);
      }
      console.log(`  Has transaction: ${!!p.transaction}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugReceiptLinking();