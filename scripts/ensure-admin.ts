#!/usr/bin/env bun

import { PrismaClient } from '../generated/prisma';
import { hashPassword } from '../src/webserver/utils/password';
import { createLogger } from '../src/logger';

const logger = createLogger('EnsureAdmin');
const prisma = new PrismaClient();

async function ensureAdminAccount() {
  try {
    logger.info('🔍 Checking for admin account...');
    console.log('🔍 Checking for admin account...');

    // Check if admin account exists
    const adminAccount = await prisma.systemAccount.findUnique({
      where: { username: 'admin' }
    });

    if (adminAccount) {
      logger.info('✅ Admin account already exists');
      console.log('✅ Admin account already exists');
      console.log(`Username: admin`);
      console.log(`Role: ${adminAccount.role}`);
      console.log(`Active: ${adminAccount.isActive}`);
      console.log(`Created: ${adminAccount.createdAt.toLocaleString()}`);
      
      if (adminAccount.lastLogin) {
        console.log(`Last login: ${adminAccount.lastLogin.toLocaleString()}`);
      }
      
      return;
    }

    // Create admin account
    logger.info('📝 Creating default admin account...');
    console.log('📝 Creating default admin account...');

    const defaultPassword = 'admin123'; // Change this in production!
    const passwordHash = await hashPassword(defaultPassword);

    const newAdmin = await prisma.systemAccount.create({
      data: {
        username: 'admin',
        passwordHash,
        role: 'admin',
        isActive: true
      }
    });

    logger.info('✅ Admin account created successfully!', {
      id: newAdmin.id,
      username: newAdmin.username,
      role: newAdmin.role
    });

    console.log('\n✅ Admin account created successfully!');
    console.log('====================================');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('====================================');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('');

  } catch (error) {
    logger.error('❌ Failed to ensure admin account', error as Error);
    console.error('❌ Failed to ensure admin account:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
ensureAdminAccount();