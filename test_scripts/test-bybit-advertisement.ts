#!/usr/bin/env ts-node

/**
 * Test script to verify Bybit advertisement creation with correct parameters
 */

import { P2PManager } from './src/bybit';
import { getExchangeRateManager } from './src/services/exchangeRateManager';

async function testAdvertisementCreation() {
  console.log('Testing Bybit P2P Advertisement Creation with corrected parameters...\n');

  const manager = new P2PManager();
  
  // Add a test account (you'll need to replace with real credentials)
  const accountId = 'test-account';
  const config = {
    apiKey: process.env.BYBIT_API_KEY || 'your-api-key',
    apiSecret: process.env.BYBIT_API_SECRET || 'your-api-secret',
    testnet: false,
    debugMode: true,
    recvWindow: 20000
  };

  try {
    // Add account
    await manager.addAccount(accountId, config);
    console.log('✓ Account added successfully\n');

    // Get exchange rate
    const exchangeRateManager = getExchangeRateManager();
    const exchangeRate = exchangeRateManager.getRate();
    console.log(`Exchange rate: ${exchangeRate} RUB/USDT\n`);

    // List payment methods first
    console.log('Fetching payment methods...');
    const paymentMethods = await manager.getPaymentMethods(accountId);
    console.log('Available payment methods:', JSON.stringify(paymentMethods, null, 2));

    // Show the correct parameter format
    const testParams = {
      tokenId: "USDT",
      currencyId: "RUB",
      side: "1", // 1 = SELL
      priceType: "0", // 0 = FIXED
      price: exchangeRate.toString(),
      premium: "", // Empty for fixed price
      minAmount: "2000",
      maxAmount: "2000",
      quantity: "26.62",
      paymentIds: ["18175385"], // Replace with actual payment method ID
      remark: "Fast trade, instant release",
      paymentPeriod: "15", // 15 minutes as string
      itemType: "ORIGIN",
      tradingPreferenceSet: {}
    };

    console.log('\nTest advertisement parameters:');
    console.log(JSON.stringify(testParams, null, 2));

    console.log('\nParameter mapping:');
    console.log('- tokenId: "USDT" (was: asset)');
    console.log('- currencyId: "RUB" (was: fiatCurrency)');
    console.log('- side: "1" for SELL, "0" for BUY (was: "SELL"/"BUY")');
    console.log('- priceType: "0" for FIXED, "1" for FLOAT (was: "FIXED"/"FLOAT")');
    console.log('- premium: "" (empty for fixed price)');
    console.log('- minAmount/maxAmount: (was: minOrderAmount/maxOrderAmount)');
    console.log('- remark: (was: remarks)');
    console.log('- paymentPeriod: "15" as string (was: paymentTime as number)');
    console.log('- itemType: "ORIGIN" (new required field)');
    console.log('- tradingPreferenceSet: {} (new required field)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    manager.stop();
  }
}

// Run the test
testAdvertisementCreation().catch(console.error);