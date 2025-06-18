#!/usr/bin/env bun
/**
 * Gmail OAuth Setup - Copy Full URL Method
 */

import { google } from "googleapis";
import { GmailClient } from "./src/gmail";
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
  console.log("\n🔐 Gmail OAuth Setup (Copy Full URL Method)");
  console.log("==========================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Use localhost without port
    const redirectUri = "http://localhost";
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      redirectUri
    );
    
    // Generate auth URL with prompt=consent to force refresh token
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      prompt: "consent",
    });
    
    console.log("📋 IMPORTANT INSTRUCTIONS:");
    console.log("=========================\n");
    console.log("1. Open a NEW incognito/private browser window");
    console.log("2. Go to this URL:");
    console.log(`\n${authUrl}\n`);
    console.log("3. Complete the authorization");
    console.log("4. You'll be redirected to a URL that looks like:");
    console.log("   http://localhost/?code=4/0AUJR-x7...&scope=https://www.googleapis.com/auth/gmail.modify...");
    console.log("\n5. The page will show 'This site can't be reached' - THIS IS NORMAL!");
    console.log("6. Copy the ENTIRE URL from the browser's address bar");
    console.log("   (Select all with Ctrl+A/Cmd+A, then copy with Ctrl+C/Cmd+C)\n");
    
    const fullUrl = await question("📋 Paste the FULL URL here: ");
    rl.close();
    
    // Parse URL to extract code
    let code: string;
    try {
      const url = new URL(fullUrl.trim());
      const extractedCode = url.searchParams.get("code");
      
      if (!extractedCode) {
        throw new Error("No code found in URL");
      }
      
      code = extractedCode;
      console.log(`\n✅ Code extracted successfully (${code.length} characters)`);
      
      // Verify redirect URI matches
      const urlBase = `${url.protocol}//${url.host}`;
      if (urlBase !== redirectUri) {
        console.warn(`\n⚠️  Warning: Redirect URI mismatch`);
        console.warn(`   Expected: ${redirectUri}`);
        console.warn(`   Received: ${urlBase}`);
      }
      
    } catch (error) {
      console.error("\n❌ Failed to parse URL!");
      console.log("Make sure you copied the ENTIRE URL including 'http://' at the beginning");
      process.exit(1);
    }
    
    console.log("\n🔄 Exchanging code for tokens...");
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error("No access token received");
      }
      
      console.log("\n✅ Success! Tokens received.");
      
      if (!tokens.refresh_token) {
        console.warn("\n⚠️  No refresh token received.");
        console.log("   This happens if you've authorized before.");
        console.log("   To get a refresh token:");
        console.log("   1. Go to https://myaccount.google.com/permissions");
        console.log("   2. Find and remove your app");
        console.log("   3. Run this setup again");
      }
      
      // Set up Gmail service
      oauth2Client.setCredentials(tokens);
      const gmailService = google.gmail({ version: "v1", auth: oauth2Client });
      
      // Get user profile
      const profile = await gmailService.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "unknown";
      
      // Save to database
      await db.upsertGmailAccount({
        email,
        refreshToken: tokens.refresh_token || "",
      });
      
      console.log(`\n✅ Gmail account ${email} setup successfully!`);
      
      // Save tokens for backup
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2));
      console.log(`💾 Tokens backed up to: ${tokensPath}`);
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code!");
      console.error(`Error: ${error.message}`);
      
      if (error.response?.data) {
        console.error("Details:", JSON.stringify(error.response.data, null, 2));
      }
      
      console.log("\n💡 Troubleshooting:");
      console.log("1. Make sure you used a FRESH code (open the auth URL in a NEW incognito window)");
      console.log("2. Complete the process quickly (codes expire in 1-2 minutes)");
      console.log("3. Copy the ENTIRE URL from the browser, not just the code");
      console.log("4. Check that your Google Cloud Console has 'http://localhost' as authorized redirect URI");
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();