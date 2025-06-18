#!/usr/bin/env bun
/**
 * Debug Gmail OAuth - показывает точно что отправляется
 */

import { google } from "googleapis";
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

async function debug() {
  console.log("\n🔍 Gmail OAuth Debug Mode");
  console.log("=========================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.web || credentialsContent.installed || credentialsContent;
    
    console.log("📋 Credentials info:");
    console.log(`   Type: ${credentialsContent.web ? "Web app" : "Desktop app"}`);
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Client Secret: ${credentials.client_secret?.substring(0, 10)}...`);
    console.log(`   Redirect URIs: ${JSON.stringify(credentials.redirect_uris)}\n`);
    
    // Test with the exact redirect URI
    const redirectUri = "http://localhost";
    
    console.log(`📍 Using redirect URI: ${redirectUri}\n`);
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      redirectUri
    );
    
    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      prompt: "consent",
    });
    
    console.log("1. Open this URL in incognito:");
    console.log(`\n${authUrl}\n`);
    console.log("2. Complete authorization");
    console.log("3. Copy the FULL URL after redirect\n");
    
    const input = await question("Paste URL or code: ");
    rl.close();
    
    // Process input
    console.log("\n📊 Input analysis:");
    console.log(`   Length: ${input.length}`);
    console.log(`   Contains %: ${input.includes("%")}`);
    console.log(`   Starts with http: ${input.startsWith("http")}`);
    
    let code = input.trim();
    
    // Decode if needed
    if (input.includes("%")) {
      code = decodeURIComponent(input);
      console.log("   ✅ Decoded URL-encoded input");
    }
    
    // Extract code if URL
    if (code.includes("http") || code.includes("code=")) {
      try {
        const url = new URL(code);
        const extractedCode = url.searchParams.get("code");
        if (extractedCode) {
          code = extractedCode;
          console.log("   ✅ Extracted code from URL");
        }
      } catch {
        // Try regex
        const match = code.match(/code=([^&\s]+)/);
        if (match) {
          code = match[1];
          console.log("   ✅ Extracted code with regex");
        }
      }
    }
    
    console.log(`\n📝 Final code:`);
    console.log(`   Length: ${code.length}`);
    console.log(`   First 30: ${code.substring(0, 30)}...`);
    console.log(`   Last 10: ...${code.substring(code.length - 10)}`);
    
    console.log("\n🔄 Attempting token exchange...");
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Redirect URI: ${redirectUri}`);
    console.log(`   Code: ${code.substring(0, 20)}...`);
    
    // Create request manually to see exact parameters
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const params = new URLSearchParams({
      code: code,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });
    
    console.log("\n📤 Request details:");
    console.log(`   URL: ${tokenUrl}`);
    console.log(`   Method: POST`);
    console.log(`   Body params:`);
    params.forEach((value, key) => {
      if (key === "client_secret") {
        console.log(`     ${key}: ${value.substring(0, 10)}...`);
      } else if (key === "code") {
        console.log(`     ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`     ${key}: ${value}`);
      }
    });
    
    try {
      // Make the request
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString()
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log("\n✅ SUCCESS! Tokens received!");
        console.log(`   Access token: ${data.access_token?.substring(0, 30)}...`);
        console.log(`   Refresh token: ${data.refresh_token ? "Present" : "Missing"}`);
      } else {
        console.log("\n❌ Token exchange failed!");
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${data.error}`);
        console.log(`   Description: ${data.error_description}`);
        
        if (data.error === "invalid_grant") {
          console.log("\n💡 Invalid grant reasons:");
          console.log("   1. Code already used");
          console.log("   2. Code expired (>2 minutes old)");
          console.log("   3. Wrong redirect_uri");
          console.log("   4. Code for different client_id");
          console.log("   5. Malformed code");
        }
      }
      
    } catch (error) {
      console.error("\n❌ Request error:", error);
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

debug();