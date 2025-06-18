#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
import { verifyPassword } from './src/webserver/utils/password';

const prisma = new PrismaClient();

async function checkAdminPassword() {
  try {
    // Find admin account
    const admin = await prisma.systemAccount.findUnique({
      where: { username: 'admin' }
    });
    
    if (!admin) {
      console.log('Admin account not found');
      return;
    }
    
    console.log('Admin account found:');
    console.log('ID:', admin.id);
    console.log('Username:', admin.username);
    console.log('Role:', admin.role);
    console.log('Is Active:', admin.isActive);
    console.log('Password Hash:', admin.passwordHash);
    
    // Test password
    const isValid = await verifyPassword('admin123', admin.passwordHash);
    console.log('\nPassword "admin123" is valid:', isValid);
    
    // Try other common passwords
    const testPasswords = ['admin', 'password', '123456'];
    for (const pwd of testPasswords) {
      const valid = await verifyPassword(pwd, admin.passwordHash);
      console.log(`Password "${pwd}" is valid:`, valid);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminPassword();