#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
import * as fs from 'fs/promises';

async function viewFailedReceipts() {
  const prisma = new PrismaClient();
  
  const failedReceipts = await prisma.receipt.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`❌ Found ${failedReceipts.length} failed receipts\n`);
  
  for (const receipt of failedReceipts) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Email ID: ${receipt.emailId}`);
    console.log(`Subject: ${receipt.emailSubject}`);
    console.log(`File: ${receipt.filePath}`);
    console.log(`Error: ${(receipt.parsedData as any).error}`);
    
    if (receipt.rawText) {
      console.log(`\nExtracted text preview:`);
      console.log(receipt.rawText.substring(0, 300) + '...');
    }
  }
  
  await prisma.$disconnect();
}

viewFailedReceipts().catch(console.error);