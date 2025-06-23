#!/usr/bin/env bun
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import inquirer from "inquirer";
import { createLogger } from "./src/logger";

const prisma = new PrismaClient();
const logger = createLogger("AccountManager");

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
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

async function createAccount(role: string = "operator") {
  const { username } = await inquirer.prompt([
    {
      type: "input",
      name: "username",
      message: "Enter username:",
      validate: (input) => input.trim().length > 0 || "Username cannot be empty",
    },
  ]);

  const { password } = await inquirer.prompt([
    {
      type: "password",
      name: "password",
      message: "Enter password:",
      mask: "*",
      validate: (input) => input.length >= 6 || "Password must be at least 6 characters",
    },
  ]);

  const { confirmPassword } = await inquirer.prompt([
    {
      type: "password",
      name: "confirmPassword",
      message: "Confirm password:",
      mask: "*",
      validate: (input, answers) => input === password || "Passwords do not match",
    },
  ]);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.webServerUser.create({
      data: {
        username,
        password: hashedPassword,
        role,
        isActive: true,
      },
    });

    console.log(`\n${colors.green}✓${colors.reset} User ${colors.bright}${username}${colors.reset} created successfully with role ${colors.yellow}${role}${colors.reset}`);
    logger.info("WebServer user created", { username, role });
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.error(`\n${colors.red}✗${colors.reset} User ${colors.bright}${username}${colors.reset} already exists`);
    } else {
      console.error(`\n${colors.red}✗${colors.reset} Error creating user:`, error.message);
      logger.error("Failed to create WebServer user", error, { username, role });
    }
  }
}

async function listAccounts() {
  const users = await prisma.webServerUser.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLogin: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log(`\n${colors.yellow}No accounts found${colors.reset}`);
    return;
  }

  console.log(`\n${colors.bright}WebServer Accounts:${colors.reset}`);
  console.log("─".repeat(80));
  
  users.forEach((user) => {
    const roleColor = user.role === 'admin' ? colors.red : 
                     user.role === 'operator' ? colors.blue : colors.green;
    const statusColor = user.isActive ? colors.green : colors.red;
    const status = user.isActive ? 'Active' : 'Inactive';
    const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';
    
    console.log(`${colors.bright}${user.username}${colors.reset} (${roleColor}${user.role}${colors.reset}) - ${statusColor}${status}${colors.reset}`);
    console.log(`  Created: ${new Date(user.createdAt).toLocaleString()}`);
    console.log(`  Last Login: ${lastLogin}`);
    console.log(`  ID: ${user.id}`);
    console.log("─".repeat(80));
  });
}

async function resetPassword() {
  const users = await prisma.webServerUser.findMany({
    select: { username: true },
    orderBy: { username: 'asc' },
  });

  if (users.length === 0) {
    console.log(`\n${colors.yellow}No accounts found${colors.reset}`);
    return;
  }

  const { username } = await inquirer.prompt([
    {
      type: "list",
      name: "username",
      message: "Select account to reset password:",
      choices: users.map(u => u.username),
    },
  ]);

  const { password } = await inquirer.prompt([
    {
      type: "password",
      name: "password",
      message: "Enter new password:",
      mask: "*",
      validate: (input) => input.length >= 6 || "Password must be at least 6 characters",
    },
  ]);

  const { confirmPassword } = await inquirer.prompt([
    {
      type: "password",
      name: "confirmPassword",
      message: "Confirm new password:",
      mask: "*",
      validate: (input) => input === password || "Passwords do not match",
    },
  ]);

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.webServerUser.update({
      where: { username },
      data: { password: hashedPassword },
    });

    console.log(`\n${colors.green}✓${colors.reset} Password reset successfully for ${colors.bright}${username}${colors.reset}`);
    logger.info("WebServer user password reset", { username });
  } catch (error) {
    console.error(`\n${colors.red}✗${colors.reset} Failed to reset password:`, error);
    logger.error("Failed to reset WebServer user password", error as Error, { username });
  }
}

