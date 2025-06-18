#!/usr/bin/env bun
/**
 * CLI tool for managing WebSocket server accounts
 */

import { cli } from './src/webserver';

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  switch (command) {
    case 'create':
      if (args.length < 1) {
        console.error('Usage: bun run manage-webserver-accounts.ts create <username> [role]');
        console.error('Roles: admin, operator, viewer (default: operator)');
        process.exit(1);
      }
      await cli.createAccount(args[0], args[1] as any);
      break;

    case 'delete':
      if (args.length < 1) {
        console.error('Usage: bun run manage-webserver-accounts.ts delete <username>');
        process.exit(1);
      }
      await cli.deleteAccount(args[0]);
      break;

    case 'reset':
      if (args.length < 1) {
        console.error('Usage: bun run manage-webserver-accounts.ts reset <username>');
        process.exit(1);
      }
      await cli.resetPassword(args[0]);
      break;

    case 'list':
      await cli.listAccounts();
      break;

    case 'role':
      if (args.length < 2) {
        console.error('Usage: bun run manage-webserver-accounts.ts role <username> <new-role>');
        console.error('Roles: admin, operator, viewer');
        process.exit(1);
      }
      await cli.changeRole(args[0], args[1] as any);
      break;

    case 'toggle':
      if (args.length < 1) {
        console.error('Usage: bun run manage-webserver-accounts.ts toggle <username>');
        process.exit(1);
      }
      await cli.toggleAccount(args[0]);
      break;

    default:
      console.log('WebSocket Server Account Management');
      console.log('==================================');
      console.log('');
      console.log('Commands:');
      console.log('  create <username> [role]   - Create new account (roles: admin, operator, viewer)');
      console.log('  delete <username>          - Delete account');
      console.log('  reset <username>           - Reset account password');
      console.log('  list                       - List all accounts');
      console.log('  role <username> <role>     - Change account role');
      console.log('  toggle <username>          - Activate/deactivate account');
      console.log('');
      console.log('Examples:');
      console.log('  bun run manage-webserver-accounts.ts create admin admin');
      console.log('  bun run manage-webserver-accounts.ts create john operator');
      console.log('  bun run manage-webserver-accounts.ts reset john');
      console.log('  bun run manage-webserver-accounts.ts list');
      process.exit(0);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});