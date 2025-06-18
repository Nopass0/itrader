#!/usr/bin/env ts-node

/**
 * Test script for price variation logic in Bybit P2P advertisements
 */

import { BybitP2PManagerService } from '../src/services/bybitP2PManager';

// Test the price conflict detection logic
function testPriceConflictDetection() {
  console.log('Testing price conflict detection logic...\n');
  
  const existingPrices = [85.0, 86.5, 88.0];
  const MIN_PRICE = 71.19;
  const MAX_PRICE = 90.97;
  
  // Function to check if a price conflicts with existing prices (within 5%)
  const hasConflict = (price: number): boolean => {
    for (const existingPrice of existingPrices) {
      const priceDifference = Math.abs(price - existingPrice) / existingPrice * 100;
      if (priceDifference < 5) {
        console.log(`Price ${price} conflicts with existing price ${existingPrice} (${priceDifference.toFixed(2)}% difference)`);
        return true;
      }
    }
    return false;
  };
  
  // Test cases
  const testPrices = [
    85.0,    // Should conflict with 85.0 (0% difference)
    85.5,    // Should conflict with 85.0 (0.59% difference)
    88.5,    // Should conflict with 88.0 (0.57% difference)
    89.3,    // Should NOT conflict (closest is 88.0 with 1.48% difference)
    91.0,    // Should NOT conflict (closest is 88.0 with 3.41% difference)
    81.0,    // Should NOT conflict (closest is 85.0 with 4.71% difference)
    80.75,   // Should NOT conflict (closest is 85.0 with 5.00% difference)
  ];
  
  console.log(`Existing prices: ${existingPrices.join(', ')}`);
  console.log('Testing prices:');
  
  for (const price of testPrices) {
    const conflicts = hasConflict(price);
    console.log(`  ${price.toFixed(2)}: ${conflicts ? 'CONFLICTS' : 'OK'}`);
  }
  
  // Test price adjustment logic
  console.log('\nTesting price adjustment logic...');
  
  let basePrice = 85.0;
  let finalPrice = basePrice;
  let priceAdjustmentAttempts = 0;
  const maxAttempts = 20;
  
  const adjustments = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.5, -2.5, 3.0, -3.0];
  
  while (hasConflict(finalPrice) && priceAdjustmentAttempts < maxAttempts) {
    priceAdjustmentAttempts++;
    
    if (priceAdjustmentAttempts <= adjustments.length) {
      const adjustment = adjustments[priceAdjustmentAttempts];
      finalPrice = basePrice + adjustment;
    } else {
      const randomAdjustment = (Math.random() - 0.5) * 4;
      finalPrice = basePrice + randomAdjustment;
    }
    
    finalPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, finalPrice));
    
    console.log(`Attempt ${priceAdjustmentAttempts}: Trying price ${finalPrice.toFixed(2)}`);
  }
  
  console.log(`\nFinal price found: ${finalPrice.toFixed(2)}`);
  console.log(`Price adjustment successful: ${!hasConflict(finalPrice)}`);
}

// Run the test
console.log('=== Price Variation Logic Test ===\n');
testPriceConflictDetection();

console.log('\n=== Test Complete ===');