/**
 * Script to analyze how a specific receipt was parsed
 * This script will:
 * 1. Find the receipt in the database
 * 2. Show all parsed fields
 * 3. Show the raw OCR text
 * 4. Use parseReceiptText to see how it parses
 * 5. Identify parsing issues
 */

import { PrismaClient } from './generated/prisma';
import * as path from 'path';
import { TinkoffReceiptParserV2 } from './src/ocr/receiptParserV2';
import { createLogger } from './src/logger';

const logger = createLogger('AnalyzeReceiptParsing');
const prisma = new PrismaClient();

// The receipt we want to analyze
const RECEIPT_FILE = 'receipt_2025-06-20T14-15-48_Receipt.pdf';
const RECEIPT_PATH = path.join('/home/user/projects/itrader_project/data/receipts', RECEIPT_FILE);

async function analyzeReceipt() {
  try {
    logger.info('Starting receipt analysis', { receiptFile: RECEIPT_FILE });

    // 1. Find the receipt in the database
    const receipt = await prisma.receipt.findFirst({
      where: {
        OR: [
          { filePath: { contains: RECEIPT_FILE } },
          { filename: RECEIPT_FILE },
          { attachmentName: RECEIPT_FILE }
        ]
      }
    });

    if (!receipt) {
      logger.error('Receipt not found in database', { receiptFile: RECEIPT_FILE });
      return;
    }

    logger.info('Receipt found in database', { receiptId: receipt.id });

    // 2. Show all parsed fields
    console.log('\n==== RECEIPT DATA FROM DATABASE ====');
    console.log('ID:', receipt.id);
    console.log('File Path:', receipt.filePath);
    console.log('Attachment Name:', receipt.attachmentName);
    console.log('\n--- Parsed Fields ---');
    console.log('Amount:', receipt.amount);
    console.log('Recipient Name:', receipt.recipientName);
    console.log('Recipient Phone:', receipt.recipientPhone);
    console.log('Recipient Card:', receipt.recipientCard);
    console.log('Recipient Bank:', receipt.recipientBank);
    console.log('Sender Name:', receipt.senderName);
    console.log('Sender Account:', receipt.senderAccount);
    console.log('Transfer Type:', receipt.transferType);
    console.log('Status:', receipt.status);
    console.log('Commission:', receipt.commission);
    console.log('Total:', receipt.total);
    console.log('Transaction Date:', receipt.transactionDate);
    console.log('Is Parsed:', receipt.isParsed);
    console.log('Parse Error:', receipt.parseError);

    // 3. Show the raw OCR text
    console.log('\n==== RAW OCR TEXT ====');
    if (receipt.rawText) {
      console.log(receipt.rawText);
    } else {
      console.log('No raw text stored in database');
    }

    // 4. Parse the receipt again using the V2 parser
    console.log('\n==== RE-PARSING WITH V2 PARSER ====');
    const parser = new TinkoffReceiptParserV2();
    
    try {
      const parsedData = await parser.parseReceiptPDF(RECEIPT_PATH);
      
      console.log('\n--- Re-parsed Data ---');
      console.log('Amount:', parsedData.amount);
      console.log('Sender Name:', parsedData.senderName);
      console.log('Recipient Name:', parsedData.recipientName);
      console.log('Recipient Phone:', parsedData.recipientPhone);
      console.log('Recipient Card:', parsedData.recipientCard);
      console.log('Recipient Bank:', parsedData.recipientBank);
      console.log('Sender Account:', parsedData.senderAccount);
      console.log('Transfer Type:', parsedData.transferType);
      console.log('Status:', parsedData.status);
      console.log('Commission:', parsedData.commission);
      console.log('Total:', parsedData.total);
      console.log('Operation ID:', parsedData.operationId);
      console.log('SBP Code:', parsedData.sbpCode);
      console.log('Receipt Number:', parsedData.receiptNumber);

      // Show the extracted text for debugging
      console.log('\n==== EXTRACTED TEXT FROM PDF ====');
      console.log(parser.lastExtractedText);

      // 5. Compare and identify issues
      console.log('\n==== PARSING ISSUES ====');
      const issues = [];

      if (receipt.amount !== parsedData.amount) {
        issues.push(`Amount mismatch: DB=${receipt.amount}, Parser=${parsedData.amount}`);
      }
      
      if (receipt.recipientName !== parsedData.recipientName) {
        issues.push(`Recipient name mismatch: DB="${receipt.recipientName}", Parser="${parsedData.recipientName}"`);
      }

      if (receipt.recipientPhone !== parsedData.recipientPhone) {
        issues.push(`Recipient phone mismatch: DB="${receipt.recipientPhone}", Parser="${parsedData.recipientPhone}"`);
      }

      if (receipt.recipientCard !== parsedData.recipientCard) {
        issues.push(`Recipient card mismatch: DB="${receipt.recipientCard}", Parser="${parsedData.recipientCard}"`);
      }

      if (issues.length === 0) {
        console.log('No parsing issues found - data matches!');
      } else {
        console.log('Found issues:');
        issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
      }

      // Check if raw text in DB matches extracted text
      if (receipt.rawText !== parser.lastExtractedText) {
        console.log('\n⚠️  Raw text in database differs from freshly extracted text!');
        console.log('This might indicate the PDF was processed with different extraction settings.');
      }

    } catch (parseError) {
      console.error('\n❌ Parser error:', parseError.message);
      logger.error('Failed to re-parse receipt', { error: parseError });
    }

    // Show parsed data if stored
    if (receipt.parsedData) {
      console.log('\n==== STORED PARSED DATA (JSON) ====');
      console.log(JSON.stringify(receipt.parsedData, null, 2));
    }

  } catch (error) {
    logger.error('Error analyzing receipt', { error });
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeReceipt().catch(console.error);