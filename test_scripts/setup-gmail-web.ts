#!/usr/bin/env bun
/**
 * Gmail OAuth Setup for Web Application credentials
 */

import { google } from "googleapis";
import { GmailClient } from "./src/gmail";
import { OAuth2Manager } from "./src/gmail/utils/oauth2";
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
  console.log("\n🔐 Gmail OAuth Setup (Web Application)");
  console.log("=====================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    
    // For web applications
    const credentials = credentialsContent.web || credentialsContent.installed || credentialsContent;
    
    console.log("📋 Configuration:");
    console.log(`   Type: ${credentialsContent.web ? "Web application" : "Desktop app"}`);
    console.log(`   Client ID: ${credentials.client_id}`);
    console.log(`   Redirect URIs: ${credentials.redirect_uris?.join(", ")}\n`);
    
    // Use the first redirect URI
    const redirectUri = credentials.redirect_uris?.[0] || "http://localhost";
    
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
    
    console.log("📌 Instructions:");
    console.log("===============\n");
    console.log("1. Open this URL in a NEW incognito/private browser window:");
    console.log(`\n${authUrl}\n`);
    console.log("2. Authorize the application");
    console.log("3. You'll be redirected to localhost (page won't load - this is normal!)");
    console.log("4. Copy the ENTIRE URL from the browser's address bar\n");
    console.log("Example: http://localhost/?code=4/0AUJR-x6D...&scope=...\n");
    
    const fullUrl = await question("📋 Paste the FULL URL here: ");
    rl.close();
    
    // Extract code
    let code: string;
    try {
      const url = new URL(fullUrl.trim());
      code = url.searchParams.get("code") || "";
      
      if (!code) {
        throw new Error("No code found in URL");
      }
      
      console.log(`\n✅ Code extracted (${code.length} characters)`);
      
      // Verify the redirect URI matches
      const receivedRedirectBase = `${url.protocol}//${url.host}`;
      console.log(`🔍 Redirect URI check:`);
      console.log(`   Expected: ${redirectUri}`);
      console.log(`   Received: ${receivedRedirectBase}`);
      
    } catch (error) {
      console.error("\n❌ Failed to parse URL!");
      console.log("Make sure you copied the ENTIRE URL including http://");
      process.exit(1);
    }
    
    console.log("\n🔄 Exchanging code for tokens...");
    console.log(`   Time: ${new Date().toISOString()}`);
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log("\n✅ SUCCESS! Tokens received:");
      console.log(`   Access Token: ${tokens.access_token?.substring(0, 30)}...`);
      console.log(`   Refresh Token: ${tokens.refresh_token ? "Present" : "Missing"}`);
      console.log(`   Expires: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : "Unknown"}`);
      
      if (!tokens.refresh_token) {
        console.warn("\n⚠️  No refresh token received!");
        console.log("To fix this:");
        console.log("1. Go to https://myaccount.google.com/permissions");
        console.log("2. Remove access for your app");
        console.log("3. Run this setup again");
        process.exit(1);
      }
      
      // Set credentials and get user info
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "unknown";
      
      console.log(`\n✅ Connected to Gmail account: ${email}`);
      
      // Save to database
      await db.upsertGmailAccount({
        email,
        refreshToken: tokens.refresh_token,
      });
      
      // Save tokens backup
      const tokensDir = path.join("data", "gmail-tokens");
      await fs.mkdir(tokensDir, { recursive: true });
      const tokensPath = path.join(tokensDir, `${email}.json`);
      
      await fs.writeFile(tokensPath, JSON.stringify({
        ...tokens,
        client_id: credentials.client_id,
        redirect_uri_used: redirectUri,
        saved_at: new Date().toISOString()
      }, null, 2));
      
      console.log(`\n✅ Gmail account ${email} setup successfully!`);
      console.log(`💾 Tokens backed up to: ${tokensPath}`);
      
      // Test the connection
      console.log("\n🧪 Testing Gmail access...");
      try {
        const testResult = await gmail.users.messages.list({
          userId: "me",
          maxResults: 1
        });
        console.log("✅ Gmail API access confirmed!");
      } catch (error) {
        console.warn("⚠️  Could not test Gmail API, but setup completed.");
      }
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code!");
      console.error(`Error: ${error.message}`);
      
      if (error.response?.data) {
        console.error("\nError details from Google:");
        console.error(JSON.stringify(error.response.data, null, 2));
      }
      
      console.log("\n💡 Common solutions:");
      console.log("1. Use a FRESH code (get new one in incognito mode)");
      console.log("2. Complete the process quickly (within 1-2 minutes)");
      console.log("3. Make sure system time is correct");
      console.log("4. Check that redirect URI in Google Console matches exactly");
      
      // Show current time
      console.log(`\n🕐 Current system time: ${new Date().toISOString()}`);
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();