import { TinkoffReceiptParserV2 } from './src/ocr/receiptParserV2';
import { PrismaClient } from './generated/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function testUpdatedParser() {
  try {
    console.log('🔍 Testing Updated Receipt Parser V2\n');
    
    // Get all receipts from database
    const receipts = await prisma.receipt.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${receipts.length} receipts to test\n`);
    
    const parser = new TinkoffReceiptParserV2();
    let successCount = 0;
    let failureCount = 0;
    
    for (const receipt of receipts) {
      if (!receipt.filePath) continue;
      
      const fullPath = path.join(process.cwd(), receipt.filePath);
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        console.log(`❌ File not found: ${receipt.filename}`);
        continue;
      }
      
      console.log(`\n📄 Testing: ${receipt.filename}`);
      
      try {
        const parsedData = await parser.parseReceiptPDF(fullPath);
        successCount++;
        
        console.log('  ✅ Parsed successfully');
        console.log(`  💰 Amount: ${parsedData.amount}`);
        console.log(`  💰 Total: ${parsedData.total}`);
        console.log(`  👤 Sender: ${parsedData.senderName}`);
        console.log(`  📱 Recipient Phone: ${parsedData.recipientPhone || 'N/A'}`);
        console.log(`  👤 Recipient Name: ${parsedData.recipientName || 'N/A'}`);
        console.log(`  🏦 Recipient Bank: ${parsedData.recipientBank || 'N/A'}`);
        console.log(`  💳 Recipient Card: ${parsedData.recipientCard || 'N/A'}`);
        console.log(`  💸 Commission: ${parsedData.commission}`);
        console.log(`  🔄 Transfer Type: ${parsedData.transferType}`);
        console.log(`  ✅ Status: ${parsedData.status}`);
        
        // Check if we extracted more fields than before
        const fieldsExtracted = [
          parsedData.amount > 0,
          parsedData.total > 0,
          !!parsedData.senderName,
          !!parsedData.recipientPhone,
          !!parsedData.recipientName,
          !!parsedData.recipientBank,
          !!parsedData.recipientCard,
          parsedData.commission !== undefined,
          !!parsedData.transferType,
          !!parsedData.status,
          !!parsedData.operationId,
          !!parsedData.sbpCode
        ].filter(Boolean).length;
        
        console.log(`  📊 Fields extracted: ${fieldsExtracted}/12`);
        
        // Highlight receipts with decimal amounts
        if (parsedData.amount % 1 !== 0 || parsedData.total % 1 !== 0) {
          console.log(`  💫 Has decimal amount!`);
        }
        
      } catch (error: any) {
        failureCount++;
        console.log(`  ❌ Parse error: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY\n' + '='.repeat(50));
    console.log(`Total receipts tested: ${successCount + failureCount}`);
    console.log(`Success rate: ${successCount}/${successCount + failureCount} (${(successCount/(successCount + failureCount)*100).toFixed(1)}%)`);
    
    if (failureCount > 0) {
      console.log(`\n⚠️  Failed to parse ${failureCount} receipts`);
    } else {
      console.log(`\n✅ All receipts parsed successfully!`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUpdatedParser();