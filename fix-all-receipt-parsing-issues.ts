/**
 * Script to detect and fix all receipt parsing issues
 */

import { PrismaClient } from "./generated/prisma";
import { getReceiptParsingService } from "./src/services/receiptParsingService";
import { createLogger } from "./src/logger";

const logger = createLogger('FixReceiptParsingIssues');
const prisma = new PrismaClient();

async function fixParsingIssues() {
  try {
    console.log("\n🔍 Detecting receipts with parsing issues...\n");

    // Find receipts with potential parsing issues
    const problematicReceipts = await prisma.receipt.findMany({
      where: {
        OR: [
          // Phone number in recipientName
          { recipientName: { startsWith: '+7' } },
          // Known parsing errors
          { recipientName: { in: ['Без комиссии', 'Комиссия', 'Отправитель', 'Получатель', 'Телефон получателя'] } },
          // Bank name instead of person name (for phone transfers)
          {
            AND: [
              { transferType: 'По номеру телефона' },
              { recipientName: { in: ['Сбербанк', 'ВТБ', 'Альфа-Банк', 'Тинькофф'] } }
            ]
          }
        ]
      }
    });

    console.log(`Found ${problematicReceipts.length} receipts with potential parsing issues:\n`);

    for (const receipt of problematicReceipts) {
      console.log(`📄 Receipt: ${receipt.filePath}`);
      console.log(`   Current recipientName: "${receipt.recipientName}"`);
      console.log(`   Transfer type: ${receipt.transferType}`);
      
      // Reset parsed flag
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { isParsed: false }
      });

      // Reparse
      const parsingService = getReceiptParsingService();
      const success = await parsingService.parseReceipt(receipt.id);

      if (success) {
        const updated = await prisma.receipt.findUnique({
          where: { id: receipt.id }
        });
        console.log(`   ✅ Reparsed successfully`);
        console.log(`   New recipientName: "${updated?.recipientName}"`);
      } else {
        console.log(`   ❌ Failed to reparse`);
      }
      console.log("");
    }

    // Also check for receipts that might not have been parsed at all
    const unparsedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: false
      }
    });

    if (unparsedReceipts.length > 0) {
      console.log(`\n📋 Found ${unparsedReceipts.length} unparsed receipts. Parsing them now...\n`);
      
      const parsingService = getReceiptParsingService();
      const stats = await parsingService.parseUnparsedReceipts();
      
      console.log(`\n📊 Parsing completed:`);
      console.log(`   Total: ${stats.total}`);
      console.log(`   Parsed: ${stats.parsed}`);
      console.log(`   Failed: ${stats.failed}`);
      console.log(`   Skipped: ${stats.skipped}`);
    }

    console.log("\n✅ All done!");

  } catch (error) {
    logger.error("Error fixing parsing issues", error as Error);
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixParsingIssues().catch(console.error);