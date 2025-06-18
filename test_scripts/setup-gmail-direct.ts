#!/usr/bin/env bun
/**
 * Direct Gmail OAuth Setup - handles input more carefully
 */

import { OAuth2Manager } from "./src/gmail/utils/oauth2";
import { GmailClient } from "./src/gmail";
import { db } from "./src/db";
import fs from "fs/promises";
import path from "path";

async function setup() {
  console.log("\n🔐 Gmail OAuth Setup (Direct Method)");
  console.log("====================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Create OAuth2Manager with OOB redirect
    const oauth2Manager = new OAuth2Manager(credentials);
    const authUrl = oauth2Manager.getAuthUrl();
    
    console.log("📌 Open this URL in your browser:");
    console.log(`\n${authUrl}\n`);
    console.log("📝 You will see a page with an authorization code");
    console.log("   Copy ONLY the code (like: 4/1AUJR-x6...)\n");
    
    // Use Bun's prompt for cleaner input
    const code = prompt("📋 Paste the authorization code here: ");
    
    if (!code || code.trim().length === 0) {
      console.error("\n❌ No code provided!");
      process.exit(1);
    }
    
    // Clean the code - remove any whitespace or newlines
    const cleanCode = code.trim().replace(/\s+/g, '');
    
    console.log(`\n🔍 Code received (length: ${cleanCode.length})`);
    console.log(`   First 20 chars: ${cleanCode.substring(0, 20)}...`);
    console.log("\n🔄 Exchanging code for tokens...");
    
    try {
      const tokens = await oauth2Manager.getTokenFromCode(cleanCode);
      
      console.log("\n✅ Success! Tokens received.");
      
      if (!tokens.refresh_token) {
        console.warn("\n⚠️  Warning: No refresh token received.");
        console.log("   You may need to revoke access and try again:");
        console.log("   https://myaccount.google.com/permissions");
      }
      
      // Create client and get profile
      const client = new GmailClient(oauth2Manager);
      await client.setTokens(tokens);
      const profile = await client.getUserProfile();
      
      // Save to database
      await db.upsertGmailAccount({
        email: profile.emailAddress || "unknown",
        refreshToken: tokens.refresh_token || "",
      });
      
      console.log(`\n✅ Gmail account ${profile.emailAddress} setup successfully!`);
      
      // Test the connection
      console.log("\n🧪 Testing email access...");
      try {
        const emails = await client.getEmailsFromSender("noreply@tinkoff.ru", 1);
        console.log(`✅ Test passed! Can access emails.`);
      } catch (testError) {
        console.warn("⚠️  Could not fetch test emails, but setup completed.");
      }
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code!");
      console.error(`\nError: ${error.message}`);
      
      if (error.message?.includes("invalid_grant")) {
        console.log("\n💡 This error usually means:");
        console.log("   1. The code was already used (each code works only ONCE)");
        console.log("   2. The code expired (use it within 1-2 minutes)");
        console.log("   3. Wrong OAuth client configuration");
        console.log("\n🔄 Get a NEW code by opening the URL again in incognito mode!");
      }
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();