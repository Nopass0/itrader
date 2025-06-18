#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';

async function checkStats() {
  const prisma = new PrismaClient();
  
  const total = await prisma.receipt.count();
  const withPayout = await prisma.receipt.count({ where: { payoutId: { not: null } } });
  const failed = await prisma.receipt.count({ where: { status: "FAILED" } });
  const processed = await prisma.receipt.count({ where: { isProcessed: true } });
  const success = await prisma.receipt.count({ where: { status: "SUCCESS" } });
  
  console.log(`📊 Receipt Statistics:`);
  console.log(`  Total receipts: ${total}`);
  console.log(`  Successfully parsed: ${success}`);
  console.log(`  Failed to parse: ${failed}`);
  console.log(`  With payout link: ${withPayout}`);
  console.log(`  Marked as processed: ${processed}`);
  
  // Show some failed receipts
  if (failed > 0) {
    console.log(`\n❌ Failed receipts:`);
    const failedReceipts = await prisma.receipt.findMany({
      where: { status: "FAILED" },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    for (const receipt of failedReceipts) {
      console.log(`\n  Email: ${receipt.emailId}`);
      console.log(`  Subject: ${receipt.emailSubject}`);
      console.log(`  Error: ${JSON.stringify(receipt.parsedData)}`);
    }
  }
  
  await prisma.$disconnect();
}

checkStats().catch(console.error);