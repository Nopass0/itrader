#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
import { hashPassword } from './src/webserver/utils/password';

const prisma = new PrismaClient();

async function resetPassword() {
  const username = process.argv[2];
  const newPassword = process.argv[3];
  
  if (!username || !newPassword) {
    console.error('Usage: bun run reset-admin-password.ts <username> <new-password>');
    console.error('Example: bun run reset-admin-password.ts admin newpassword123');
    process.exit(1);
  }
  
  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters long');
    process.exit(1);
  }
  
  try {
    console.log(`Resetting password for '${username}'...`);
    
    // Find account
    const account = await prisma.systemAccount.findUnique({
      where: { username }
    });
    
    if (!account) {
      console.error(`Account '${username}' not found!`);
      process.exit(1);
    }
    
    // Generate new password hash
    const passwordHash = await hashPassword(newPassword);
    
    // Update account
    const updated = await prisma.systemAccount.update({
      where: { username },
      data: { passwordHash }
    });
    
    console.log('✅ Password reset successfully!');
    console.log(`Username: ${updated.username}`);
    console.log(`Role: ${updated.role}`);
    console.log('ID:', updated.id);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();