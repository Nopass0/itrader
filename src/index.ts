#!/usr/bin/env bun
/**
 * Main entry point for Itrader application
 */

import main from "./app";
import { runCLI } from "./cli";

// Parse command line arguments
const args = process.argv.slice(2);
const isCliMode = args.includes("--cli") || args.includes("-c");

async function start() {
  try {
    if (isCliMode) {
      // Run in CLI mode
      console.log("Starting Itrader CLI...\n");
      await runCLI();
    } else {
      // Run main application
      console.log("Starting Itrader...\n");
      await main();
    }
  } catch (error) {
    console.error("Application error:", error);
    process.exit(1);
  }
}

// Start the application
start();