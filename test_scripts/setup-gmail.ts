#!/usr/bin/env bun
/**
 * Gmail OAuth Setup Script
 * Handles both automatic and manual OAuth flows
 */

import { db } from "./src/db";
import { GmailClient } from "./src/gmail";
import { OAuth2Manager } from "./src/gmail/utils/oauth2";
import { createOAuth2Manager, extractCodeFromUrl, validateCredentials } from "./src/gmail/utils/oauth2Fix";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setup() {
  console.log("\n🔐 Gmail OAuth Setup");
  console.log("====================\n");

  try {
    // Check credentials file
    const credentialsPath = path.join("data", "gmail-credentials.json");
    
    try {
      await fs.access(credentialsPath);
    } catch {
      console.error("❌ Error: Gmail credentials file not found!");
      console.log(`\n📁 Please place your Google OAuth2 credentials at:`);
      console.log(`   ${credentialsPath}`);
      console.log("\n📋 To get credentials:");
      console.log("   1. Go to https://console.cloud.google.com/");
      console.log("   2. Create a new project or select existing");
      console.log("   3. Enable Gmail API");
      console.log("   4. Create credentials (OAuth 2.0 Client ID)");
      console.log("   5. Select 'Desktop app' as application type");
      console.log("   6. Download the credentials JSON file");
      console.log(`   7. Save it as: ${credentialsPath}\n`);
      process.exit(1);
    }

    // Load and validate credentials
    console.log("📄 Loading credentials...");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    
    if (!validateCredentials(credentialsContent)) {
      console.error("❌ Invalid credentials file!");
      console.log("\n⚠️  The credentials file must contain:");
      console.log("   - client_id");
      console.log("   - client_secret");
      console.log("\nMake sure you downloaded the correct OAuth2 credentials file.\n");
      process.exit(1);
    }

    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Create OAuth2Manager
    const oauth2Manager = createOAuth2Manager(credentials);
    const authUrl = oauth2Manager.getAuthUrl();

    console.log("\n🌐 Authorization Required");
    console.log("========================");
    console.log("\n📌 Open this URL in your browser:");
    console.log(`\n${authUrl}\n`);
    
    console.log("📝 After authorization, you'll be redirected to a URL like:");
    console.log("   http://localhost/?code=4/0AX4XfWh...&scope=...\n");
    
    console.log("✂️  Copy the ENTIRE redirect URL or just the code part");
    console.log("   (The code is the part between 'code=' and '&scope')\n");

    const input = await question("📋 Paste the authorization code or full URL here: ");
    
    // Extract code from input (could be full URL or just the code)
    let code = input.trim();
    
    // Check if input looks like a URL
    if (input.includes("http") || input.includes("code=")) {
      const extracted = extractCodeFromUrl(input);
      if (extracted) {
        code = extracted;
        console.log("\n✅ Code extracted from URL");
      }
    }

    console.log("\n🔄 Exchanging code for tokens...");
    
    try {
      const tokens = await oauth2Manager.getTokenFromCode(code);
      
      if (!tokens.refresh_token) {
        console.warn("\n⚠️  Warning: No refresh token received.");
        console.log("   This might happen if you've authorized this app before.");
        console.log("   You may need to revoke access and try again:");
        console.log("   https://myaccount.google.com/permissions\n");
      }

      // Create client and get profile
      console.log("👤 Getting user profile...");
      const client = new GmailClient(oauth2Manager);
      await client.setTokens(tokens);
      const profile = await client.getUserProfile();

      // Save to database
      console.log("💾 Saving to database...");
      await db.upsertGmailAccount({
        email: profile.emailAddress || "unknown",
        refreshToken: tokens.refresh_token || "",
      });

      console.log(`\n✅ Success! Gmail account ${profile.emailAddress} is now configured.`);
      
      // Test the connection
      console.log("\n🧪 Testing email access...");
      try {
        const emails = await client.getEmailsFromSender("noreply@tinkoff.ru", 1);
        console.log(`✅ Test passed! Found ${emails.length} email(s) from Tinkoff.`);
      } catch (testError) {
        console.warn("⚠️  Could not fetch test emails, but setup completed.");
      }
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code for tokens!");
      
      if (error.message?.includes("invalid_grant")) {
        console.log("\n🔍 Common causes:");
        console.log("   - Code already used (each code can only be used once)");
        console.log("   - Code expired (codes expire after a few minutes)");
        console.log("   - Wrong redirect URI in credentials");
        console.log("   - Incorrect code copied\n");
        console.log("💡 Try the setup again with a fresh authorization.");
      } else {
        console.log(`\n📝 Error details: ${error.message}`);
      }
      
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ Setup failed!");
    console.error(`📝 Error: ${error.message || error}`);
    process.exit(1);
  } finally {
    rl.close();
    await db.disconnect();
  }
}

// Run setup
setup().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});