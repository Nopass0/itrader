#!/usr/bin/env bun
/**
 * Test script to verify Itrader setup
 */

import { db } from "./src/db";
import { GmailClient } from "./src/gmail";
import { OAuth2Manager } from "./src/gmail/utils/oauth2";
import fs from "fs/promises";
import path from "path";

const CHECKMARK = "✓";
const CROSS = "✗";
const WARNING = "⚠";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message?: string;
}

const results: TestResult[] = [];

function addResult(name: string, status: "pass" | "fail" | "warning", message?: string) {
  results.push({ name, status, message });
}

async function testDatabase() {
  try {
    await db.connect();
    const gateAccounts = await db.getActiveGateAccounts();
    const bybitAccounts = await db.getActiveBybitAccounts();
    const gmailAccount = await db.getActiveGmailAccount();
    
    addResult("Database connection", "pass");
    
    if (gateAccounts.length === 0) {
      addResult("Gate accounts", "warning", "No Gate accounts configured");
    } else {
      addResult("Gate accounts", "pass", `${gateAccounts.length} account(s) found`);
    }
    
    if (bybitAccounts.length === 0) {
      addResult("Bybit accounts", "warning", "No Bybit accounts configured");
    } else {
      addResult("Bybit accounts", "pass", `${bybitAccounts.length} account(s) found`);
    }
    
    if (!gmailAccount) {
      addResult("Gmail account", "warning", "No Gmail account configured");
    } else {
      addResult("Gmail account", "pass", `Configured: ${gmailAccount.email}`);
    }
    
    return true;
  } catch (error: any) {
    addResult("Database", "fail", error.message);
    return false;
  }
}

async function testGmailCredentials() {
  try {
    const credentialsPath = path.join("data", "gmail-credentials.json");
    
    try {
      await fs.access(credentialsPath);
      addResult("Gmail credentials file", "pass", "Found");
    } catch {
      addResult("Gmail credentials file", "fail", "Not found at data/gmail-credentials.json");
      return false;
    }
    
    const content = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const creds = content.installed || content.web || content;
    
    if (creds.client_id && creds.client_secret) {
      addResult("Gmail credentials format", "pass", "Valid OAuth2 credentials");
    } else {
      addResult("Gmail credentials format", "fail", "Invalid credentials format");
      return false;
    }
    
    return true;
  } catch (error: any) {
    addResult("Gmail credentials", "fail", error.message);
    return false;
  }
}

async function testGmailConnection() {
  try {
    const gmailAccount = await db.getActiveGmailAccount();
    if (!gmailAccount) {
      addResult("Gmail connection", "warning", "No Gmail account to test");
      return true;
    }
    
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    const oauth2Manager = new OAuth2Manager(credentials);
    const client = new GmailClient(oauth2Manager);
    
    await client.setTokens({ refresh_token: gmailAccount.refreshToken });
    const emails = await client.getEmailsFromSender("noreply@tinkoff.ru", 1);
    
    addResult("Gmail API connection", "pass", "Successfully connected");
    return true;
  } catch (error: any) {
    if (error.message?.includes("invalid_grant")) {
      addResult("Gmail API connection", "fail", "Invalid refresh token - need to re-authorize");
    } else {
      addResult("Gmail API connection", "fail", error.message);
    }
    return false;
  }
}

async function main() {
  console.log("\n🔍 Itrader Setup Test");
  console.log("=".repeat(50));
  
  // Run tests
  await testDatabase();
  await testGmailCredentials();
  await testGmailConnection();
  
  // Display results
  console.log("\n📊 Test Results:");
  console.log("=".repeat(50));
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const result of results) {
    const icon = result.status === "pass" ? CHECKMARK : 
                 result.status === "warning" ? WARNING : CROSS;
    const color = result.status === "pass" ? "\x1b[32m" : 
                  result.status === "warning" ? "\x1b[33m" : "\x1b[31m";
    const reset = "\x1b[0m";
    
    console.log(`${color}${icon}${reset} ${result.name}${result.message ? `: ${result.message}` : ""}`);
    
    if (result.status === "fail") hasErrors = true;
    if (result.status === "warning") hasWarnings = true;
  }
  
  console.log("\n" + "=".repeat(50));
  
  if (hasErrors) {
    console.log("\n❌ Setup has errors that need to be fixed:");
    console.log("   Run 'fix-issues.bat' to fix common problems");
  } else if (hasWarnings) {
    console.log("\n⚠️  Setup is incomplete but functional:");
    console.log("   Run 'bun run cli' to configure missing accounts");
  } else {
    console.log("\n✅ All tests passed! Itrader is ready to use.");
  }
  
  await db.disconnect();
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});