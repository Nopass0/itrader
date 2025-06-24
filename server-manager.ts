#!/usr/bin/env bun
import inquirer from "inquirer";
import { spawn, execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { createLogger } from "./src/logger";

// Try to import PrismaClient, generate if not available
let PrismaClient: any;
let prisma: any;

try {
  const prismaModule = await import("./generated/prisma");
  PrismaClient = prismaModule.PrismaClient;
  prisma = new PrismaClient();
} catch (error) {
  console.log("Prisma client not found. Generating...\n");
  try {
    execSync("bunx prisma generate", { stdio: "inherit" });
    const prismaModule = await import("./generated/prisma");
    PrismaClient = prismaModule.PrismaClient;
    prisma = new PrismaClient();
  } catch (genError) {
    console.error("Failed to generate Prisma client. Please run 'bunx prisma generate' manually.");
    process.exit(1);
  }
}

const logger = createLogger("ServerManager");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function clearScreen() {
  console.clear();
}

function showHeader() {
  clearScreen();
  console.log(`${colors.cyan}╔═══════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║${colors.bright}       iTrader Server Manager          ${colors.reset}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.bright}     P2P Trading Automation System     ${colors.reset}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════════╝${colors.reset}\n`);
}

async function runScript(scriptPath: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", scriptPath, ...args], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

async function getSystemStatus() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = `${colors.green}Connected${colors.reset}`;
    
    // Get user count
    const userCount = await prisma.webServerUser.count();
    
    // Get transaction count
    const transactionCount = await prisma.transaction.count();
    const activeTransactions = await prisma.transaction.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } }
    });
    
    // Get account counts
    const gateAccounts = await prisma.gateAccount.count({ where: { isActive: true } });
    const bybitAccounts = await prisma.bybitAccount.count({ where: { isActive: true } });
    
    // Get current mode
    const mode = await prisma.settings.findUnique({ where: { key: "mode" } });
    const currentMode = mode?.value || "manual";
    
    console.log(`${colors.bright}System Status${colors.reset}`);
    console.log("─".repeat(40));
    console.log(`Database: ${dbStatus}`);
    console.log(`Mode: ${colors.yellow}${currentMode}${colors.reset}`);
    console.log(`WebServer Users: ${colors.blue}${userCount}${colors.reset}`);
    console.log(`Transactions: ${colors.blue}${transactionCount}${colors.reset} (Active: ${colors.green}${activeTransactions}${colors.reset})`);
    console.log(`Gate Accounts: ${colors.blue}${gateAccounts}${colors.reset}`);
    console.log(`Bybit Accounts: ${colors.blue}${bybitAccounts}${colors.reset}`);
    console.log("─".repeat(40));
  } catch (error) {
    console.log(`${colors.bright}System Status${colors.reset}`);
    console.log("─".repeat(40));
    console.log(`Database: ${colors.red}Error${colors.reset}`);
    console.log("─".repeat(40));
  }
}

async function toggleMode() {
  const currentMode = await prisma.settings.findUnique({ where: { key: "mode" } });
  const mode = currentMode?.value || "manual";
  const newMode = mode === "manual" ? "automatic" : "manual";
  
  await prisma.settings.upsert({
    where: { key: "mode" },
    update: { value: newMode },
    create: { key: "mode", value: newMode },
  });
  
  console.log(`\n${colors.green}✓${colors.reset} Mode changed from ${colors.yellow}${mode}${colors.reset} to ${colors.green}${newMode}${colors.reset}`);
  logger.info("System mode changed", { from: mode, to: newMode });
}

async function viewLogs() {
  const logs = await prisma.systemLog.findMany({
    take: 50,
    orderBy: { timestamp: "desc" },
  });
  
  if (logs.length === 0) {
    console.log(`\n${colors.yellow}No logs found${colors.reset}`);
    return;
  }
  
  console.log(`\n${colors.bright}Recent System Logs:${colors.reset}`);
  console.log("─".repeat(80));
  
  for (const log of logs) {
    const levelColor = log.level === "ERROR" ? colors.red :
                      log.level === "WARN" ? colors.yellow :
                      log.level === "INFO" ? colors.green : colors.reset;
    
    console.log(`[${new Date(log.timestamp).toLocaleString()}] ${levelColor}${log.level}${colors.reset} - ${log.service}`);
    console.log(`  ${log.message}`);
    if (log.error) {
      console.log(`  ${colors.red}Error: ${log.error}${colors.reset}`);
    }
  }
}

