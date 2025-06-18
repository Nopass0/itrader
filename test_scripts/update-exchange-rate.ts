#!/usr/bin/env bun

import { getExchangeRateManager } from "./src/services/exchangeRateManager";

// Update the exchange rate to be within Bybit's allowed range
const manager = getExchangeRateManager();
const currentRate = manager.getRate();
const newRate = 85.0; // Middle of the allowed range (71.19 - 90.97)

console.log(`Current exchange rate: ${currentRate} RUB/USDT`);
console.log(`Updating to: ${newRate} RUB/USDT`);

manager.setRate(newRate);

console.log(`New exchange rate: ${manager.getRate()} RUB/USDT`);
console.log("\nNote: Bybit's allowed price range is 71.19 - 90.97 RUB/USDT");