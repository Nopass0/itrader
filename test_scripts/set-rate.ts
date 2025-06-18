#!/usr/bin/env bun

/**
 * Quick script to set exchange rate from command line
 * Usage: bun set-rate.ts <rate>
 * Example: bun set-rate.ts 85.5
 */

import { getExchangeRateManager } from "./src/services/exchangeRateManager";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: bun set-rate.ts <rate>");
  console.log("Example: bun set-rate.ts 85.5");
  
  const rateManager = getExchangeRateManager();
  const currentRate = rateManager.getRate();
  console.log(`\nCurrent rate: ${currentRate.toFixed(2)} RUB/USDT`);
  process.exit(0);
}

const rate = parseFloat(args[0]);

if (isNaN(rate) || rate <= 0) {
  console.error("Error: Rate must be a positive number");
  process.exit(1);
}

const rateManager = getExchangeRateManager();
const oldRate = rateManager.getRate();

rateManager.setRate(rate);

console.log(`✓ Exchange rate updated`);
console.log(`  Old rate: ${oldRate.toFixed(2)} RUB/USDT`);
console.log(`  New rate: ${rate.toFixed(2)} RUB/USDT`);