#!/usr/bin/env bun
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { TimeSync } from './src/bybit/utils/timeSync';

async function main() {
  const orderId = '1932153795647381504';
  console.log(`🔍 Testing message send to order: ${orderId}\n`);

  try {
    // Force time sync
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    if (accounts.length === 0) {
      console.log('No active accounts found');
      return;
    }

    const account = accounts[0];
    console.log(`Using account: ${account.accountId}\n`);
    
    const client = bybitManager.getClient(account.accountId);
    
    // Send test message
    console.log('📨 Sending test message...');
    try {
      const testMessage = `Тест ${new Date().toLocaleTimeString('ru-RU')}`;
      
      await client.sendChatMessage({
        orderId: orderId,
        message: testMessage,
        messageType: 'TEXT'
      });
      
      console.log('✅ Message sent successfully!');
      console.log(`Message: ${testMessage}`);
      
    } catch (error: any) {
      console.error('❌ Error sending message:', error.message);
      if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

main().catch(console.error);