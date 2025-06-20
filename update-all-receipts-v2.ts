import { TinkoffReceiptParserV2 } from './src/ocr/receiptParserV2';
import { PrismaClient } from './generated/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function updateAllReceipts() {
  try {
    console.log('🔄 Updating all receipts with improved V2 parser\n');
    
    // Get all receipts from database
    const receipts = await prisma.receipt.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${receipts.length} receipts to update\n`);
    
    const parser = new TinkoffReceiptParserV2();
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const receipt of receipts) {
      if (!receipt.filePath) {
        console.log(`⚠️  Skipping ${receipt.filename} - no file path`);
        skippedCount++;
        continue;
      }
      
      const fullPath = path.join(process.cwd(), receipt.filePath);
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        console.log(`⚠️  Skipping ${receipt.filename} - file not found`);
        skippedCount++;
        continue;
      }
      
      console.log(`\n📄 Updating: ${receipt.filename}`);
      
      try {
        const parsedData = await parser.parseReceiptPDF(fullPath);
        
        // Update receipt in database
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            amount: parsedData.amount,
            recipientName: parsedData.recipientName || null,
            recipientPhone: parsedData.recipientPhone || null,
            recipientBank: parsedData.recipientBank || null,
            recipientCard: parsedData.recipientCard || null,
            parsedData: parsedData as any,
            parseError: null,
            isParsed: true,
            updatedAt: new Date()
          }
        });
        
        updatedCount++;
        console.log('  ✅ Updated successfully');
        
        // Show what was updated
        const updates = [];
        if (parsedData.amount !== receipt.amount) {
          updates.push(`amount: ${receipt.amount} → ${parsedData.amount}`);
        }
        if (parsedData.recipientName && parsedData.recipientName !== receipt.recipientName) {
          updates.push(`name: ${receipt.recipientName || 'null'} → ${parsedData.recipientName}`);
        }
        if (parsedData.recipientPhone && parsedData.recipientPhone !== receipt.recipientPhone) {
          updates.push(`phone: ${receipt.recipientPhone || 'null'} → ${parsedData.recipientPhone}`);
        }
        if (parsedData.recipientBank && parsedData.recipientBank !== receipt.recipientBank) {
          updates.push(`bank: ${receipt.recipientBank || 'null'} → ${parsedData.recipientBank}`);
        }
        if (parsedData.recipientCard && parsedData.recipientCard !== receipt.recipientCard) {
          updates.push(`card: ${receipt.recipientCard || 'null'} → ${parsedData.recipientCard}`);
        }
        
        if (updates.length > 0) {
          console.log('  📝 Changes:');
          updates.forEach(u => console.log(`     - ${u}`));
        }
        
      } catch (error: any) {
        errorCount++;
        console.log(`  ❌ Parse error: ${error.message}`);
        
        // Update receipt with error
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            parseError: error.message,
            updatedAt: new Date()
          }
        });
      }
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY\n' + '='.repeat(50));
    console.log(`Total receipts: ${receipts.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Show final state
    const finalReceipts = await prisma.receipt.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\n📊 Final receipt status:');
    for (const receipt of finalReceipts) {
      const status = receipt.parseError ? '❌' : 
                    receipt.recipientPhone && receipt.recipientBank ? '✅' : '⚠️';
      console.log(`${status} ${receipt.filename}`);
      if (receipt.payoutId) {
        console.log(`   💰 Linked to payout: ${receipt.payoutId}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllReceipts();