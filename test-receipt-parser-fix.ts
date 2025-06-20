/**
 * Test script to verify the receipt parser fix
 */

import { TinkoffReceiptParserV2 } from "./src/ocr/receiptParserV2";
import { createLogger } from "./src/logger";

const logger = createLogger('TestReceiptParserFix');

async function testReceiptParser() {
  try {
    const parser = new TinkoffReceiptParserV2();
    const receiptPath = 'data/receipts/receipt_2025-06-20T12-18-33_Receipt.pdf';
    
    logger.info("Testing receipt parser with", { receiptPath });
    console.log(`\n🔍 Testing receipt parser with: ${receiptPath}\n`);
    
    const result = await parser.parseReceiptPDF(receiptPath);
    
    console.log("📄 Parsed Receipt Data:");
    console.log("========================");
    console.log(`Amount: ${result.amount} ₽`);
    console.log(`Total: ${result.total} ₽`);
    console.log(`Transfer Type: ${result.transferType}`);
    console.log(`Status: ${result.status}`);
    console.log(`Sender Name: ${result.senderName}`);
    console.log(`Recipient Phone: ${result.recipientPhone}`);
    console.log(`Recipient Name: ${result.recipientName}`);
    console.log(`Receipt Number: ${result.receiptNumber}`);
    console.log(`Transaction Date: ${result.datetime}`);
    console.log("\n");
    
    // Check if the issue is fixed
    if (result.recipientName === "+7 (995) 188-80-89") {
      console.log("❌ ISSUE NOT FIXED: Recipient name still contains phone number");
    } else if (result.recipientName === "Олег Ш.") {
      console.log("✅ ISSUE FIXED: Recipient name correctly extracted as 'Олег Ш.'");
    } else {
      console.log(`⚠️  Recipient name extracted as: '${result.recipientName}'`);
    }
    
    // Show raw text structure
    console.log("\n📝 Raw Text Structure:");
    console.log("====================");
    const lines = result.rawText.split('\n').map(l => l.trim()).filter(l => l);
    lines.forEach((line, idx) => {
      console.log(`${idx.toString().padStart(3, '0')}: ${line}`);
    });
    
  } catch (error) {
    logger.error("Test failed", error as Error);
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testReceiptParser().catch(console.error);