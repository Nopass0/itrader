#!/usr/bin/env bun

console.log("🚀 Starting iTrader in auto mode with active orders monitoring...\n");

// Set auto mode
process.env.MODE = 'auto';

// Import and run main app
import("./src/app").then(module => {
  module.default().catch((error: any) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}).catch(error => {
  console.error("❌ Import error:", error);
  process.exit(1);
});