async function deleteAccount() {
  const users = await prisma.webServerUser.findMany({
    select: { username: true, role: true },
    orderBy: { username: 'asc' },
  });

  if (users.length === 0) {
    console.log(`\n${colors.yellow}No accounts found${colors.reset}`);
    return;
  }

  const { username } = await inquirer.prompt([
    {
      type: "list",
      name: "username",
      message: "Select account to delete:",
      choices: users.map(u => ({
        name: `${u.username} (${u.role})`,
        value: u.username,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to delete account "${username}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(`\n${colors.yellow}Deletion cancelled${colors.reset}`);
    return;
  }

  try {
    await prisma.webServerUser.delete({
      where: { username },
    });

    console.log(`\n${colors.green}✓${colors.reset} Account ${colors.bright}${username}${colors.reset} deleted successfully`);
    logger.info("WebServer user deleted", { username });
  } catch (error) {
    console.error(`\n${colors.red}✗${colors.reset} Failed to delete account:`, error);
    logger.error("Failed to delete WebServer user", error as Error, { username });
  }
}

async function accountMenu() {
  while (true) {
    showHeader();
    console.log(`${colors.bright}Account Management${colors.reset}`);
    console.log("==================\n");

    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Select an option:",
        choices: [
          { name: "1) Create/Reset Admin Account", value: "1" },
          { name: "2) Create Operator Account", value: "2" },
          { name: "3) List All Accounts", value: "3" },
          { name: "4) Reset Account Password", value: "4" },
          { name: "5) Delete Account", value: "5" },
          { name: "6) Back to Main Menu", value: "6" },
        ],
      },
    ]);

    switch (choice) {
      case "1":
        await createAccount("admin");
        break;
      case "2":
        await createAccount("operator");
        break;
      case "3":
        await listAccounts();
        break;
      case "4":
        await resetPassword();
        break;
      case "5":
        await deleteAccount();
        break;
      case "6":
        return;
    }

    await inquirer.prompt([
      {
        type: "input",
        name: "continue",
        message: "\nPress Enter to continue...",
      },
    ]);
  }
}

// Command line interface
async function cliMode() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "create":
      const username = args[1];
      const role = args[2] || "operator";
      
      if (!username) {
        console.error("Usage: bun run manage-webserver-accounts.ts create <username> [role]");
        process.exit(1);
      }

      const { password } = await inquirer.prompt([
        {
          type: "password",
          name: "password",
          message: `Enter password for ${username}:`,
          mask: "*",
          validate: (input) => input.length >= 6 || "Password must be at least 6 characters",
        },
      ]);

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.webServerUser.create({
          data: {
            username,
            password: hashedPassword,
            role,
            isActive: true,
          },
        });
        console.log(`User ${username} created successfully with role ${role}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.error(`User ${username} already exists`);
        } else {
          console.error("Error creating user:", error.message);
        }
      }
      break;

    case "list":
      await listAccounts();
      break;

    case "reset":
      const resetUsername = args[1];
      if (!resetUsername) {
        console.error("Usage: bun run manage-webserver-accounts.ts reset <username>");
        process.exit(1);
      }

      const { newPassword } = await inquirer.prompt([
        {
          type: "password",
          name: "newPassword",
          message: `Enter new password for ${resetUsername}:`,
          mask: "*",
          validate: (input) => input.length >= 6 || "Password must be at least 6 characters",
        },
      ]);

      try {
        const newHashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.webServerUser.update({
          where: { username: resetUsername },
          data: { password: newHashedPassword },
        });
        console.log(`Password reset successfully for ${resetUsername}`);
      } catch (error) {
        console.error(`User ${resetUsername} not found`);
      }
      break;

    default:
      console.log("Usage:");
      console.log("  bun run manage-webserver-accounts.ts create <username> [role]");
      console.log("  bun run manage-webserver-accounts.ts list");
      console.log("  bun run manage-webserver-accounts.ts reset <username>");
      console.log("\nRoles: admin, operator, viewer");
      console.log("\nOr run without arguments for interactive mode");
  }
}

async function main() {
  try {
    // Check if running with command line arguments
    if (process.argv.length > 2) {
      await cliMode();
    } else {
      // Interactive mode - show account menu
      await accountMenu();
    }
  } catch (error) {
    console.error("Error:", error);
    logger.error("Account manager error", error as Error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);