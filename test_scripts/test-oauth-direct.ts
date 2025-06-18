#!/usr/bin/env bun
/**
 * Direct OAuth test with detailed debugging
 */

import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";

async function testOAuth() {
  console.log("\n🔍 Testing OAuth Configuration");
  console.log("==============================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    console.log("📋 Current Configuration:");
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Redirect URIs: ${JSON.stringify(credentials.redirect_uris)}\n`);
    
    // Test with a simple code
    const testCode = "4/0AUJR-x7kyDzUHMn3GNwsV-FbnsSUWbyJiC_c4_GUih2H9pF2UfOpyNO5wKJr7UvihRLCgw";
    console.log("🧪 Testing with your last code...\n");
    
    // Try with each redirect URI
    for (const redirectUri of credentials.redirect_uris || []) {
      console.log(`\n📍 Testing with redirect URI: ${redirectUri}`);
      
      const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        redirectUri
      );
      
      try {
        console.log("   Attempting token exchange...");
        const { tokens } = await oauth2Client.getToken(testCode);
        console.log("   ✅ SUCCESS! Tokens received!");
        console.log(`   Access Token: ${tokens.access_token?.substring(0, 20)}...`);
        return;
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
        if (error.response?.data) {
          console.log(`   Details: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
    
    console.log("\n💡 None of the redirect URIs worked.");
    console.log("\n📋 Next Steps:");
    console.log("1. Go to https://console.cloud.google.com/");
    console.log("2. Select your project");
    console.log("3. Go to APIs & Services > Credentials");
    console.log("4. Click on your OAuth 2.0 Client ID");
    console.log("5. Check the 'Authorized redirect URIs' section");
    console.log("6. Make sure it includes EXACTLY:");
    console.log("   - http://localhost:8080");
    console.log("   - http://localhost");
    console.log("7. If you made changes, wait 5-10 minutes before trying again");
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

testOAuth();