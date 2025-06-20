/**
 * Script to reparse a specific receipt
 */

import { PrismaClient } from "./generated/prisma";
import { getReceiptParsingService } from "./src/services/receiptParsingService";
import { createLogger } from "./src/logger";

const logger = createLogger('ReparseSpecificReceipt');
const prisma = new PrismaClient();

async function reparseReceipt() {
  try {
    // Find the receipt by file path
    const receipt = await prisma.receipt.findFirst({
      where: {
        filePath: {
          contains: 'receipt_2025-06-20T12-18-33_Receipt.pdf'
        }
      }
    });

    if (!receipt) {
      console.error("❌ Receipt not found");
      return;
    }

    console.log(`\n📄 Found receipt: ${receipt.id}`);
    console.log(`File: ${receipt.filePath}`);
    console.log(`\nCurrent data:`);
    console.log(`- Amount: ${receipt.amount}`);
    console.log(`- Sender: ${receipt.senderName}`);
    console.log(`- Recipient Name: ${receipt.recipientName}`);
    console.log(`- Recipient Phone: ${receipt.recipientPhone}`);

    // Reset the parsed flag to force reparsing
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { isParsed: false }
    });

    // Get the parsing service and parse this specific receipt
    const parsingService = getReceiptParsingService();
    const success = await parsingService.parseReceipt(receipt.id);

    if (success) {
      // Fetch updated receipt
      const updatedReceipt = await prisma.receipt.findUnique({
        where: { id: receipt.id }
      });

      console.log(`\n✅ Receipt reparsed successfully!`);
      console.log(`\nUpdated data:`);
      console.log(`- Amount: ${updatedReceipt?.amount}`);
      console.log(`- Sender: ${updatedReceipt?.senderName}`);
      console.log(`- Recipient Name: ${updatedReceipt?.recipientName}`);
      console.log(`- Recipient Phone: ${updatedReceipt?.recipientPhone}`);
      
      if (updatedReceipt?.recipientName === "Олег Ш.") {
        console.log("\n🎉 SUCCESS: Recipient name correctly updated to 'Олег Ш.'");
      }
    } else {
      console.error("❌ Failed to reparse receipt");
    }

  } catch (error) {
    logger.error("Error reparsing receipt", error as Error);
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
reparseReceipt().catch(console.error);