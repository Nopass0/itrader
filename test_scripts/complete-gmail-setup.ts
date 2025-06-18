#!/usr/bin/env bun
/**
 * Complete Gmail Setup - финальный рабочий скрипт
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
  console.log("\n🔐 Gmail OAuth Setup - Final Version");
  console.log("====================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.web || credentialsContent.installed || credentialsContent;
    
    // IMPORTANT: Use exact redirect URI
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
    
    console.log("📋 Instructions:");
    console.log("================\n");
    console.log("1. Open this URL in a NEW incognito window:");
    console.log(`\n${authUrl}\n`);
    console.log("2. Authorize the application");
    console.log("3. Copy the FULL URL after redirect (ignore the error page)");
    console.log("   Example: http://localhost/?code=4/0AUJR-x74...&scope=...\n");
    
    const input = await question("📋 Paste the FULL URL here: ");
    rl.close();
    
    // Process input
    let code = input.trim();
    
    // Decode if needed
    if (code.includes("%")) {
      code = decodeURIComponent(code);
    }
    
    // Extract code from URL
    if (code.includes("http") || code.includes("code=")) {
      try {
        const url = new URL(code);
        const extractedCode = url.searchParams.get("code");
        if (extractedCode) {
          code = extractedCode;
          console.log("\n✅ Code extracted from URL");
        }
      } catch {
        const match = code.match(/code=([^&\s]+)/);
        if (match) {
          code = match[1];
          console.log("\n✅ Code extracted with pattern matching");
        }
      }
    }
    
    console.log("\n🔄 Exchanging code for tokens...");
    
    try {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error("Missing required tokens");
      }
      
      console.log("\n✅ Tokens received successfully!");
      
      // Set credentials and get user info
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "unknown";
      
      console.log(`✅ Connected to Gmail account: ${email}`);
      
      // Save to database
      await db.upsertGmailAccount({
        email,
        refreshToken: tokens.refresh_token,
      });
      
      console.log("✅ Saved to database");
      
      // Save backup of all tokens
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      await fs.writeFile(tokensPath, JSON.stringify({
        ...tokens,
        email,
        client_id: credentials.client_id,
        saved_at: new Date().toISOString()
      }, null, 2));
      
      console.log(`✅ Backup saved to: ${tokensPath}`);
      
      // Test the setup
      console.log("\n🧪 Testing Gmail API access...");
      try {
        const messages = await gmail.users.messages.list({
          userId: "me",
          maxResults: 1,
          q: "from:noreply@tinkoff.ru"
        });
        
        if (messages.data.messages && messages.data.messages.length > 0) {
          console.log("✅ Gmail API working - found Tinkoff emails");
        } else {
          console.log("✅ Gmail API working - no Tinkoff emails yet");
        }
      } catch (error) {
        console.log("⚠️  API test failed, but setup completed");
      }
      
      console.log("\n🎉 Gmail setup completed successfully!");
      console.log("\nYou can now:");
      console.log("- Use the CLI to manage your Gmail account");
      console.log("- Run the main application with Gmail features");
      console.log("\nTo test: ./start.sh and select option 2 (Run automation)");
      
    } catch (error: any) {
      console.error("\n❌ Failed to complete setup!");
      console.error(`Error: ${error.message}`);
      
      if (error.message?.includes("invalid_grant")) {
        console.log("\n💡 Solution: Get a FRESH code");
        console.log("1. Open the auth URL in a NEW incognito window");
        console.log("2. Complete authorization quickly");
        console.log("3. Copy and paste the URL immediately");
      }
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();