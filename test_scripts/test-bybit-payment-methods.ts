/**
 * Test script to check Bybit payment methods
 * This helps debug payment method ID issues
 */

import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { db } from './src/db';

async function testPaymentMethods() {
  console.log('=== Testing Bybit Payment Methods ===\n');

  try {
    // Initialize the manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // Get all active Bybit accounts
    const accounts = await db.getActiveBybitAccounts();
    
    if (accounts.length === 0) {
      console.log('No active Bybit accounts found.');
      return;
    }

    console.log(`Found ${accounts.length} active Bybit account(s)\n`);

    // List payment methods for each account
    for (const account of accounts) {
      console.log(`\n--- Account: ${account.accountId} ---`);
      
      try {
        const paymentMethods = await bybitManager.listPaymentMethods(account.accountId);
        
        if (paymentMethods.length === 0) {
          console.log('No payment methods configured for this account.');
          console.log('Please add payment methods in your Bybit P2P settings.');
        } else {
          console.log(`Found ${paymentMethods.length} payment method(s):\n`);
          
          paymentMethods.forEach((method, index) => {
            console.log(`${index + 1}. ${method.name}`);
            console.log(`   ID: ${method.id}`);
            console.log(`   Type: ${method.type}`);
            if (method.bankName) {
              console.log(`   Bank: ${method.bankName}`);
            }
            console.log(`   Enabled: ${method.isEnabled}`);
            console.log('');
          });
        }
      } catch (error) {
        console.error(`Failed to get payment methods: ${error.message}`);
      }
    }

    console.log('\n=== Payment Method Mapping ===');
    console.log('\nThe system will automatically map payment methods as follows:');
    console.log('- Methods with "Tinkoff" in name/bank -> "Tinkoff"');
    console.log('- Methods with "SBP", "Sber" in name/bank -> "SBP"');
    console.log('\nMake sure your payment methods are named appropriately.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.client.$disconnect();
    process.exit(0);
  }
}

// Run the test
testPaymentMethods().catch(console.error);