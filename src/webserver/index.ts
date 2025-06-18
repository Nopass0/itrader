/**
 * WebSocket сервер для управления системой
 */

export { WebSocketServer } from './server';
export { AuthManager } from './auth/authManager';
export * from './types';
export { getGlobalIO, setGlobalIO } from './global';

// CLI команды для управления аккаунтами
import { AuthManager } from './auth/authManager';
import { PrismaClient } from '../../generated/prisma';

const authManager = new AuthManager();
const prisma = new PrismaClient();

/**
 * CLI команды
 */
export const cli = {
  /**
   * Создать аккаунт
   * Usage: bun run src/webserver create-account <username> [role]
   */
  async createAccount(username: string, role: 'admin' | 'operator' | 'viewer' = 'operator') {
    try {
      const { account, password } = await authManager.createAccount(username, role);
      console.log('Account created successfully!');
      console.log('------------------------');
      console.log(`Username: ${account.username}`);
      console.log(`Password: ${password}`);
      console.log(`Role: ${account.role}`);
      console.log('------------------------');
      console.log('Save this password! It cannot be recovered.');
    } catch (error) {
      console.error('Error creating account:', error.message);
      process.exit(1);
    }
  },

  /**
   * Удалить аккаунт
   * Usage: bun run src/webserver delete-account <username>
   */
  async deleteAccount(username: string) {
    try {
      const account = await authManager.getAccountByUsername(username);
      if (!account) {
        throw new Error('Account not found');
      }
      
      await authManager.deleteAccount(account.id);
      console.log(`Account '${username}' deleted successfully`);
    } catch (error) {
      console.error('Error deleting account:', error.message);
      process.exit(1);
    }
  },

  /**
   * Сбросить пароль
   * Usage: bun run src/webserver reset-password <username>
   */
  async resetPassword(username: string) {
    try {
      const account = await authManager.getAccountByUsername(username);
      if (!account) {
        throw new Error('Account not found');
      }
      
      const newPassword = await authManager.resetPassword(account.id);
      console.log('Password reset successfully!');
      console.log('------------------------');
      console.log(`Username: ${username}`);
      console.log(`New Password: ${newPassword}`);
      console.log('------------------------');
    } catch (error) {
      console.error('Error resetting password:', error.message);
      process.exit(1);
    }
  },

  /**
   * Список аккаунтов
   * Usage: bun run src/webserver list-accounts
   */
  async listAccounts() {
    try {
      const accounts = await authManager.listAccounts();
      
      if (accounts.length === 0) {
        console.log('No accounts found');
        return;
      }
      
      console.log('System Accounts:');
      console.log('------------------------');
      accounts.forEach(account => {
        console.log(`${account.username} (${account.role}) - ${account.isActive ? 'Active' : 'Inactive'}`);
        if (account.lastLogin) {
          console.log(`  Last login: ${account.lastLogin.toLocaleString()}`);
        }
      });
    } catch (error) {
      console.error('Error listing accounts:', error.message);
      process.exit(1);
    }
  },

  /**
   * Изменить роль
   * Usage: bun run src/webserver change-role <username> <new-role>
   */
  async changeRole(username: string, newRole: 'admin' | 'operator' | 'viewer') {
    try {
      const account = await authManager.getAccountByUsername(username);
      if (!account) {
        throw new Error('Account not found');
      }
      
      await authManager.updateAccount(account.id, { role: newRole });
      console.log(`Role changed successfully for '${username}' to '${newRole}'`);
    } catch (error) {
      console.error('Error changing role:', error.message);
      process.exit(1);
    }
  },

  /**
   * Активировать/деактивировать аккаунт
   * Usage: bun run src/webserver toggle-account <username>
   */
  async toggleAccount(username: string) {
    try {
      const account = await authManager.getAccountByUsername(username);
      if (!account) {
        throw new Error('Account not found');
      }
      
      const newStatus = !account.isActive;
      await authManager.updateAccount(account.id, { isActive: newStatus });
      console.log(`Account '${username}' ${newStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling account:', error.message);
      process.exit(1);
    }
  }
};

// Обработка CLI команд если запущен напрямую
if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);

  const commands = {
    'create-account': () => cli.createAccount(args[0], args[1] as any),
    'delete-account': () => cli.deleteAccount(args[0]),
    'reset-password': () => cli.resetPassword(args[0]),
    'list-accounts': () => cli.listAccounts(),
    'change-role': () => cli.changeRole(args[0], args[1] as any),
    'toggle-account': () => cli.toggleAccount(args[0]),
  };

  if (!command || !commands[command]) {
    console.log('Available commands:');
    console.log('  create-account <username> [role]   - Create new account');
    console.log('  delete-account <username>          - Delete account');
    console.log('  reset-password <username>          - Reset account password');
    console.log('  list-accounts                      - List all accounts');
    console.log('  change-role <username> <role>      - Change account role');
    console.log('  toggle-account <username>          - Activate/deactivate account');
    console.log('\nRoles: admin, operator, viewer');
    process.exit(1);
  }

  commands[command]()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}