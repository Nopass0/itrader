import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkBybitData() {
  try {
    console.log('Checking Bybit accounts and advertisements...\n');

    // Check Bybit accounts
    const bybitAccounts = await prisma.bybitAccount.findMany({
      include: {
        advertisements: true
      }
    });

    console.log(`Total Bybit accounts: ${bybitAccounts.length}\n`);

    for (const account of bybitAccounts) {
      console.log('='.repeat(60));
      console.log(`Account ID: ${account.id}`);
      console.log(`Account Name: ${account.accountName || 'N/A'}`);
      console.log(`Account ID (Bybit): ${account.accountId}`);
      console.log(`Active: ${account.isActive}`);
      console.log(`Active Ads Count: ${account.activeAdsCount}`);
      console.log(`Actual Ads Count: ${account.advertisements.length}`);
      console.log(`Last Sync: ${account.lastSync || 'Never'}`);
      console.log(`Created: ${account.createdAt}`);
      
      if (account.advertisements.length > 0) {
        console.log(`\nAdvertisements:`);
        for (const ad of account.advertisements) {
          console.log(`  - ${ad.id} (${ad.bybitAdId || 'No Bybit ID'})`);
          console.log(`    Type: ${ad.type}, Currency: ${ad.currency}/${ad.fiat}`);
          console.log(`    Price: ${ad.price}, Range: ${ad.minAmount}-${ad.maxAmount}`);
          console.log(`    Active: ${ad.isActive}, Status: ${ad.status || 'N/A'}`);
        }
      }
    }

    // Check Gate accounts
    console.log('\n\n' + '='.repeat(60));
    console.log('GATE ACCOUNTS\n');
    
    const gateAccounts = await prisma.gateAccount.findMany({
      include: {
        payouts: {
          take: 3
        }
      }
    });

    console.log(`Total Gate accounts: ${gateAccounts.length}\n`);

    for (const account of gateAccounts) {
      console.log(`Account ID: ${account.id}`);
      console.log(`Account Name: ${account.accountName || 'N/A'}`);
      console.log(`Email: ${account.email}`);
      console.log(`Active: ${account.isActive}`);
      console.log(`Payouts count: ${account.payouts.length}`);
      console.log(`Last Sync: ${account.lastSync || 'Never'}`);
      console.log(`Created: ${account.createdAt}`);
      console.log();
    }

    // Check Gmail accounts
    console.log('='.repeat(60));
    console.log('GMAIL ACCOUNTS\n');
    
    const gmailAccounts = await prisma.gmailAccount.findMany();
    
    console.log(`Total Gmail accounts: ${gmailAccounts.length}\n`);
    
    for (const account of gmailAccounts) {
      console.log(`Email: ${account.email}`);
      console.log(`Active: ${account.isActive}`);
      console.log(`Last Sync: ${account.lastSync || 'Never'}`);
      console.log(`Created: ${account.createdAt}`);
      console.log();
    }

  } catch (error) {
    console.error('Error checking Bybit data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBybitData();