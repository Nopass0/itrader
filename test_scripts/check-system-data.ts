import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkSystemData() {
  try {
    console.log('Checking system data...\n');

    // Check System Accounts
    console.log('=== SYSTEM ACCOUNTS ===');
    const systemAccounts = await prisma.systemAccount.findMany({
      include: {
        authTokens: true
      }
    });
    
    console.log(`Total system accounts: ${systemAccounts.length}`);
    for (const account of systemAccounts) {
      console.log(`\n- Username: ${account.username}`);
      console.log(`  Role: ${account.role}`);
      console.log(`  Active: ${account.isActive}`);
      console.log(`  Last Login: ${account.lastLogin || 'Never'}`);
      console.log(`  Auth Tokens: ${account.authTokens.length}`);
    }

    // Check Chat Templates
    console.log('\n\n=== CHAT TEMPLATES ===');
    const chatTemplates = await prisma.chatTemplate.findMany({
      include: {
        group: true,
        usageHistory: {
          take: 3
        }
      }
    });
    
    console.log(`Total chat templates: ${chatTemplates.length}`);
    for (const template of chatTemplates) {
      console.log(`\n- Name: ${template.name}`);
      console.log(`  Message: ${template.message.substring(0, 100)}${template.message.length > 100 ? '...' : ''}`);
      console.log(`  Keywords: ${JSON.stringify(template.keywords)}`);
      console.log(`  Priority: ${template.priority}`);
      console.log(`  Active: ${template.isActive}`);
      console.log(`  Group: ${template.group?.name || 'None'}`);
      console.log(`  Usage Count: ${template.usageHistory.length}`);
    }

    // Check Response Groups
    console.log('\n\n=== RESPONSE GROUPS ===');
    const responseGroups = await prisma.responseGroup.findMany({
      include: {
        _count: {
          select: { templates: true }
        }
      }
    });
    
    console.log(`Total response groups: ${responseGroups.length}`);
    for (const group of responseGroups) {
      console.log(`\n- Name: ${group.name}`);
      console.log(`  Description: ${group.description || 'N/A'}`);
      console.log(`  Color: ${group.color || 'N/A'}`);
      console.log(`  Templates Count: ${group._count.templates}`);
    }

    // Check Settings
    console.log('\n\n=== SETTINGS ===');
    const settings = await prisma.settings.findMany();
    
    console.log(`Total settings: ${settings.length}`);
    for (const setting of settings) {
      console.log(`\n- Key: ${setting.key}`);
      console.log(`  Value: ${setting.value}`);
      console.log(`  Updated: ${setting.updatedAt}`);
    }

    // Check Exchange Rate History
    console.log('\n\n=== EXCHANGE RATE HISTORY ===');
    const exchangeRates = await prisma.exchangeRateHistory.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' }
    });
    
    console.log(`Recent exchange rates (last 10):`);
    for (const rate of exchangeRates) {
      console.log(`\n- Rate: ${rate.rate}`);
      console.log(`  Source: ${rate.source}`);
      console.log(`  Time: ${rate.timestamp}`);
      if (rate.metadata) {
        console.log(`  Metadata: ${rate.metadata}`);
      }
    }

    // Check Processed Emails
    console.log('\n\n=== PROCESSED EMAILS ===');
    const processedEmailCount = await prisma.processedEmail.count();
    console.log(`Total processed emails: ${processedEmailCount}`);
    
    if (processedEmailCount > 0) {
      const recentEmails = await prisma.processedEmail.findMany({
        take: 5,
        orderBy: { processedAt: 'desc' }
      });
      
      console.log('\nRecent processed emails:');
      for (const email of recentEmails) {
        console.log(`- ${email.emailId} at ${email.processedAt}`);
      }
    }

    // Check Blacklisted Transactions
    console.log('\n\n=== BLACKLISTED TRANSACTIONS ===');
    const blacklistedCount = await prisma.blacklistedTransaction.count();
    console.log(`Total blacklisted transactions: ${blacklistedCount}`);
    
    if (blacklistedCount > 0) {
      const blacklisted = await prisma.blacklistedTransaction.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('\nRecent blacklisted transactions:');
      for (const bl of blacklisted) {
        console.log(`\n- Payout ID: ${bl.payoutId}`);
        console.log(`  Reason: ${bl.reason}`);
        console.log(`  Wallet: ${bl.wallet || 'N/A'}`);
        console.log(`  Amount: ${bl.amount || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('Error checking system data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSystemData();