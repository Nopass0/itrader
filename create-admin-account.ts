#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
import { hashPassword } from './src/webserver/utils/password';

const prisma = new PrismaClient();

async function createAdminAccount() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3];
  
  if (!password) {
    console.error('Usage: bun run create-admin-account.ts [username] <password>');
    console.error('Example: bun run create-admin-account.ts admin mypassword');
    process.exit(1);
  }
  
  console.log(`Creating/updating admin account '${username}'...`);
  
  try {
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create or update admin account
    const admin = await prisma.systemAccount.upsert({
      where: { username },
      update: {
        passwordHash,
        role: 'admin',
        isActive: true
      },
      create: {
        username,
        passwordHash,
        role: 'admin',
        isActive: true
      }
    });
    
    console.log('✅ Admin account created/updated successfully!');
    console.log(`Username: ${username}`);
    console.log('Role: admin');
    console.log('ID:', admin.id);
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminAccount();