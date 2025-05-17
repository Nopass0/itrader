#!/usr/bin/env bun
import { createInterface } from 'node:readline/promises';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prisma = new PrismaClient();

// Global CLI state
let shouldExit = false;

// Terminal UI helpers
const ui = {
  box: (title: string, content: string) => {
    const lines = content.split('\n');
    const width = Math.max(...lines.map(line => line.length), title.length) + 4;
    
    console.log(chalk.cyan('╭' + '─'.repeat(width - 2) + '╮'));
    console.log(chalk.cyan('│') + ' ' + chalk.bold(title) + ' '.repeat(width - title.length - 3) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ' '.repeat(width - 2) + chalk.cyan('│'));
    
    for (const line of lines) {
      console.log(chalk.cyan('│') + ' ' + line + ' '.repeat(width - line.length - 3) + chalk.cyan('│'));
    }
    
    console.log(chalk.cyan('╰' + '─'.repeat(width - 2) + '╯'));
  },
  
  title: (text: string) => {
    const width = text.length + 8;
    console.log('');
    console.log(chalk.bgCyan(chalk.black(' '.repeat(width))));
    console.log(chalk.bgCyan(chalk.black('    ' + text + '    ')));
    console.log(chalk.bgCyan(chalk.black(' '.repeat(width))));
    console.log('');
  },
  
  info: (text: string) => {
    console.log(chalk.cyan('ℹ ') + text);
  },
  
  success: (text: string) => {
    console.log(chalk.green('✓ ') + text);
  },
  
  warning: (text: string) => {
    console.log(chalk.yellow('⚠ ') + text);
  },
  
  error: (text: string) => {
    console.log(chalk.red('✗ ') + text);
  },
  
  divider: () => {
    console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
  },
};

// CLI menu helpers
async function showMenu(title: string, options: { label: string; action: () => Promise<void> }[]) {
  while (!shouldExit) {
    ui.title(title);
    
    console.log('Choose an option:\n');
    
    options.forEach((option, index) => {
      console.log(`  ${chalk.cyan(`${index + 1}.`)} ${option.label}`);
    });
    
    console.log(`\n  ${chalk.cyan('0.')} Back / Exit\n`);
    
    const answer = await readline.question('Enter your choice: ');
    const choice = parseInt(answer, 10);
    
    if (choice === 0) {
      return;
    }
    
    if (choice >= 1 && choice <= options.length) {
      await options[choice - 1].action();
    } else {
      ui.error('Invalid choice. Please try again.');
    }
  }
}

