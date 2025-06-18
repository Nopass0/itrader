#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
import { TinkoffReceiptParser } from './src/ocr/receiptParser';
import * as fs from 'fs/promises';

async function reparseFailedReceipts() {
  const prisma = new PrismaClient();
  const parser = new TinkoffReceiptParser();
  
  const failedReceipts = await prisma.receipt.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`🔄 Re-parsing ${failedReceipts.length} failed receipts\n`);
  
  let successCount = 0;
  let stillFailedCount = 0;
  
  for (const receipt of failedReceipts) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing: ${receipt.emailSubject}`);
    
    try {
      // Read the PDF file
      const pdfBuffer = await fs.readFile(receipt.filePath);
      
      // Try to parse again
      const parsedReceipt = await parser.parseFromBuffer(pdfBuffer);
      
      if (parsedReceipt) {
        console.log(`✅ Successfully parsed!`);
        console.log(`   Amount: ${parsedReceipt.amount} RUB`);
        console.log(`   Sender: ${parsedReceipt.sender}`);
        console.log(`   Date: ${parsedReceipt.datetime.toLocaleString()}`);
        
        // Update the receipt in database
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            amount: parsedReceipt.amount,
            status: parsedReceipt.status,
            senderName: parsedReceipt.sender,
            transferType: parsedReceipt.transferType,
            transactionDate: parsedReceipt.datetime,
            recipientName: 'recipientName' in parsedReceipt ? parsedReceipt.recipientName : null,
            recipientPhone: 'recipientPhone' in parsedReceipt ? parsedReceipt.recipientPhone : null,
            recipientCard: parsedReceipt.recipientCard || null,
            recipientBank: 'recipientBank' in parsedReceipt ? parsedReceipt.recipientBank : null,
            commission: parsedReceipt.commission || null,
            parsedData: parsedReceipt as any,
            rawText: parser.lastExtractedText || null,
            reference: `${parsedReceipt.sender} -> ${
              'recipientName' in parsedReceipt ? parsedReceipt.recipientName :
              'recipientPhone' in parsedReceipt ? parsedReceipt.recipientPhone :
              parsedReceipt.recipientCard
            }`
          }
        });
        
        successCount++;
      }
    } catch (error) {
      console.log(`❌ Still failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      stillFailedCount++;
    }
  }
  
  console.log(`\n📊 Re-parsing results:`);
  console.log(`   Successfully re-parsed: ${successCount}`);
  console.log(`   Still failed: ${stillFailedCount}`);
  
  await prisma.$disconnect();
}

reparseFailedReceipts().catch(console.error);