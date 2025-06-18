#!/usr/bin/env bun
/**
 * Gmail OAuth Setup with localhost redirect
 */

import { OAuth2Manager } from "./src/gmail/utils/oauth2";
import { GmailClient } from "./src/gmail";
import { db } from "./src/db";
import { startLocalServer } from "./src/gmail/utils/localServer";
import fs from "fs/promises";
import path from "path";
import open from "open";

async function setup() {
  console.log("\n🔐 Gmail OAuth Setup (Localhost Method)");
  console.log("======================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Create OAuth2Manager
    const oauth2Manager = new OAuth2Manager(credentials);
    const authUrl = oauth2Manager.getAuthUrl();
    
    console.log("📌 Starting local server to receive authorization code...");
    
    // Try port 3000 first (doesn't require admin)
    let code: string;
    try {
      console.log("🌐 Trying port 3000...");
      const serverPromise = startLocalServer(3000);
      
      console.log("\n✅ Server started! Opening browser...");
      console.log("\nIf browser doesn't open, manually go to:");
      console.log(authUrl);
      
      // Open browser
      await open(authUrl);
      
      // Wait for code
      code = await serverPromise;
      console.log("\n✅ Authorization code received!");
      
    } catch (error) {
      console.error("❌ Failed to start server:", error);
      console.log("\n📋 Please manually:");
      console.log("1. Open this URL in your browser:");
      console.log(authUrl);
      console.log("2. After authorization, copy the code from the URL");
      
      const manualCode = prompt("\nPaste the code here: ");
      if (!manualCode) {
        console.error("❌ No code provided!");
        process.exit(1);
      }
      code = manualCode.trim();
    }
    
    console.log("\n🔄 Exchanging code for tokens...");
    
    try {
      const tokens = await oauth2Manager.getTokenFromCode(code);
      
      console.log("\n✅ Success! Tokens received.");
      
      // Create client and get profile
      const client = new GmailClient(oauth2Manager);
      await client.setTokens(tokens);
      const profile = await client.getUserProfile();
      
      // Save to database
      await db.upsertGmailAccount({
        email: profile.emailAddress || "unknown",
        refreshToken: tokens.refresh_token || "",
      });
      
      console.log(`\n✅ Gmail account ${profile.emailAddress} setup successfully!`);
      
    } catch (error: any) {
      console.error("\n❌ Failed to exchange code!");
      console.error(`\nError: ${error.message}`);
    }
    
  } catch (error) {
    console.error("\n❌ Setup error:", error);
  }
  
  await db.disconnect();
}

setup();