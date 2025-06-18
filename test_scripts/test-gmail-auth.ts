#!/usr/bin/env bun
/**
 * Simple Gmail OAuth test
 */

import fs from "fs/promises";
import path from "path";

async function test() {
  console.log("\n🔍 Gmail OAuth Diagnostic");
  console.log("========================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    console.log("📋 Your OAuth Configuration:");
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Project: ${credentials.project_id}`);
    console.log(`   Type: ${credentialsContent.installed ? "Desktop app" : "Web app"}`);
    console.log(`   Configured redirect URIs in file: ${JSON.stringify(credentials.redirect_uris)}\n`);
    
    // Generate different auth URLs to test
    const redirectUris = [
      "http://localhost",
      "http://localhost/",
      "http://127.0.0.1",
      "https://localhost"
    ];
    
    console.log("🔗 Test these URLs one by one in incognito mode:\n");
    
    for (const redirectUri of redirectUris) {
      const params = new URLSearchParams({
        client_id: credentials.client_id,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify",
        access_type: "offline",
        prompt: "consent"
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      console.log(`Redirect URI: ${redirectUri}`);
      console.log(`URL: ${authUrl}\n`);
    }
    
    console.log("💡 Instructions:");
    console.log("1. Try each URL above in a new incognito window");
    console.log("2. See which one works (redirects after authorization)");
    console.log("3. The working redirect_uri must be added to Google Console");
    console.log("\n📝 To fix in Google Console:");
    console.log("1. Go to https://console.cloud.google.com/apis/credentials");
    console.log("2. Click on your OAuth client");
    console.log("3. Add ALL these URIs to 'Authorized redirect URIs':");
    console.log("   - http://localhost");
    console.log("   - http://localhost/");
    console.log("   - http://127.0.0.1");
    console.log("4. Save and wait 5-10 minutes");
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

test();