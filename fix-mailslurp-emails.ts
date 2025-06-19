import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixMailslurpEmails() {
  console.log('🔧 Checking MailSlurp email accounts\n');
  
  try {
    // Получим все MailSlurp аккаунты
    const allAccounts = await prisma.mailslurpAccount.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`📊 Total MailSlurp accounts in DB: ${allAccounts.length}`);
    console.log('=====================================');
    
    allAccounts.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.email}`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Inbox ID: ${acc.inboxId}`);
      console.log(`   Active: ${acc.isActive}`);
      console.log(`   Created: ${acc.createdAt.toLocaleString()}`);
      console.log('');
    });
    
    // Проверим активные аккаунты
    const activeAccounts = allAccounts.filter(acc => acc.isActive);
    console.log(`✅ Active accounts: ${activeAccounts.length}`);
    
    // Если нет активных аккаунтов, активируем первые 6
    if (activeAccounts.length === 0 && allAccounts.length >= 6) {
      console.log('\n⚠️  No active accounts found! Activating first 6...\n');
      
      const accountsToActivate = allAccounts.slice(0, 6);
      for (const acc of accountsToActivate) {
        await prisma.mailslurpAccount.update({
          where: { id: acc.id },
          data: { isActive: true }
        });
        console.log(`   ✅ Activated: ${acc.email}`);
      }
    }
    
    if (activeAccounts.length > 6) {
      console.log('\n⚠️  WARNING: More than 6 active accounts found!');
      console.log('   Deactivating excess accounts...\n');
      
      // Оставляем только первые 6 активными
      const accountsToDeactivate = activeAccounts.slice(6);
      
      for (const acc of accountsToDeactivate) {
        await prisma.mailslurpAccount.update({
          where: { id: acc.id },
          data: { isActive: false }
        });
        console.log(`   ❌ Deactivated: ${acc.email}`);
      }
      
      console.log(`\n✅ Deactivated ${accountsToDeactivate.length} excess accounts`);
    }
    
    // Пропустим проверку Email таблицы, так как она не существует
    
    // Финальная статистика
    const finalActive = await prisma.mailslurpAccount.count({
      where: { isActive: true }
    });
    
    // Email таблицы нет в схеме
    
    console.log('\n📊 Final status:');
    console.log(`   Active MailSlurp accounts: ${finalActive}`);
    
    if (finalActive > 6) {
      console.log('\n⚠️  Still have more than 6 active accounts!');
      console.log('   Run this script again or manually deactivate excess accounts.');
    } else if (finalActive < 6) {
      console.log('\n⚠️  Less than 6 active accounts!');
      console.log('   The app will create more on next startup.');
    } else {
      console.log('\n✅ Perfect! Exactly 6 active accounts.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMailslurpEmails();