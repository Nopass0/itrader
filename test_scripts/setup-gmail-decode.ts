#!/usr/bin/env bun
/**
 * Gmail OAuth Setup with proper URL decoding
 */

import { google } from "googleapis";
import { db } from "./src/db";
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
  console.log("\n🔐 Gmail OAuth Setup (with URL decoding)");
  console.log("========================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.web || credentialsContent.installed || credentialsContent;
    
    console.log("📋 Using credentials:");
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Type: ${credentialsContent.web ? "Web application" : "Desktop app"}\n`);
    
    // Use http://localhost as redirect URI
    const redirectUri = "http://localhost";
    
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
    
    console.log("📌 Step 1: Get authorization code");
    console.log("=================================\n");
    console.log("1. Open this URL in a NEW incognito window:");
    console.log(`\n${authUrl}\n`);
    console.log("2. Authorize the application");
    console.log("3. You'll be redirected to localhost (error page is normal)");
    console.log("4. Copy the ENTIRE URL from browser's address bar\n");
    
    const input = await question("📋 Paste the URL or code here: ");
    rl.close();
    
    if (!input || input.trim().length === 0) {
      console.error("\n❌ No input provided!");
      process.exit(1);
    }
    
    let code: string;
    
    // Check if it's a full URL or just the code
    if (input.includes("http") || input.includes("code=")) {
      try {
        // Decode the URL first
        const decodedInput = decodeURIComponent(input.trim());
        console.log("\n🔍 Processing URL...");
        
        // Try to parse as URL
        const url = new URL(decodedInput);
        const extractedCode = url.searchParams.get("code");
        
        if (extractedCode) {
          code = extractedCode;
          console.log(`✅ Code extracted from URL`);
        } else {
          // Try manual extraction
          const match = decodedInput.match(/code=([^&\s]+)/);
          if (match) {
            code = match[1];
            console.log(`✅ Code extracted using pattern`);
          } else {
            throw new Error("No code found in URL");
          }
        }
      } catch (urlError) {
        // If URL parsing fails, try to extract code directly
        const decodedInput = decodeURIComponent(input.trim());
        const match = decodedInput.match(/code=([^&\s]+)/);
        if (match) {
          code = match[1];
          console.log(`✅ Code extracted from string`);
        } else {
          console.error("\n❌ Could not extract code from input!");
          console.log("Make sure you copied the ENTIRE URL");
          process.exit(1);
        }
      }
    } else {
      // Assume it's just the code
      code = input.trim();
      console.log("✅ Using input as code directly");
    }
    
    // Decode the code if it contains encoded characters
    if (code.includes("%")) {
      code = decodeURIComponent(code);
      console.log("✅ Code was URL-encoded, decoded it");
    }
    
    console.log(`\n📊 Code info:`);
    console.log(`   Length: ${code.length} characters`);
    console.log(`   First 20 chars: ${code.substring(0, 20)}...`);
    console.log(`   Contains slashes: ${code.includes("/") ? "Yes" : "No"}`);
    
    console.log("\n🔄 Exchanging code for tokens...");
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log("\n✅ SUCCESS! Tokens received!");
      console.log(`   Access Token: ${tokens.access_token?.substring(0, 30)}...`);
      console.log(`   Refresh Token: ${tokens.refresh_token ? "Present ✓" : "Missing ✗"}`);
      
      if (!tokens.refresh_token) {
        console.error("\n❌ No refresh token received!");
        console.log("\nTo fix this:");
        console.log("1. Go to https://myaccount.google.com/permissions");
        console.log("2. Find and remove access for your app");
        console.log("3. Run this setup again");
        process.exit(1);
      }
      
      // Get user email
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "unknown";
      
      console.log(`\n✅ Gmail account verified: ${email}`);
      
      // Save to database
      await db.upsertGmailAccount({
        email,
        refreshToken: tokens.refresh_token,
      });
      
      // Save backup
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      await fs.writeFile(tokensPath, JSON.stringify({
        ...tokens,
        email,
        client_id: credentials.client_id,
        saved_at: new Date().toISOString()
      }, null, 2));
      
      console.log(`\n✅ Setup completed successfully!`);
      console.log(`📧 Gmail account: ${email}`);
      console.log(`💾 Tokens saved to: ${tokensPath}`);
      
      // Test API access
      console.log("\n🧪 Testing Gmail API...");
      try {
        const messages = await gmail.users.messages.list({
          userId: "me",
          maxResults: 1
        });
        console.log("✅ Gmail API access confirmed!");
      } catch (error) {
        console.warn("⚠️  API test failed, but tokens were saved");
      }
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code!");
      console.error(`Error: ${error.message}`);
      
      if (error.response?.data) {
        console.error("\nGoogle's response:");
        console.error(JSON.stringify(error.response.data, null, 2));
      }
      
      console.log("\n💡 Troubleshooting checklist:");
      console.log("☐ Used a FRESH code (from new incognito window)");
      console.log("☐ Completed within 2 minutes");
      console.log("☐ Copied the ENTIRE URL");
      console.log("☐ URL starts with http://localhost/?code=");
      console.log("☐ System time is correct");
      
      if (error.message?.includes("invalid_grant")) {
        console.log("\n🔄 Get a NEW code:");
        console.log("1. Close all browser windows");
        console.log("2. Open NEW incognito window");
        console.log("3. Use the auth URL above");
        console.log("4. Copy URL immediately after redirect");
      }
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();