#!/usr/bin/env bun
import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";
import open from "open";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

async function main() {
  console.log(`\n${colors.cyan}Gmail OAuth Setup${colors.reset}`);
  console.log("─".repeat(40));
  console.log("\nThis wizard will help you set up Gmail OAuth for receipt processing.\n");

  const { hasCredentials } = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasCredentials",
      message: "Do you already have Google OAuth credentials?",
      default: false,
    },
  ]);

  if (!hasCredentials) {
    console.log(`\n${colors.yellow}Steps to create OAuth credentials:${colors.reset}`);
    console.log("1. Go to Google Cloud Console");
    console.log("2. Create a new project or select existing");
    console.log("3. Enable Gmail API");
    console.log("4. Create OAuth 2.0 credentials");
    console.log("5. Add authorized redirect URI: http://localhost:3000/panel/gmail-callback");
    console.log("6. Download credentials JSON\n");

    const { openConsole } = await inquirer.prompt([
      {
        type: "confirm",
        name: "openConsole",
        message: "Open Google Cloud Console in browser?",
        default: true,
      },
    ]);

    if (openConsole) {
      await open("https://console.cloud.google.com/apis/credentials");
    }

    const { continueSetup } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continueSetup",
        message: "Continue with setup after creating credentials?",
        default: true,
      },
    ]);

    if (!continueSetup) {
      console.log(`\n${colors.yellow}Setup cancelled. Run this script again when ready.${colors.reset}`);
      return;
    }
  }

  const { setupMethod } = await inquirer.prompt([
    {
      type: "list",
      name: "setupMethod",
      message: "How would you like to provide credentials?",
      choices: [
        { name: "Enter manually", value: "manual" },
        { name: "Paste JSON content", value: "paste" },
        { name: "Use existing file", value: "existing" },
      ],
    },
  ]);

  let credentials: any = {};

  if (setupMethod === "manual") {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "clientId",
        message: "Enter Client ID:",
        validate: (input) => input.trim().length > 0 || "Client ID is required",
      },
      {
        type: "input",
        name: "clientSecret",
        message: "Enter Client Secret:",
        validate: (input) => input.trim().length > 0 || "Client Secret is required",
      },
      {
        type: "input",
        name: "redirectUri",
        message: "Enter Redirect URI:",
        default: "http://localhost:3000/panel/gmail-callback",
      },
    ]);

    credentials = {
      installed: {
        client_id: answers.clientId,
        project_id: "itrader-project",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_secret: answers.clientSecret,
        redirect_uris: [answers.redirectUri],
      },
    };
  } else if (setupMethod === "paste") {
    const { jsonContent } = await inquirer.prompt([
      {
        type: "editor",
        name: "jsonContent",
        message: "Paste the credentials JSON content:",
        validate: (input) => {
          try {
            JSON.parse(input);
            return true;
          } catch {
            return "Invalid JSON format";
          }
        },
      },
    ]);

    credentials = JSON.parse(jsonContent);
  } else {
    const { filePath } = await inquirer.prompt([
      {
        type: "input",
        name: "filePath",
        message: "Enter path to credentials JSON file:",
        validate: async (input) => {
          try {
            await fs.access(input);
            return true;
          } catch {
            return "File not found";
          }
        },
      },
    ]);

    const content = await fs.readFile(filePath, "utf-8");
    credentials = JSON.parse(content);
  }

  // Save credentials
  const credentialsPath = path.join(process.cwd(), "data", "gmail-credentials.json");
  await fs.mkdir(path.dirname(credentialsPath), { recursive: true });
  await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));

  console.log(`\n${colors.green}✓${colors.reset} Credentials saved to: ${colors.blue}${credentialsPath}${colors.reset}`);

  // Update .env with frontend URL
  const { frontendUrl } = await inquirer.prompt([
    {
      type: "input",
      name: "frontendUrl",
      message: "Enter your frontend URL:",
      default: "http://localhost:3000",
    },
  ]);

  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";

  try {
    envContent = await fs.readFile(envPath, "utf-8");
  } catch {
    // .env doesn't exist
  }

  const urlRegex = /^FRONTEND_URL=.*$/m;
  if (urlRegex.test(envContent)) {
    envContent = envContent.replace(urlRegex, `FRONTEND_URL=${frontendUrl}`);
  } else {
    envContent += `\nFRONTEND_URL=${frontendUrl}\n`;
  }

  await fs.writeFile(envPath, envContent);

  console.log(`\n${colors.green}✓${colors.reset} Gmail OAuth setup complete!`);
  console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
  console.log("1. Start the application");
  console.log("2. Go to the Accounts page in the web interface");
  console.log("3. Click 'Connect Gmail Account'");
  console.log("4. Authorize the application\n");
}

main().catch(console.error);