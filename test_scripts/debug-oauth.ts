#!/usr/bin/env bun
/**
 * Debug OAuth2 issues
 */

import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";

async function debug() {
  console.log("\n🔍 OAuth2 Debug");
  console.log("===============\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    console.log("📋 Client Configuration:");
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Project ID: ${credentials.project_id}`);
    console.log(`   Redirect URIs: ${JSON.stringify(credentials.redirect_uris)}`);
    
    // Test with each redirect URI
    for (const redirectUri of credentials.redirect_uris || []) {
      console.log(`\n🔗 Testing with redirect URI: ${redirectUri}`);
      
      const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        redirectUri
      );
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
      });
      
      console.log(`   Auth URL: ${authUrl}`);
      
      if (redirectUri === "urn:ietf:wg:oauth:2.0:oob") {
        console.log("\n⚠️  IMPORTANT: Google deprecated OOB flow!");
        console.log("   You need to update your OAuth2 client configuration.");
      }
    }
    
    console.log("\n💡 Solution:");
    console.log("1. Go to https://console.cloud.google.com/");
    console.log("2. Select your project: " + credentials.project_id);
    console.log("3. Go to APIs & Services > Credentials");
    console.log("4. Click on your OAuth 2.0 Client ID");
    console.log("5. Add these Authorized redirect URIs:");
    console.log("   - http://localhost");
    console.log("   - http://localhost:3000");
    console.log("   - http://localhost:8080");
    console.log("6. Save the changes");
    console.log("7. Wait 5 minutes for changes to propagate");
    console.log("\nThen try the setup again!");
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

debug();