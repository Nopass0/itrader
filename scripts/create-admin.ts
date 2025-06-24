#!/usr/bin/env bun

import { AuthManager } from '../src/webserver/auth/authManager';
import { createLogger } from '../src/logger';
import inquirer from 'inquirer';

const logger = createLogger('CreateAdmin');
const authManager = new AuthManager();

async function createAdminAccount() {
  try {
    console.log('🔐 Create Admin Account');
    console.log('====================\n');

    // Prompt for username
    const { username } = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Enter admin username:',
        default: 'admin',
        validate: (input) => {
          if (!input.trim()) {
            return 'Username cannot be empty';
          }
          return true;
        }
      }
    ]);

    logger.info('Creating admin account...', { username });

    try {
      const { account, password } = await authManager.createAccount(username, 'admin');
      
      logger.info('✅ Admin account created successfully!', {
        id: account.id,
        username: account.username,
        role: account.role
      });

      console.log('\n✅ Admin account created successfully!');
      console.log('====================================');
      console.log(`Username: ${account.username}`);
      console.log(`Password: ${password}`);
      console.log(`Role: ${account.role}`);
      console.log('====================================');
      console.log('⚠️  IMPORTANT: Save this password! It cannot be recovered.');
      console.log('');

    } catch (error: any) {
      if (error.message === 'Username already exists') {
        console.error('\n❌ Error: An account with this username already exists.');
        console.log('💡 Tip: Use scripts/reset-admin-password.ts to reset the password.');
      } else {
        throw error;
      }
    }

  } catch (error) {
    logger.error('❌ Failed to create admin account', error as Error);
    console.error('\n❌ Failed to create admin account:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
createAdminAccount();