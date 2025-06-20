import { TinkoffReceiptParserV3 } from './src/ocr/receiptParserV3';
import * as path from 'path';

async function debugParser() {
  const parser = new TinkoffReceiptParserV3();
  
  // Test on one specific receipt
  const testFile = 'data/receipts/receipt_2025-06-20T14-15-48_Receipt.pdf';
  const fullPath = path.join(process.cwd(), testFile);
  
  console.log(`🔍 Debugging parser V3 on: ${testFile}\n`);
  
  try {
    const result = await parser.parseReceiptPDF(fullPath);
    console.log('✅ Successfully parsed!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('❌ Parse error:', error.message);
    
    // Get the raw text to see what's happening
    if (parser.lastExtractedText) {
      console.log('\n📄 Raw text:');
      console.log('---');
      console.log(parser.lastExtractedText);
      console.log('---');
      
      // Try to parse just the text to see intermediate results
      console.log('\n🔧 Debugging parse process...');
      
      // Split lines and show them
      const lines = parser.lastExtractedText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      
      console.log('\n📋 Lines:');
      lines.forEach((line, i) => {
        console.log(`${i}: "${line}"`);
      });
      
      // Check what would be extracted
      console.log('\n🔍 Testing extractions:');
      
      // Test date extraction
      const dateMatch = lines[0].match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      console.log(`Date from line 0: ${dateMatch ? 'Found' : 'NOT FOUND'} - "${lines[0]}"`);
      
      // Look for amount
      const amountIdx = lines.findIndex(l => l === 'Сумма');
      console.log(`\nAmount label at index: ${amountIdx}`);
      if (amountIdx !== -1 && amountIdx + 1 < lines.length) {
        console.log(`Next line: "${lines[amountIdx + 1]}"`);
      }
      
      // Look for sender
      const senderIdx = lines.findIndex(l => l === 'Отправитель');
      console.log(`\nSender label at index: ${senderIdx}`);
      if (senderIdx !== -1 && senderIdx + 1 < lines.length) {
        console.log(`Next line: "${lines[senderIdx + 1]}"`);
      }
    }
  }
}

debugParser();