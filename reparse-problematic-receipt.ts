import { PrismaClient } from './generated/prisma';
import { getReceiptParsingService } from './src/services/receiptParsingService';

const prisma = new PrismaClient();

async function reparse() {
  const receipt = await prisma.receipt.findFirst({
    where: { filePath: { contains: 'receipt_2025-06-19T19-41-43_Receipt.pdf' } }
  });
  
  if (!receipt) {
    console.error('Receipt not found');
    return;
  }
  
  console.log('Found receipt:', receipt.id);
  console.log('Current data - recipientName:', receipt.recipientName);
  
  await prisma.receipt.update({
    where: { id: receipt.id },
    data: { isParsed: false }
  });
  
  const service = getReceiptParsingService();
  const success = await service.parseReceipt(receipt.id);
  
  if (success) {
    const updated = await prisma.receipt.findUnique({ where: { id: receipt.id } });
    console.log('✅ Reparsed successfully!');
    console.log('New data - recipientName:', updated?.recipientName);
    console.log('New data - senderName:', updated?.senderName);
  } else {
    console.error('Failed to reparse');
  }
  
  await prisma.$disconnect();
}

reparse();