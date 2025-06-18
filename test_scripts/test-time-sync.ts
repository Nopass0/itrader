#!/usr/bin/env bun

import { TimeSync } from "../src/bybit/utils/timeSync";
import axios from "axios";

async function testTimeSync() {
  console.log("🕐 Testing Time Synchronization\n");

  // 1. Check local time
  const localTime = Date.now();
  console.log("Local time:");
  console.log(`  Timestamp: ${localTime}`);
  console.log(`  Date: ${new Date(localTime).toISOString()}`);

  // 2. Get Bybit server time directly
  console.log("\nBybit server time:");
  try {
    const response = await axios.get('https://api.bybit.com/v5/market/time');
    const serverTimeSeconds = parseInt(response.data.result.timeSecond);
    const serverTimeMillis = serverTimeSeconds * 1000;
    
    console.log(`  Timestamp (seconds): ${serverTimeSeconds}`);
    console.log(`  Timestamp (millis): ${serverTimeMillis}`);
    console.log(`  Date: ${new Date(serverTimeMillis).toISOString()}`);
    
    const offset = serverTimeMillis - localTime;
    console.log(`\nTime difference: ${offset}ms (${(offset / 1000).toFixed(1)} seconds)`);
    
    if (Math.abs(offset) > 1000) {
      console.log("⚠️  WARNING: System clock is off by more than 1 second!");
    }
  } catch (error) {
    console.error("Failed to get server time:", error.message);
  }

  // 3. Test TimeSync class
  console.log("\n\nTesting TimeSync class:");
  
  console.log("Before sync:");
  console.log(`  Is synchronized: ${TimeSync.isSynchronized()}`);
  console.log(`  Current offset: ${TimeSync.getOffset()}ms`);
  
  console.log("\nSyncing...");
  await TimeSync.forceSync();
  
  console.log("\nAfter sync:");
  console.log(`  Is synchronized: ${TimeSync.isSynchronized()}`);
  console.log(`  Current offset: ${TimeSync.getOffset()}ms`);
  console.log(`  Synchronized timestamp: ${TimeSync.getTimestamp()}`);
  console.log(`  Synchronized date: ${new Date(parseInt(TimeSync.getTimestamp())).toISOString()}`);

  // 4. Test multiple timestamps
  console.log("\n\nGenerating multiple timestamps:");
  for (let i = 0; i < 5; i++) {
    const ts = TimeSync.getTimestamp();
    console.log(`  ${i + 1}. ${ts} - ${new Date(parseInt(ts)).toISOString()}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 5. Check recv_window calculation
  console.log("\n\nChecking recv_window:");
  const timestamp = TimeSync.getTimestamp();
  const serverTime = Date.now() + TimeSync.getOffset();
  const diff = Math.abs(serverTime - parseInt(timestamp));
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Server time (estimated): ${serverTime}`);
  console.log(`  Difference: ${diff}ms`);
  console.log(`  Would pass with recv_window=5000: ${diff < 5000 ? 'YES' : 'NO'}`);
  console.log(`  Would pass with recv_window=50000: ${diff < 50000 ? 'YES' : 'NO'}`);
}

testTimeSync().catch(console.error);