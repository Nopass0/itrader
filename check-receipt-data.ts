#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function checkReceiptData() {
  const receipts = await prisma.receipt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  for (const receipt of receipts) {
    console.log('\n=====================================');
    console.log('ID:', receipt.id);
    console.log('Amount:', receipt.amount, 'RUB');
    console.log('Transfer Type:', receipt.transferType);
    console.log('Sender Name:', receipt.senderName);
    console.log('Recipient Name:', receipt.recipientName);
    console.log('Recipient Phone:', receipt.recipientPhone);
    console.log('Recipient Card:', receipt.recipientCard);
    console.log('Recipient Bank:', receipt.recipientBank);
    console.log('\nRaw Text Preview:');
    if (receipt.rawText) {
      console.log(receipt.rawText.substring(0, 300) + '...');
    }
    console.log('\nParsed Data:', JSON.stringify(receipt.parsedData, null, 2));
  }
}

checkReceiptData()
  .then(() => prisma.$disconnect())
  .catch(console.error);