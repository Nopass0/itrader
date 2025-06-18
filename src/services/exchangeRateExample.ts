/**
 * Example usage of the Exchange Rate Manager
 */

import { getExchangeRateManager } from './exchangeRateManager';

// Example 1: Basic usage
function basicUsage() {
  const rateManager = getExchangeRateManager();
  
  // Get current rate (default is 92.5)
  console.log('Current rate:', rateManager.getRate());
  
  // Update the rate
  rateManager.setRate(95.0);
  console.log('Updated rate:', rateManager.getRate());
}

// Example 2: Using listeners
function listenToRateChanges() {
  const rateManager = getExchangeRateManager();
  
  // Subscribe to rate updates
  const unsubscribe = rateManager.onRateUpdate((newRate) => {
    console.log(`Rate changed to: ${newRate}`);
  });
  
  // Trigger some rate changes
  rateManager.setRate(93.0);
  rateManager.setRate(94.5);
  
  // Unsubscribe when done
  unsubscribe();
}

// Example 3: Mode switching
function modeSwitching() {
  const rateManager = getExchangeRateManager();
  
  // Check current mode
  console.log('Current config:', rateManager.getConfig());
  
  // Switch to automatic mode (not implemented yet)
  rateManager.setMode('automatic');
  
  // Switch back to constant mode
  rateManager.setMode('constant');
}

// Example 4: Using in advertisement creation
async function createAdvertisement(amount: number) {
  const rateManager = getExchangeRateManager();
  const currentRate = rateManager.getRate();
  
  const priceInRub = amount * currentRate;
  
  console.log(`Creating advertisement:`);
  console.log(`Amount: ${amount} USDT`);
  console.log(`Rate: ${currentRate} RUB/USDT`);
  console.log(`Total: ${priceInRub} RUB`);
  
  // Create the actual advertisement with the calculated price
  // ...
}

// Example 5: Singleton pattern demonstration
function singletonDemo() {
  const manager1 = getExchangeRateManager();
  const manager2 = getExchangeRateManager();
  
  // Both references point to the same instance
  manager1.setRate(100);
  console.log('Manager2 rate:', manager2.getRate()); // Will be 100
}

// Run examples
if (require.main === module) {
  console.log('=== Basic Usage ===');
  basicUsage();
  
  console.log('\n=== Rate Change Listeners ===');
  listenToRateChanges();
  
  console.log('\n=== Mode Switching ===');
  modeSwitching();
  
  console.log('\n=== Advertisement Creation ===');
  createAdvertisement(100);
  
  console.log('\n=== Singleton Demo ===');
  singletonDemo();
}