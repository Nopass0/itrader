/**
 * CLI for Itrader account management
 */

import inquirer from "inquirer";
import { db } from "./db";
import { GateClient } from "./gate/client";
import { RateLimiter } from "./gate/utils/rateLimiter";
import { P2PClient } from "./bybit";
import { GmailClient } from "./gmail";
import { getExchangeRateManager } from "./services/exchangeRateManager";
import fs from "fs/promises";
import path from "path";

interface CLIContext {
  running: boolean;
}

export async function runCLI() {
  console.log("Welcome to Itrader CLI");
  console.log("=".repeat(50));

  const context: CLIContext = { running: true };

  while (context.running) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Manage Gate accounts", value: "gate" },
          { name: "Manage Bybit accounts", value: "bybit" },
          { name: "Manage Gmail account", value: "gmail" },
          { name: "Exchange rate settings", value: "exchangeRate" },
          { name: "Switch mode (Manual/Automatic)", value: "mode" },
          { name: "Database management", value: "database" },
          { name: "Start application", value: "start" },
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    switch (action) {
      case "gate":
        await manageGateAccounts();
        break;
      case "bybit":
        await manageBybitAccounts();
        break;
      case "gmail":
        await manageGmailAccount();
        break;
      case "exchangeRate":
        await manageExchangeRate();
        break;
      case "mode":
        await switchMode();
        break;
      case "database":
        await manageDatabase();
        break;
      case "start":
        await startApplication();
        context.running = false;
        break;
      case "exit":
        context.running = false;
        break;
    }
  }

  console.log("Goodbye!");
  process.exit(0);
}

async function manageGateAccounts() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Gate account management:",
      choices: [
        "List accounts",
        "Add account",
        "Remove account",
        "Test account",
        "Back",
      ],
    },
  ]);

  switch (action) {
    case "List accounts":
      await listGateAccounts();
      break;
    case "Add account":
      await addGateAccount();
      break;
    case "Remove account":
      await removeGateAccount();
      break;
    case "Test account":
      await testGateAccount();
      break;
  }
}

async function listGateAccounts() {
  const accounts = await db.getActiveGateAccounts();
  
  if (accounts.length === 0) {
    console.log("No Gate accounts configured");
  } else {
    console.log("\nGate accounts:");
    accounts.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.accountId} - ${acc.email}`);
    });
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function addGateAccount() {
  const { email, password, accountId } = await inquirer.prompt([
    {
      type: "input",
      name: "accountId",
      message: "Account ID (unique identifier):",
      validate: (input) => input.length > 0,
    },
    {
      type: "input",
      name: "email",
      message: "Email:",
      validate: (input) => /\S+@\S+\.\S+/.test(input),
    },
    {
      type: "password",
      name: "password",
      message: "Password:",
      validate: (input) => input.length > 0,
    },
  ]);

  console.log("Attempting to login...");

  try {
    const rateLimiter = new RateLimiter();
    const client = new GateClient(rateLimiter);
    
    await client.login(email, password);
    
    // Save cookies
    const cookiePath = path.join("data", "cookies", `${accountId}.json`);
    await fs.mkdir(path.dirname(cookiePath), { recursive: true });
    await client.saveCookies(cookiePath);
    
    // Save to database
    await db.upsertGateAccount({
      accountId,
      email,
      apiKey: "", // Gate doesn't use API keys for panel access
      apiSecret: "",
    });
    
    console.log("✓ Gate account added successfully!");
  } catch (error) {
    console.error("✗ Failed to add Gate account:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function removeGateAccount() {
  const accounts = await db.getActiveGateAccounts();
  
  if (accounts.length === 0) {
    console.log("No Gate accounts to remove");
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to remove:",
      choices: accounts.map((acc) => ({
        name: `${acc.accountId} - ${acc.email}`,
        value: acc.accountId,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to remove account ${accountId}?`,
      default: false,
    },
  ]);

  if (confirm) {
    await db.client.gateAccount.update({
      where: { accountId },
      data: { isActive: false },
    });
    console.log("✓ Account removed");
  }
}

