#!/usr/bin/env bun
/**
 * Gmail OAuth Setup with Manual Code Entry Workaround
 * Uses localhost redirect but allows manual code copying
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
  console.log("\n🔐 Gmail OAuth Setup (Manual Code Workaround)");
  console.log("============================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Use a specific port for localhost redirect
    const PORT = 8080;
    const redirectUri = `http://localhost:${PORT}`;
    
    // Create OAuth2 client with localhost redirect
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
      prompt: "consent", // Force consent to get refresh token
    });
    
    console.log("📋 Instructions for Manual Code Entry:");
    console.log("=====================================\n");
    console.log("1. Open this URL in your browser (use incognito mode for fresh auth):");
    console.log(`\n${authUrl}\n`);
    
    console.log("2. Complete the authorization process");
    console.log("\n3. You'll be redirected to a URL that looks like:");
    console.log(`   http://localhost:${PORT}/?code=4/0AUJR...&scope=...`);
    console.log("\n4. Your browser will show an error page (This site can't be reached)");
    console.log("   THIS IS NORMAL! The code is in the URL.");
    console.log("\n5. Look at the browser's address bar and copy:");
    console.log("   - Either the ENTIRE URL");
    console.log("   - Or just the code part (between 'code=' and '&scope')\n");
    
    const input = await question("📋 Paste the code or full URL here: ");
    rl.close();
    
    // Extract code from input
    let code = input.trim();
    
    // Check if it's a full URL
    if (input.includes("http") || input.includes("code=")) {
      try {
        const url = new URL(input.includes("http") ? input : `http://localhost/?${input}`);
        const extractedCode = url.searchParams.get("code");
        if (extractedCode) {
          code = extractedCode;
          console.log("\n✅ Code extracted from URL");
        }
      } catch {
        // If URL parsing fails, try regex
        const match = input.match(/code=([^&\s]+)/);
        if (match) {
          code = match[1];
          console.log("\n✅ Code extracted using pattern matching");
        }
      }
    }
    
    console.log(`\n🔍 Code received (length: ${code.length})`);
    console.log("🔄 Exchanging code for tokens...");
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error("No access token received");
      }
      
      console.log("\n✅ Success! Tokens received.");
      
      if (!tokens.refresh_token) {
        console.warn("\n⚠️  Warning: No refresh token received.");
        console.log("   To fix this:");
        console.log("   1. Go to https://myaccount.google.com/permissions");
        console.log("   2. Remove access for your app");
        console.log("   3. Run this setup again");
      }
      
      // Create Gmail client
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
      
      // Save tokens to file for backup
      const tokensPath = path.join("data", `gmail-tokens-${email}.json`);
      await fs.mkdir(path.dirname(tokensPath), { recursive: true });
      await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2));
      console.log(`\n💾 Tokens saved to: ${tokensPath}`);
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code!");
      console.error(`\nError: ${error.message}`);
      
      if (error.message?.includes("invalid_grant") || error.message?.includes("Invalid grant")) {
        console.log("\n💡 Common causes:");
        console.log("   1. Code already used - Each code works only ONCE");
        console.log("   2. Code expired - Use within 1-2 minutes");
        console.log("   3. Wrong redirect URI - Make sure you used the exact URL above");
        console.log("   4. Incorrect code copied - Copy the ENTIRE code or URL");
        console.log("\n🔄 Solution: Open the auth URL again in a NEW incognito window!");
      }
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();