#!/usr/bin/env bun
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';

console.log(chalk.cyan('╭───────────────────────────────────────────────────╮'));
console.log(chalk.cyan('│ 🤖 iTrader - Database Check                      │'));
console.log(chalk.cyan('│                                                   │'));
console.log(chalk.cyan('│   Checking database connection and migrations...  │'));
console.log(chalk.cyan('╰───────────────────────────────────────────────────╯'));

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error(chalk.red('Error: DATABASE_URL environment variable is not set.'));
  console.log(chalk.yellow('Please set the DATABASE_URL environment variable to connect to your PostgreSQL database.'));
  console.log(chalk.yellow('Example: DATABASE_URL=postgresql://username:password@localhost:5432/aitrader'));
  process.exit(1);
}

async function checkDatabase() {
  try {
    // Try to create a database connection
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log(chalk.green('✓ Successfully connected to the database.'));

    // Check if the database has been initialized
    try {
      // Try to query the admin table to see if it exists
      const adminCount = await prisma.admin.count();
      console.log(chalk.green(`✓ Database is initialized. Found ${adminCount} admin accounts.`));
      
      if (adminCount === 0) {
        console.log(chalk.yellow('! No admin accounts found. You should create one to start using the system.'));
      }
      
      await prisma.$disconnect();
    } catch (error) {
      // If the table doesn't exist, we need to run migrations
      console.log(chalk.yellow('! Database exists but tables are not set up.'));
      console.log(chalk.cyan('Running Prisma migrations...'));
      
      try {
        execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
        console.log(chalk.green('✓ Database migrations applied successfully.'));
        
        // Create a default admin account
        await prisma.admin.create({
          data: {
            username: 'admin',
            password: 'adminpassword', // This should be hashed in a real application
            token: Buffer.from(Math.random().toString(36)).toString('base64').substring(2, 15)
          }
        });
        
        console.log(chalk.green('✓ Default admin account created.'));
        console.log(chalk.cyan('Username: admin'));
        console.log(chalk.cyan('Password: adminpassword'));
        console.log(chalk.yellow('! Please change these credentials after first login!'));
        
        await prisma.$disconnect();
      } catch (migrationError) {
        console.error(chalk.red('Error running migrations:'), migrationError);
        process.exit(1);
      }
    }
  } catch (error) {
    // If the connection fails, try to create the database
    console.error(chalk.yellow('! Could not connect to database. It might not exist yet.'));
    
    try {
      // Extract database name from connection string
      const dbNameMatch = process.env.DATABASE_URL.match(/\/([^/]*)$/);
      if (!dbNameMatch) {
        throw new Error('Could not extract database name from DATABASE_URL');
      }
      
      const dbName = dbNameMatch[1].split('?')[0];
      
      // Create a new connection string for the postgres database to create our DB
      const rootConnectionString = process.env.DATABASE_URL.replace(dbName, 'postgres');
      
      console.log(chalk.cyan(`Attempting to create database "${dbName}"...`));
      
      // Create a new client to connect to the postgres database
      const rootPrisma = new PrismaClient({
        datasources: {
          db: {
            url: rootConnectionString,
          },
        },
      });
      
      // Create the database
      await rootPrisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
      await rootPrisma.$disconnect();
      
      console.log(chalk.green(`✓ Database "${dbName}" created successfully.`));
      console.log(chalk.cyan('Running Prisma migrations...'));
      
      // Run migrations
      execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
      console.log(chalk.green('✓ Database migrations applied successfully.'));
      
      // Create a default admin account
      const prisma = new PrismaClient();
      await prisma.admin.create({
        data: {
          username: 'admin',
          password: 'adminpassword', // This should be hashed in a real application
          token: Buffer.from(Math.random().toString(36)).toString('base64').substring(2, 15)
        }
      });
      
      console.log(chalk.green('✓ Default admin account created.'));
      console.log(chalk.cyan('Username: admin'));
      console.log(chalk.cyan('Password: adminpassword'));
      console.log(chalk.yellow('! Please change these credentials after first login!'));
      
      await prisma.$disconnect();
    } catch (createError) {
      console.error(chalk.red('Error creating database:'), createError);
      process.exit(1);
    }
  }
}

checkDatabase().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});