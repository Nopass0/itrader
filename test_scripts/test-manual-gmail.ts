#!/usr/bin/env bun
/**
 * Test manual Gmail OAuth setup
 */

import { OAuth2Manager } from "./src/gmail/utils/oauth2";
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

async function test() {
  console.log("\n🔐 Testing Manual Gmail OAuth Setup");
  console.log("===================================\n");

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, "utf-8"));
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Force OOB redirect URI
    credentials.redirect_uris = ["urn:ietf:wg:oauth:2.0:oob"];
    
    // Create OAuth2Manager
    const oauth2Manager = new OAuth2Manager(credentials);
    const authUrl = oauth2Manager.getAuthUrl();
    
    console.log("📌 Open this URL in your browser:");
    console.log(`\n${authUrl}\n`);
    console.log("📝 After authorization, copy the code shown on the page\n");
    
    const code = await question("📋 Paste the authorization code here: ");
    
    console.log("\n🔄 Exchanging code for tokens...");
    const tokens = await oauth2Manager.getTokenFromCode(code);
    
    console.log("\n✅ Success! Tokens received:");
    console.log(`   Access Token: ${tokens.access_token?.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${tokens.refresh_token ? "Present" : "Missing"}`);
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    rl.close();
  }
}

test();