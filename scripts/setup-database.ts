#!/usr/bin/env bun

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const databaseType = process.env.DATABASE_TYPE || 'sqlite';
const schemaPath = databaseType === 'postgres' 
  ? './prisma/schema.postgres.prisma' 
  : './prisma/schema.prisma';

console.log(`🔧 Setting up database with ${databaseType}...`);

// Copy the appropriate schema file
if (databaseType === 'postgres') {
  if (!fs.existsSync('./prisma/schema.postgres.prisma')) {
    console.error('❌ PostgreSQL schema file not found!');
    process.exit(1);
  }
  
  // Backup current schema if it exists
  if (fs.existsSync('./prisma/schema.prisma')) {
    fs.copyFileSync('./prisma/schema.prisma', './prisma/schema.sqlite.prisma');
  }
  
  // Use PostgreSQL schema
  fs.copyFileSync('./prisma/schema.postgres.prisma', './prisma/schema.prisma');
  console.log('✅ Using PostgreSQL schema');
} else {
  // If we have a backed up SQLite schema, restore it
  if (fs.existsSync('./prisma/schema.sqlite.prisma')) {
    fs.copyFileSync('./prisma/schema.sqlite.prisma', './prisma/schema.prisma');
    console.log('✅ Using SQLite schema');
  }
}

try {
  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('bunx prisma generate', { stdio: 'inherit' });
  
  // Run migrations
  console.log('🚀 Running database migrations...');
  execSync('bunx prisma migrate deploy', { stdio: 'inherit' });
  
  console.log(`✅ Database setup complete with ${databaseType}!`);
} catch (error) {
  console.error('❌ Database setup failed:', error);
  process.exit(1);
}