async function testGateAccount() {
  const accounts = await db.getActiveGateAccounts();
  
  if (accounts.length === 0) {
    console.log("No Gate accounts to test");
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to test:",
      choices: accounts.map((acc) => ({
        name: `${acc.accountId} - ${acc.email}`,
        value: acc.accountId,
      })),
    },
  ]);

  try {
    const rateLimiter = new RateLimiter();
    const client = new GateClient(rateLimiter);
    
    const cookiePath = path.join("data", "cookies", `${accountId}.json`);
    await client.loadCookies(cookiePath);
    
    const balance = await client.getBalance("RUB");
    console.log(`✓ Account is working! Balance: ${balance.balance} RUB`);
  } catch (error) {
    console.error("✗ Account test failed:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function manageBybitAccounts() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Bybit account management:",
      choices: [
        "List accounts",
        "Add account",
        "Remove account",
        "Test account",
        "Back",
      ],
    },
  ]);

  switch (action) {
    case "List accounts":
      await listBybitAccounts();
      break;
    case "Add account":
      await addBybitAccount();
      break;
    case "Remove account":
      await removeBybitAccount();
      break;
    case "Test account":
      await testBybitAccount();
      break;
  }
}

async function listBybitAccounts() {
  const accounts = await db.getActiveBybitAccounts();
  
  if (accounts.length === 0) {
    console.log("No Bybit accounts configured");
  } else {
    console.log("\nBybit accounts:");
    accounts.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.accountId}`);
    });
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function addBybitAccount() {
  const { accountId, apiKey, apiSecret } = await inquirer.prompt([
    {
      type: "input",
      name: "accountId",
      message: "Account ID (unique identifier):",
      validate: (input) => input.length > 0,
    },
    {
      type: "input",
      name: "apiKey",
      message: "API Key:",
      validate: (input) => input.length > 0,
    },
    {
      type: "password",
      name: "apiSecret",
      message: "API Secret:",
      validate: (input) => input.length > 0,
    },
  ]);

  console.log("Saving Bybit account...");

  try {
    // Save to database without testing connection
    // P2P API requires special permissions that may not be available
    await db.upsertBybitAccount({
      accountId,
      apiKey,
      apiSecret,
    });
    
    console.log("✓ Bybit account added successfully!");
    console.log("\n⚠️  Note: P2P features require:");
    console.log("- Verified P2P trader status on Bybit");
    console.log("- KYC verification completed");
    console.log("- P2P API permissions enabled for your API key");
    console.log("- Access from supported regions");
    console.log("\nIf you haven't enabled P2P trading on Bybit, the automation may not work.");
  } catch (error) {
    console.error("✗ Failed to add Bybit account:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function removeBybitAccount() {
  const accounts = await db.getActiveBybitAccounts();
  
  if (accounts.length === 0) {
    console.log("No Bybit accounts to remove");
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to remove:",
      choices: accounts.map((acc) => ({
        name: acc.accountId,
        value: acc.accountId,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to remove account ${accountId}?`,
      default: false,
    },
  ]);

  if (confirm) {
    await db.client.bybitAccount.update({
      where: { accountId },
      data: { isActive: false },
    });
    console.log("✓ Account removed");
  }
}

async function testBybitAccount() {
  const accounts = await db.getActiveBybitAccounts();
  
  if (accounts.length === 0) {
    console.log("No Bybit accounts to test");
    return;
  }

  const { accountId } = await inquirer.prompt([
    {
      type: "list",
      name: "accountId",
      message: "Select account to test:",
      choices: accounts.map((acc) => ({
        name: acc.accountId,
        value: acc.accountId,
      })),
    },
  ]);

  const account = accounts.find((acc) => acc.accountId === accountId);
  if (!account) return;

  try {
    const client = new P2PClient({
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      testnet: false,
    });
    
    await client.connect();
    const info = await client.getAccountInfo();
    console.log("✓ Account is working!");
    console.log("Account info:", JSON.stringify(info, null, 2));
  } catch (error) {
    console.error("✗ Account test failed:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function manageGmailAccount() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Gmail account management:",
      choices: [
        "Show current account",
        "Setup account",
        "Remove account",
        "Test account",
        "Back",
      ],
    },
  ]);

  switch (action) {
    case "Show current account":
      await showGmailAccount();
      break;
    case "Setup account":
      await setupGmailAccount();
      break;
    case "Remove account":
      await removeGmailAccount();
      break;
    case "Test account":
      await testGmailAccount();
      break;
  }
}

async function showGmailAccount() {
  const account = await db.getActiveGmailAccount();
  
  if (!account) {
    console.log("No Gmail account configured");
  } else {
    console.log(`\nGmail account: ${account.email}`);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function setupGmailAccount() {
  console.log("\nGmail OAuth Setup");
  console.log("This will use manual code entry for authorization.");
  console.log("1. You will be redirected to Google to authorize the application");
  console.log("2. After authorization, you'll see a URL with a code");
  console.log("3. Copy the code or entire URL and paste it here\n");

  const { proceed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Proceed with Gmail setup?",
      default: true,
    },
  ]);

  if (!proceed) return;

  try {
    // First check if we have credentials file
    const credentialsPath = path.join("data", "gmail-credentials.json");
    try {
      await fs.access(credentialsPath);
    } catch {
      console.error("\nError: Gmail credentials file not found!");
      console.log(`Please place your Google OAuth2 credentials at: ${credentialsPath}`);
      console.log("\nTo get credentials:");
      console.log("1. Go to https://console.cloud.google.com/");
      console.log("2. Create a new project or select existing");
      console.log("3. Enable Gmail API");
      console.log("4. Create credentials (OAuth 2.0 Client ID)");
      console.log("5. Select 'Desktop app' as application type");
      console.log("6. Download the credentials JSON file");
      console.log(`7. Save it as: ${credentialsPath}\n`);
      
      await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      return;
    }

    // Load credentials
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8'));
    
    // Extract OAuth2 credentials (could be under 'installed' or 'web' key)
    const credentials = credentialsContent.web || credentialsContent.installed || credentialsContent;
    
    if (!credentials.client_id || !credentials.client_secret) {
      console.error("\nError: Invalid credentials file!");
      console.log("The credentials file must contain client_id and client_secret.");
      console.log("\nMake sure you:");
      console.log("1. Created OAuth 2.0 Client ID (not API key)");
      console.log("2. Selected 'Desktop app' as application type");
      console.log("3. Downloaded the correct JSON file");
      
      await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      return;
    }
    
    // Import necessary utilities
    const { extractCodeFromUrl } = await import("./gmail/utils/oauth2Fix");
    const { google } = await import("googleapis");
    
    // Create OAuth2 client for generating auth URL
    const tempOAuth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      "http://localhost"
    );
    
    const authUrl = tempOAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      prompt: "consent",
    });
    
    console.log("\n🌐 Authorization Required");
    console.log("========================");
    console.log("\nOpen this URL in your browser (preferably in incognito mode):");
    console.log(`\n${authUrl}\n`);
    
    console.log("After authorization, you'll be redirected to a URL like:");
    console.log("http://localhost/?code=4/0AX4XfWh...&scope=...\n");
    
    console.log("Copy either:");
    console.log("- The ENTIRE redirect URL, or");
    console.log("- Just the code part (between 'code=' and '&scope')\n");
    
    // Try to open browser automatically
    try {
      const open = await import("open");
      await open.default(authUrl);
      console.log("Browser opened automatically. Complete the authorization there.\n");
    } catch {
      // Ignore if can't open
    }
    
    const { input } = await inquirer.prompt([
      {
        type: "input",
        name: "input",
        message: "Paste the authorization code or full redirect URL:",
        validate: (input) => input.trim().length > 0,
      },
    ]);
    
    // Extract code from input (could be full URL or just the code)
    let code = input.trim();
    
    // Decode URL-encoded input first
    try {
      const decodedInput = decodeURIComponent(input.trim());
      if (decodedInput !== input.trim()) {
        console.log("\n🔧 URL-encoded input detected, decoding...");
        code = decodedInput;
      }
    } catch (e) {
      // If decoding fails, use original input
    }
    
    // Check if input looks like a URL
    if (code.includes("http") || code.includes("code=")) {
      const extracted = extractCodeFromUrl(code);
      if (extracted) {
        code = extracted;
        console.log("\n✅ Code extracted from URL");
      }
    }
    
    // Additional decoding if the code itself is encoded
    if (code.includes("%")) {
      try {
        code = decodeURIComponent(code);
        console.log("✅ Code was URL-encoded, decoded it");
      } catch (e) {
        // If decoding fails, use as is
      }
    }
    
    console.log("\nExchanging code for tokens...");
    
    let tokenData: any = null;
    
    try {
      // Direct token exchange using Google API
      const { google } = await import("googleapis");
      
      // Create OAuth2 client with exact redirect URI
      const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        "http://localhost"  // Use exact redirect URI
      );
      
      // Exchange code for tokens manually to avoid PKCE issues
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code: code,
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          redirect_uri: "http://localhost",
          grant_type: "authorization_code"
        }).toString()
      });
      
      tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error || "Token exchange failed");
      }
      
      const tokens = tokenData;
      
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
      
      console.log(`\n✓ Gmail account ${email} setup successfully!`);
      
    } catch (error: any) {
      console.error("\n✗ Failed to exchange code for tokens!");
      
      // Show detailed error information
      if (tokenData && tokenData.error) {
        console.error("\nGoogle API Error:");
        console.error(`  Error: ${tokenData.error}`);
        console.error(`  Description: ${tokenData.error_description || "No description"}`);
      } else if (error.response?.data) {
        console.error("\nGoogle API Error:");
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Error: ${error.response.data.error}`);
        console.error(`  Description: ${error.response.data.error_description}`);
      } else if (error.message) {
        console.error(`\nError: ${error.message}`);
      }
      
      if (error.message?.includes("invalid_grant") || error.response?.data?.error === "invalid_grant") {
        console.log("\n💡 Common causes and solutions:");
        console.log("1. Code already used - Get a FRESH code");
        console.log("2. Code expired - Complete the process quickly (within 1-2 minutes)");
        console.log("3. Wrong code copied - Copy ONLY the code part or the entire URL");
        console.log("4. Previous authorization - Revoke access at https://myaccount.google.com/permissions");
        console.log("\nTry the setup again with a fresh authorization!");
      }
      
      // Debug information
      console.log("\n🔍 Debug info:");
      console.log(`  Code length: ${code.length}`);
      console.log(`  Code preview: ${code.substring(0, 30)}...`);
      console.log(`  Client ID: ${credentials.client_id.substring(0, 20)}...`);
      console.log(`  Redirect URI: http://localhost`);
    }
    
  } catch (error) {
    console.error("✗ Failed to setup Gmail account:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function removeGmailAccount() {
  const account = await db.getActiveGmailAccount();
  
  if (!account) {
    console.log("No Gmail account to remove");
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to remove Gmail account ${account.email}?`,
      default: false,
    },
  ]);

  if (confirm) {
    await db.client.gmailAccount.update({
      where: { id: account.id },
      data: { isActive: false },
    });
    console.log("✓ Gmail account removed");
  }
}

async function testGmailAccount() {
  const account = await db.getActiveGmailAccount();
  
  if (!account) {
    console.log("No Gmail account to test");
    return;
  }

  try {
    // Load credentials
    const credentialsPath = path.join("data", "gmail-credentials.json");
    const credentialsContent = JSON.parse(await fs.readFile(credentialsPath, 'utf-8'));
    
    // Extract OAuth2 credentials (could be under 'installed' or 'web' key)
    const credentials = credentialsContent.installed || credentialsContent.web || credentialsContent;
    
    // Create OAuth2Manager and client
    const { OAuth2Manager } = await import("./gmail/utils/oauth2");
    const oauth2Manager = new OAuth2Manager(credentials);
    const client = new GmailClient(oauth2Manager);
    
    // Set tokens
    await client.setTokens({ refresh_token: account.refreshToken });
    
    const emails = await client.getEmailsFromSender("noreply@tinkoff.ru", 1);
    console.log(`✓ Gmail account is working! Found ${emails.length} emails from Tinkoff`);
  } catch (error) {
    console.error("✗ Gmail test failed:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function switchMode() {
  const currentMode = await db.getSetting("mode");
  
  console.log(`\nCurrent mode: ${currentMode === "manual" ? "Manual" : "Automatic"}`);
  
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Select mode:",
      choices: [
        { name: "Manual - Confirm each action", value: "manual" },
        { name: "Automatic - Run without confirmations", value: "automatic" },
      ],
    },
  ]);

  await db.setSetting("mode", mode);
  console.log(`✓ Mode switched to ${mode}`);
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function manageExchangeRate() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Exchange rate management:",
      choices: [
        "View current rate",
        "Set exchange rate",
        "Switch rate mode",
        "Back",
      ],
    },
  ]);

  const rateManager = getExchangeRateManager();

  switch (action) {
    case "View current rate":
      {
        const config = rateManager.getConfig();
        const currentRate = rateManager.getRate();
        
        console.log("\nExchange Rate Settings:");
        console.log("======================");
        console.log(`Mode: ${config.mode}`);
        console.log(`Current rate: ${currentRate.toFixed(2)} RUB/USDT`);
        console.log(`Last updated: ${config.lastUpdate.toLocaleString()}`);
        
        if (config.mode === 'automatic') {
          console.log("\n⚠️  Note: Automatic mode is not yet implemented");
          console.log("The system will use the constant rate even in automatic mode");
        }
        
        await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      }
      break;
      
    case "Set exchange rate":
      {
        const currentRate = rateManager.getRate();
        console.log(`\nCurrent exchange rate: ${currentRate.toFixed(2)} RUB/USDT`);
        
        const { rate } = await inquirer.prompt([
          {
            type: "number",
            name: "rate",
            message: "Enter new exchange rate (RUB/USDT):",
            default: currentRate,
            validate: (input) => {
              if (isNaN(input) || input <= 0) {
                return "Rate must be a positive number";
              }
              return true;
            },
          },
        ]);
        
        rateManager.setRate(rate);
        console.log(`✓ Exchange rate updated to ${rate.toFixed(2)} RUB/USDT`);
        
        await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      }
      break;
      
    case "Switch rate mode":
      {
        const config = rateManager.getConfig();
        console.log(`\nCurrent mode: ${config.mode}`);
        
        const { mode } = await inquirer.prompt([
          {
            type: "list",
            name: "mode",
            message: "Select exchange rate mode:",
            choices: [
              { name: "Constant - Use fixed rate", value: "constant" },
              { name: "Automatic - Auto-update rate (not implemented)", value: "automatic" },
            ],
          },
        ]);
        
        rateManager.setMode(mode);
        console.log(`✓ Exchange rate mode switched to ${mode}`);
        
        if (mode === 'automatic') {
          console.log("\n⚠️  Note: Automatic mode is not yet implemented");
          console.log("The system will continue using the constant rate");
        }
        
        await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
      }
      break;
  }
}

async function manageDatabase() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Database management:",
      choices: [
        "View statistics",
        "Clear transaction history",
        "Clear blacklist",
        "Reset all data",
        "Backup database",
        "Back",
      ],
    },
  ]);

  switch (action) {
    case "View statistics":
      await viewDatabaseStats();
      break;
    case "Clear transaction history":
      await clearTransactionHistory();
      break;
    case "Clear blacklist":
      await clearBlacklist();
      break;
    case "Reset all data":
      await resetDatabase();
      break;
    case "Backup database":
      await backupDatabase();
      break;
  }
}

async function viewDatabaseStats() {
  const stats = {
    payouts: await db.client.payout.count(),
    transactions: await db.client.transaction.count(),
    advertisements: await db.client.bybitAdvertisement.count(),
    blacklisted: await db.client.blacklistedTransaction.count(),
    gateAccounts: await db.client.gateAccount.count({ where: { isActive: true } }),
    bybitAccounts: await db.client.bybitAccount.count({ where: { isActive: true } }),
  };

  console.log("\nDatabase Statistics:");
  console.log("===================");
  console.log(`Payouts: ${stats.payouts}`);
  console.log(`Transactions: ${stats.transactions}`);
  console.log(`Advertisements: ${stats.advertisements}`);
  console.log(`Blacklisted: ${stats.blacklisted}`);
  console.log(`Active Gate accounts: ${stats.gateAccounts}`);
  console.log(`Active Bybit accounts: ${stats.bybitAccounts}`);
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function clearTransactionHistory() {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "This will delete all transactions, advertisements, and chat messages. Continue?",
      default: false,
    },
  ]);

  if (confirm) {
    console.log("Clearing transaction history...");
    
    // Delete in correct order due to foreign keys
    await db.client.chatMessage.deleteMany({});
    await db.client.transaction.deleteMany({});
    await db.client.bybitAdvertisement.deleteMany({});
    await db.client.payout.deleteMany({});
    
    console.log("✓ Transaction history cleared");
  }
}

async function clearBlacklist() {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "This will remove all blacklisted transactions. Continue?",
      default: false,
    },
  ]);

  if (confirm) {
    await db.client.blacklistedTransaction.deleteMany({});
    console.log("✓ Blacklist cleared");
  }
}

async function resetDatabase() {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "⚠️  WARNING: This will delete ALL data including accounts! Continue?",
      default: false,
    },
  ]);

  if (confirm) {
    const { doubleConfirm } = await inquirer.prompt([
      {
        type: "input",
        name: "doubleConfirm",
        message: "Type 'DELETE ALL' to confirm:",
      },
    ]);

    if (doubleConfirm === "DELETE ALL") {
      console.log("Resetting database...");
      
      // Delete all data
      await db.client.chatMessage.deleteMany({});
      await db.client.transaction.deleteMany({});
      await db.client.bybitAdvertisement.deleteMany({});
      await db.client.payout.deleteMany({});
      await db.client.blacklistedTransaction.deleteMany({});
      await db.client.systemSettings.deleteMany({});
      await db.client.gateAccount.deleteMany({});
      await db.client.bybitAccount.deleteMany({});
      await db.client.gmailAccount.deleteMany({});
      
      console.log("✓ Database reset complete");
    } else {
      console.log("Reset cancelled");
    }
  }
}

async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join("data", "backups", `backup_${timestamp}.db`);
    
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(path.join("data", "database.db"), backupPath);
    
    console.log(`✓ Database backed up to: ${backupPath}`);
  } catch (error) {
    console.error("✗ Backup failed:", error);
  }
  
  await inquirer.prompt([{ type: "input", name: "continue", message: "Press Enter to continue..." }]);
}

async function startApplication() {
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Start in which mode?",
      choices: [
        { name: "Manual - Confirm each action", value: "manual" },
        { name: "Automatic - Run without confirmations", value: "automatic" },
      ],
    },
  ]);

  await db.setSetting("mode", mode);
  
  console.log(`\nStarting Itrader in ${mode} mode...\n`);
  
  // Disconnect CLI database connection first
  await db.disconnect();
  
  // Start the main app in a child process
  const { spawn } = await import("child_process");
  const child = spawn("bun", ["run", "src/app.ts"], {
    stdio: "inherit",
    env: { ...process.env, ITRADER_MODE: mode }
  });
  
  // Handle process termination
  let isTerminating = false;
  
  const cleanup = (signal?: string) => {
    if (!isTerminating) {
      isTerminating = true;
      console.log("\nStopping application...");
      
      // Try graceful shutdown first
      if (process.platform === "win32") {
        // On Windows, use taskkill to send CTRL+C
        const { execSync } = require("child_process");
        try {
          execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
        } catch (e) {
          // If taskkill fails, fall back to normal kill
          child.kill("SIGTERM");
        }
      } else {
        // On Unix-like systems, send SIGINT first
        child.kill("SIGINT");
      }
      
      // Force kill after timeout
      setTimeout(() => {
        if (!child.killed) {
          console.log("Force stopping...");
          child.kill("SIGKILL");
        }
      }, 5000);
    }
  };
  
  // Forward signals to child process
  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  
  // When child process exits, return to menu
  child.on("exit", (code, signal) => {
    // Remove signal handlers
    process.removeListener("SIGINT", cleanup);
    process.removeListener("SIGTERM", cleanup);
    
    if (code !== 0 && code !== null) {
      console.log(`\nApplication exited with code ${code}`);
    } else if (signal) {
      console.log(`\nApplication terminated by signal ${signal}`);
    }
    
    // Re-run CLI menu after a short delay
    setTimeout(() => {
      runCLI();
    }, 1000);
  });
}

// Export is already done on line 18