// Admin management
async function adminManagement() {
  await showMenu('Admin Management', [
    {
      label: 'Create admin account',
      action: async () => {
        const username = await readline.question('Enter admin username: ');
        const password = await readline.question('Enter admin password: ');
        
        try {
          const token = crypto.randomBytes(16).toString('hex');
          
          const admin = await prisma.admin.create({
            data: {
              username,
              password, // Should be hashed in a real app
              token,
            },
          });
          
          ui.success(`Admin account created successfully!`);
          ui.info(`Admin ID: ${admin.id}`);
          ui.info(`Admin Token: ${admin.token}`);
          
          ui.warning('Keep this token secure! It will be used to create user accounts.');
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to create admin account: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
    {
      label: 'List admin accounts',
      action: async () => {
        try {
          const admins = await prisma.admin.findMany({
            select: {
              id: true,
              username: true,
              token: true,
              createdAt: true,
              _count: {
                select: {
                  users: true,
                },
              },
            },
          });
          
          if (admins.length === 0) {
            ui.info('No admin accounts found.');
          } else {
            ui.info(`Found ${admins.length} admin accounts:`);
            console.log('');
            
            for (const admin of admins) {
              console.log(chalk.cyan(`Admin ID: ${admin.id}`));
              console.log(`Username: ${admin.username}`);
              console.log(`Token: ${admin.token}`);
              console.log(`Created: ${admin.createdAt.toLocaleString()}`);
              console.log(`Users managed: ${admin._count.users}`);
              console.log('');
            }
          }
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to list admin accounts: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
  ]);
}

// User management
async function userManagement() {
  await showMenu('User Management', [
    {
      label: 'List users',
      action: async () => {
        try {
          const users = await prisma.user.findMany({
            include: {
              admin: {
                select: {
                  username: true,
                },
              },
              gateCredentials: {
                select: {
                  id: true,
                  email: true,
                },
              },
              bybitCredentials: {
                select: {
                  id: true,
                  apiKey: true,
                },
              },
            },
          });
          
          if (users.length === 0) {
            ui.info('No users found.');
          } else {
            ui.info(`Found ${users.length} users:`);
            console.log('');
            
            for (const user of users) {
              console.log(chalk.cyan(`User ID: ${user.id}`));
              console.log(`Username: ${user.username}`);
              console.log(`Created by: ${user.admin.username}`);
              console.log(`Gate.cx credentials: ${user.gateCredentials ? `Yes (ID: ${user.gateCredentials.id}, Email: ${user.gateCredentials.email})` : 'No'}`);
              console.log(`Bybit credentials: ${user.bybitCredentials ? `Yes (ID: ${user.bybitCredentials.id}, API Key: ${user.bybitCredentials.apiKey.substring(0, 8)}...)` : 'No'}`);
              console.log('');
            }
          }
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to list users: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
    {
      label: 'Add Gate.cx credentials to user',
      action: async () => {
        try {
          const userId = parseInt(await readline.question('Enter user ID: '), 10);
          const email = await readline.question('Enter Gate.cx email: ');
          const password = await readline.question('Enter Gate.cx password: ');
          
          const user = await prisma.user.findUnique({
            where: {
              id: userId,
            },
            include: {
              gateCredentials: true,
            },
          });
          
          if (!user) {
            ui.error(`User with ID ${userId} not found.`);
            await readline.question('Press Enter to continue...');
            return;
          }
          
          if (user.gateCredentials) {
            const confirm = await readline.question(`User already has Gate.cx credentials. Update? (y/n): `);
            if (confirm.toLowerCase() !== 'y') {
              return;
            }
            
            await prisma.gateCredentials.update({
              where: {
                userId,
              },
              data: {
                email,
                password,
              },
            });
            
            ui.success(`Gate.cx credentials updated for user ${userId}.`);
          } else {
            await prisma.gateCredentials.create({
              data: {
                userId,
                email,
                password,
              },
            });
            
            ui.success(`Gate.cx credentials added for user ${userId}.`);
          }
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to add Gate.cx credentials: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
    {
      label: 'Add Bybit credentials to user',
      action: async () => {
        try {
          const userId = parseInt(await readline.question('Enter user ID: '), 10);
          const apiKey = await readline.question('Enter Bybit API key: ');
          const apiSecret = await readline.question('Enter Bybit API secret: ');
          
          const user = await prisma.user.findUnique({
            where: {
              id: userId,
            },
            include: {
              bybitCredentials: true,
            },
          });
          
          if (!user) {
            ui.error(`User with ID ${userId} not found.`);
            await readline.question('Press Enter to continue...');
            return;
          }
          
          if (user.bybitCredentials) {
            const confirm = await readline.question(`User already has Bybit credentials. Update? (y/n): `);
            if (confirm.toLowerCase() !== 'y') {
              return;
            }
            
            await prisma.bybitCredentials.update({
              where: {
                userId,
              },
              data: {
                apiKey,
                apiSecret,
              },
            });
            
            ui.success(`Bybit credentials updated for user ${userId}.`);
          } else {
            await prisma.bybitCredentials.create({
              data: {
                userId,
                apiKey,
                apiSecret,
              },
            });
            
            ui.success(`Bybit credentials added for user ${userId}.`);
          }
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to add Bybit credentials: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
  ]);
}

// Session management
async function sessionManagement() {
  await showMenu('Session Management', [
    {
      label: 'View all active sessions',
      action: async () => {
        try {
          const gateSessions = await prisma.gateSession.findMany({
            where: {
              isActive: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          });
          
          const bybitSessions = await prisma.bybitSession.findMany({
            where: {
              isActive: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          });
          
          ui.info(`Active sessions:`);
          console.log('');
          
          console.log(chalk.cyan(`Gate.cx sessions (${gateSessions.length}):`));
          if (gateSessions.length === 0) {
            console.log('  No active Gate.cx sessions.');
          } else {
            for (const session of gateSessions) {
              console.log(`  - User: ${session.user.username} (ID: ${session.user.id})`);
              console.log(`    Session ID: ${session.id}`);
              console.log(`    Last updated: ${session.updatedAt.toLocaleString()}`);
              console.log('');
            }
          }
          
          console.log(chalk.cyan(`Bybit sessions (${bybitSessions.length}):`));
          if (bybitSessions.length === 0) {
            console.log('  No active Bybit sessions.');
          } else {
            for (const session of bybitSessions) {
              console.log(`  - User: ${session.user.username} (ID: ${session.user.id})`);
              console.log(`    Session ID: ${session.id}`);
              console.log(`    Last updated: ${session.updatedAt.toLocaleString()}`);
              console.log('');
            }
          }
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to list sessions: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
    {
      label: 'Refresh all sessions',
      action: async () => {
        try {
          ui.info('Refreshing all sessions...');
          
          // Execute the session refresh script
          const process = spawn('bun', ['run', 'src/services/refreshSessions.ts'], {
            stdio: 'inherit',
          });
          
          await new Promise<void>((resolve) => {
            process.on('close', () => {
              resolve();
            });
          });
          
          ui.success('Sessions refreshed successfully.');
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to refresh sessions: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
  ]);
}

// System management
async function systemManagement() {
  await showMenu('System Management', [
    {
      label: 'Check database',
      action: async () => {
        try {
          ui.info('Checking database...');
          
          // Execute the database check script
          const process = spawn('bun', ['run', 'src/database/check.ts'], {
            stdio: 'inherit',
          });
          
          await new Promise<void>((resolve) => {
            process.on('close', () => {
              resolve();
            });
          });
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Database check failed: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
    {
      label: 'Server status',
      action: async () => {
        try {
          // Count entities
          const [
            adminCount,
            userCount,
            gateCredentialCount,
            bybitCredentialCount,
            gateSessionCount,
            bybitSessionCount,
            transactionLogCount,
          ] = await Promise.all([
            prisma.admin.count(),
            prisma.user.count(),
            prisma.gateCredentials.count(),
            prisma.bybitCredentials.count(),
            prisma.gateSession.count(),
            prisma.bybitSession.count(),
            prisma.transactionLog.count(),
          ]);
          
          ui.info('Server status:');
          console.log('');
          console.log(`Admins: ${adminCount}`);
          console.log(`Users: ${userCount}`);
          console.log(`Gate.cx credentials: ${gateCredentialCount}`);
          console.log(`Bybit credentials: ${bybitCredentialCount}`);
          console.log(`Gate.cx sessions: ${gateSessionCount}`);
          console.log(`Bybit sessions: ${bybitSessionCount}`);
          console.log(`Transaction logs: ${transactionLogCount}`);
          console.log('');
          
          await readline.question('Press Enter to continue...');
        } catch (error) {
          ui.error(`Failed to get server status: ${error}`);
          await readline.question('Press Enter to continue...');
        }
      },
    },
    {
      label: 'Generate admin token',
      action: async () => {
        const token = crypto.randomBytes(16).toString('hex');
        
        ui.info(`Generated admin token: ${token}`);
        ui.warning('This token can be used to authenticate API requests with admin privileges.');
        ui.warning('Set it as ADMIN_TOKEN in your environment variables.');
        
        await readline.question('Press Enter to continue...');
      },
    },
  ]);
}

// Main menu
async function mainMenu() {
  ui.box('🤖 iTrader Admin Console', `
Welcome to the iTrader administration console!
Here you can manage users, sessions, and system settings.
  `);
  
  await showMenu('Main Menu', [
    {
      label: 'Admin Management',
      action: adminManagement,
    },
    {
      label: 'User Management',
      action: userManagement,
    },
    {
      label: 'Session Management',
      action: sessionManagement,
    },
    {
      label: 'System Management',
      action: systemManagement,
    },
    {
      label: 'Exit',
      action: async () => {
        shouldExit = true;
      },
    },
  ]);
  
  readline.close();
  await prisma.$disconnect();
  process.exit(0);
}

// Start the CLI
mainMenu().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});