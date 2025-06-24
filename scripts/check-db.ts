#!/usr/bin/env bun

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database contents...\n');
    
    // Check SystemAccount table
    console.log('📋 SystemAccount table:');
    const systemAccounts = await prisma.systemAccount.findMany();
    if (systemAccounts.length === 0) {
      console.log('  ❌ No accounts found');
    } else {
      systemAccounts.forEach(account => {
        console.log(`  • ${account.username} (${account.role}) - Active: ${account.isActive}`);
      });
    }
    
    // Check AuthToken table
    console.log('\n🔑 AuthToken table:');
    const authTokens = await prisma.authToken.findMany();
    console.log(`  • Total tokens: ${authTokens.length}`);
    
    // Check WebServerUser table (old table)
    console.log('\n👤 WebServerUser table (legacy):');
    const webServerUsers = await prisma.webServerUser.findMany();
    if (webServerUsers.length === 0) {
      console.log('  ❌ No users found');
    } else {
      webServerUsers.forEach(user => {
        console.log(`  • ${user.username} (${user.role}) - Active: ${user.isActive}`);
      });
    }
    
    // Database file info
    console.log('\n📁 Database info:');
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/database.db';
    console.log(`  • Path: ${dbPath}`);
    
    // Try to create a test account to verify write access
    console.log('\n🧪 Testing write access...');
    const testAccount = await prisma.systemAccount.create({
      data: {
        username: `test_${Date.now()}`,
        passwordHash: 'test_hash',
        role: 'viewer',
        isActive: false
      }
    });
    console.log(`  ✅ Successfully created test account: ${testAccount.username}`);
    
    // Clean up test account
    await prisma.systemAccount.delete({
      where: { id: testAccount.id }
    });
    console.log('  ✅ Successfully deleted test account');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();