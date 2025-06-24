#!/usr/bin/env bun
import { PrismaClient } from "../generated/prisma";
import { config } from "dotenv";

// Load environment variables
config();

const prisma = new PrismaClient();

async function updateMailslurpApiKeys() {
  try {
    const apiKey = process.env.MAILSLURP_API_KEY;
    
    if (!apiKey) {
      console.error("MAILSLURP_API_KEY not found in environment variables");
      process.exit(1);
    }
    
    // Get all MailSlurp accounts without apiKey
    const accounts = await prisma.mailSlurpAccount.findMany({
      where: {
        apiKey: null
      }
    });
    
    console.log(`Found ${accounts.length} MailSlurp accounts without API key`);
    
    // Update each account with the API key
    for (const account of accounts) {
      await prisma.mailSlurpAccount.update({
        where: { id: account.id },
        data: { apiKey }
      });
      console.log(`Updated account ${account.email} with API key`);
    }
    
    console.log("All accounts updated successfully!");
    
  } catch (error) {
    console.error("Error updating MailSlurp accounts:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMailslurpApiKeys();