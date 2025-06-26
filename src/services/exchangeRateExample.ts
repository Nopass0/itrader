/**
 * Exchange Rate Manager Example
 * Demonstrates automatic mode functionality
 */

import { getExchangeRateManager } from "./exchangeRateManager";
import { createLogger } from "../logger";

const logger = createLogger('ExchangeRateExample');

async function demonstrateAutomaticMode() {
  try {
    const manager = getExchangeRateManager();
    
    logger.info("=== Exchange Rate Manager Demo ===");
    
    // Get current configuration
    const config = manager.getConfig();
    logger.info("Current configuration:", config);
    
    // Get current rate
    const currentRate = await manager.getRate();
    logger.info(`Current rate: ${currentRate} RUB/USDT`);
    
    // Create some example rules
    logger.info("\n=== Creating Example Rules ===");
    
    // Rule 1: Business hours - use first ad on page 1
    const rule1 = await manager.createRule({
      name: "Business Hours Rate",
      priority: 100,
      timeStart: "09:00",
      timeEnd: "18:00",
      pageNumber: 1,
      adIndex: 0,
      priceAdjustment: 2.5, // 2.5% markup
      enabled: true
    });
    logger.info("Created rule:", rule1);
    
    // Rule 2: Evening hours - use second ad on page 1
    const rule2 = await manager.createRule({
      name: "Evening Rate",
      priority: 90,
      timeStart: "18:00",
      timeEnd: "23:00",
      pageNumber: 1,
      adIndex: 1,
      priceAdjustment: 3.0, // 3% markup
      enabled: true
    });
    logger.info("Created rule:", rule2);
    
    // Rule 3: Night hours - use third ad on page 1
    const rule3 = await manager.createRule({
      name: "Night Rate",
      priority: 80,
      timeStart: "23:00",
      timeEnd: "09:00",
      pageNumber: 1,
      adIndex: 2,
      priceAdjustment: 4.0, // 4% markup
      enabled: true
    });
    logger.info("Created rule:", rule3);
    
    // Rule 4: Default fallback - use first ad on page 2
    const rule4 = await manager.createRule({
      name: "Default Rate",
      priority: 50,
      pageNumber: 2,
      adIndex: 0,
      priceAdjustment: 2.0, // 2% markup
      enabled: true
    });
    logger.info("Created rule:", rule4);
    
    // Test rules
    logger.info("\n=== Testing Rules ===");
    
    for (const rule of [rule1, rule2, rule3, rule4]) {
      try {
        const testResult = await manager.testRule({
          name: rule.name,
          priority: rule.priority,
          timeStart: rule.timeStart,
          timeEnd: rule.timeEnd,
          pageNumber: rule.pageNumber,
          adIndex: rule.adIndex,
          priceAdjustment: rule.priceAdjustment,
          enabled: rule.enabled
        });
        logger.info(`Test ${rule.name}:`, testResult);
      } catch (error) {
        logger.error(`Failed to test rule ${rule.name}:`, error as Error);
      }
    }
    
    // Get Bybit P2P statistics
    logger.info("\n=== Bybit P2P Statistics ===");
    try {
      const stats = await manager.getRateStatistics(1);
      logger.info("Page 1 statistics:", {
        count: stats.count,
        minPrice: stats.minPrice,
        maxPrice: stats.maxPrice,
        avgPrice: stats.avgPrice,
        median: stats.median
      });
      
      // Show first 5 advertisements
      logger.info("First 5 advertisements:");
      stats.advertisements.slice(0, 5).forEach((ad: any) => {
        logger.info(`  [${ad.index}] ${ad.advertiser}: ${ad.price} RUB/USDT (${ad.minAmount}-${ad.maxAmount} USDT)`);
      });
    } catch (error) {
      logger.error("Failed to get Bybit statistics:", error as Error);
    }
    
    // Update configuration
    logger.info("\n=== Updating Configuration ===");
    await manager.updateConfig({
      updateInterval: 300000, // 5 minutes
      fallbackRate: 80 // Fallback rate when no rules match
    });
    logger.info("Configuration updated");
    
    // Switch to automatic mode
    logger.info("\n=== Switching to Automatic Mode ===");
    await manager.setMode("automatic");
    logger.info("Switched to automatic mode");
    
    // Get rate in automatic mode
    const automaticRate = await manager.getRate();
    logger.info(`Current automatic rate: ${automaticRate} RUB/USDT`);
    
    // Listen for rate updates
    const unsubscribe = manager.onRateUpdate((newRate) => {
      logger.info(`Rate updated: ${newRate} RUB/USDT`);
    });
    
    // Wait for a minute to see automatic updates
    logger.info("\n=== Waiting for automatic updates (60 seconds) ===");
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Clean up
    unsubscribe();
    
    // Get all rules
    logger.info("\n=== All Rules ===");
    const allRules = await manager.getRules();
    allRules.forEach(rule => {
      logger.info(`${rule.name} (priority: ${rule.priority}, enabled: ${rule.enabled})`);
    });
    
    // Delete example rules
    logger.info("\n=== Cleaning Up ===");
    for (const rule of [rule1, rule2, rule3, rule4]) {
      await manager.deleteRule(rule.id);
      logger.info(`Deleted rule: ${rule.name}`);
    }
    
    // Switch back to constant mode
    await manager.setMode("constant");
    logger.info("Switched back to constant mode");
    
  } catch (error) {
    logger.error("Example failed:", error as Error);
  }
}

// Basic usage examples (keeping old examples for compatibility)
function basicUsage() {
  const rateManager = getExchangeRateManager();
  
  // Get current rate
  rateManager.getRate().then(rate => {
    console.log('Current rate:', rate);
  });
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateAutomaticMode()
    .then(() => {
      logger.info("Example completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Example failed:", error);
      process.exit(1);
    });
}

export { demonstrateAutomaticMode };