async function resetDatabase() {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `${colors.red}WARNING: This will delete ALL data. Are you sure?${colors.reset}`,
      default: false,
    },
  ]);
  
  if (!confirm) {
    console.log(`\n${colors.yellow}Database reset cancelled${colors.reset}`);
    return;
  }
  
  const { confirmAgain } = await inquirer.prompt([
    {
      type: "input",
      name: "confirmAgain",
      message: `Type "DELETE ALL DATA" to confirm:`,
      validate: (input) => input === "DELETE ALL DATA" || "Type exactly: DELETE ALL DATA",
    },
  ]);
  
  console.log(`\n${colors.yellow}Resetting database...${colors.reset}`);
  
  try {
    // Delete all data from tables
    await prisma.systemLog.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.receipt.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.payout.deleteMany();
    await prisma.advertisement.deleteMany();
    await prisma.bybitAccount.deleteMany();
    await prisma.gateAccount.deleteMany();
    await prisma.gmailAccount.deleteMany();
    await prisma.webServerUser.deleteMany();
    await prisma.settings.deleteMany();
    
    console.log(`${colors.green}✓${colors.reset} Database reset successfully`);
    logger.info("Database reset completed");
    
    // Create default admin
    console.log(`\n${colors.yellow}Creating default admin account...${colors.reset}`);
    await runScript("manage-webserver-accounts.ts", ["create", "admin", "admin"]);
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Failed to reset database:`, error);
    logger.error("Database reset failed", error as Error);
  }
}

async function mainMenu() {
  while (true) {
    showHeader();
    await getSystemStatus();
    
    console.log(`\n${colors.bright}Main Menu${colors.reset}`);
    console.log("─".repeat(40));
    
    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Select an option:",
        choices: [
          { name: "1) Start Application", value: "1" },
          { name: "2) Account Management", value: "2" },
          { name: "3) Toggle Mode (Manual/Automatic)", value: "3" },
          { name: "4) View System Logs", value: "4" },
          { name: "5) Database Management", value: "5" },
          { name: "6) System Configuration", value: "6" },
          { name: "7) Exit", value: "7" },
        ],
      },
    ]);
    
    switch (choice) {
      case "1":
        console.log(`\n${colors.green}Starting application...${colors.reset}`);
        await runScript("src/app.ts");
        break;
        
      case "2":
        await runScript("manage-webserver-accounts.ts");
        break;
        
      case "3":
        await toggleMode();
        await inquirer.prompt([
          {
            type: "input",
            name: "continue",
            message: "\nPress Enter to continue...",
          },
        ]);
        break;
        
      case "4":
        await viewLogs();
        await inquirer.prompt([
          {
            type: "input",
            name: "continue",
            message: "\nPress Enter to continue...",
          },
        ]);
        break;
        
      case "5":
        await databaseMenu();
        break;
        
      case "6":
        await configMenu();
        break;
        
      case "7":
        console.log(`\n${colors.green}Goodbye!${colors.reset}`);
        process.exit(0);
    }
  }
}

async function databaseMenu() {
  while (true) {
    showHeader();
    console.log(`${colors.bright}Database Management${colors.reset}`);
    console.log("─".repeat(40));
    
    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Select an option:",
        choices: [
          { name: "1) Backup Database", value: "1" },
          { name: "2) Restore Database", value: "2" },
          { name: "3) Reset Database (Delete All Data)", value: "3" },
          { name: "4) Run Migrations", value: "4" },
          { name: "5) Back to Main Menu", value: "5" },
        ],
      },
    ]);
    
    switch (choice) {
      case "1":
        await backupDatabase();
        break;
        
      case "2":
        await restoreDatabase();
        break;
        
      case "3":
        await resetDatabase();
        break;
        
      case "4":
        console.log(`\n${colors.yellow}Running migrations...${colors.reset}`);
        await runScript("bunx", ["prisma", "migrate", "deploy"]);
        break;
        
      case "5":
        return;
    }
    
    if (choice !== "5") {
      await inquirer.prompt([
        {
          type: "input",
          name: "continue",
          message: "\nPress Enter to continue...",
        },
      ]);
    }
  }
}

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
  
  try {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile("prisma/database.db", backupPath);
    console.log(`\n${colors.green}✓${colors.reset} Database backed up to: ${colors.blue}${backupPath}${colors.reset}`);
    logger.info("Database backup created", { path: backupPath });
  } catch (error) {
    console.error(`\n${colors.red}✗${colors.reset} Failed to backup database:`, error);
    logger.error("Database backup failed", error as Error);
  }
}

async function restoreDatabase() {
  const backupDir = path.join(process.cwd(), "backups");
  
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith("backup-") && f.endsWith(".db"));
    
    if (backupFiles.length === 0) {
      console.log(`\n${colors.yellow}No backup files found${colors.reset}`);
      return;
    }
    
    const { backupFile } = await inquirer.prompt([
      {
        type: "list",
        name: "backupFile",
        message: "Select backup to restore:",
        choices: backupFiles.sort().reverse(),
      },
    ]);
    
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `${colors.yellow}This will overwrite current database. Continue?${colors.reset}`,
        default: false,
      },
    ]);
    
    if (!confirm) {
      console.log(`\n${colors.yellow}Restore cancelled${colors.reset}`);
      return;
    }
    
    const backupPath = path.join(backupDir, backupFile);
    await fs.copyFile(backupPath, "prisma/database.db");
    console.log(`\n${colors.green}✓${colors.reset} Database restored from: ${colors.blue}${backupFile}${colors.reset}`);
    logger.info("Database restored", { backup: backupFile });
  } catch (error) {
    console.error(`\n${colors.red}✗${colors.reset} Failed to restore database:`, error);
    logger.error("Database restore failed", error as Error);
  }
}

async function configMenu() {
  while (true) {
    showHeader();
    console.log(`${colors.bright}System Configuration${colors.reset}`);
    console.log("─".repeat(40));
    
    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Select an option:",
        choices: [
          { name: "1) Configure Gmail OAuth", value: "1" },
          { name: "2) Configure Exchange Rates", value: "2" },
          { name: "3) Configure WebSocket Port", value: "3" },
          { name: "4) View Environment Variables", value: "4" },
          { name: "5) Back to Main Menu", value: "5" },
        ],
      },
    ]);
    
    switch (choice) {
      case "1":
        console.log(`\n${colors.yellow}Opening Gmail OAuth setup...${colors.reset}`);
        await runScript("setup-gmail.ts");
        break;
        
      case "2":
        await configureExchangeRates();
        break;
        
      case "3":
        await configureWebSocketPort();
        break;
        
      case "4":
        await viewEnvironment();
        break;
        
      case "5":
        return;
    }
    
    if (choice !== "5") {
      await inquirer.prompt([
        {
          type: "input",
          name: "continue",
          message: "\nPress Enter to continue...",
        },
      ]);
    }
  }
}

async function configureExchangeRates() {
  const currentRate = await prisma.settings.findUnique({ where: { key: "exchangeRate" } });
  const rate = currentRate ? JSON.parse(currentRate.value) : { mode: "constant", rate: 100 };
  
  console.log(`\n${colors.bright}Current Exchange Rate Configuration:${colors.reset}`);
  console.log(`Mode: ${colors.yellow}${rate.mode}${colors.reset}`);
  if (rate.mode === "constant") {
    console.log(`Rate: ${colors.green}${rate.rate} RUB/USD${colors.reset}`);
  }
  
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Select exchange rate mode:",
      choices: [
        { name: "Constant Rate", value: "constant" },
        { name: "Automatic (from API)", value: "automatic" },
      ],
    },
  ]);
  
  let newRate = { mode };
  
  if (mode === "constant") {
    const { rateValue } = await inquirer.prompt([
      {
        type: "number",
        name: "rateValue",
        message: "Enter exchange rate (RUB per USD):",
        default: rate.rate || 100,
        validate: (input) => input > 0 || "Rate must be positive",
      },
    ]);
    newRate.rate = rateValue;
  }
  
  await prisma.settings.upsert({
    where: { key: "exchangeRate" },
    update: { value: JSON.stringify(newRate) },
    create: { key: "exchangeRate", value: JSON.stringify(newRate) },
  });
  
  console.log(`\n${colors.green}✓${colors.reset} Exchange rate configuration updated`);
  logger.info("Exchange rate configured", newRate);
}

async function configureWebSocketPort() {
  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";
  
  try {
    envContent = await fs.readFile(envPath, "utf-8");
  } catch {
    // .env doesn't exist
  }
  
  const currentPort = process.env.WEBSOCKET_PORT || "3001";
  console.log(`\n${colors.bright}Current WebSocket Port: ${colors.yellow}${currentPort}${colors.reset}`);
  
  const { port } = await inquirer.prompt([
    {
      type: "number",
      name: "port",
      message: "Enter new WebSocket port:",
      default: parseInt(currentPort),
      validate: (input) => (input > 0 && input < 65536) || "Invalid port number",
    },
  ]);
  
  // Update or add WEBSOCKET_PORT in .env
  const portRegex = /^WEBSOCKET_PORT=.*$/m;
  if (portRegex.test(envContent)) {
    envContent = envContent.replace(portRegex, `WEBSOCKET_PORT=${port}`);
  } else {
    envContent += `\nWEBSOCKET_PORT=${port}\n`;
  }
  
  await fs.writeFile(envPath, envContent);
  console.log(`\n${colors.green}✓${colors.reset} WebSocket port updated to ${colors.yellow}${port}${colors.reset}`);
  console.log(`${colors.yellow}Note: Restart the application for changes to take effect${colors.reset}`);
}

async function viewEnvironment() {
  console.log(`\n${colors.bright}Environment Variables:${colors.reset}`);
  console.log("─".repeat(40));
  
  const envVars = [
    "WEBSOCKET_PORT",
    "JWT_SECRET",
    "FRONTEND_URL",
    "MODE",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_SERVICE_NAME",
  ];
  
  for (const varName of envVars) {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName === "JWT_SECRET" ? "***" : value;
      console.log(`${colors.blue}${varName}${colors.reset}: ${displayValue}`);
    }
  }
  
  console.log("─".repeat(40));
}

async function main() {
  try {
    await mainMenu();
  } catch (error) {
    console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
    logger.error("Server manager fatal error", error as Error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);