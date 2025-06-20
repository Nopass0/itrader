import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function forceLinkReceipts() {
  try {
    // Get unlinked receipts
    const unlinkedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: true,
        payoutId: null,
        amount: { not: null },
        parseError: null
      }
    });

    console.log(`
📋 Found ${unlinkedReceipts.length} unlinked receipts
`);

    for (const receipt of unlinkedReceipts) {
      console.log(`
📄 Receipt: ${receipt.filename}`);
      console.log(`  Amount: ${receipt.amount}`);
      console.log(`  Phone: ${receipt.recipientPhone}`);
      console.log(`  Name: ${receipt.recipientName}`);

      // Find best matching payout
      const payouts = await prisma.payout.findMany({
        where: {
          status: { in: [5, 6, 7] }
        }
      });

      // Find payouts with matching amount
      const matchingPayouts = payouts.filter(p => {
        const amountTrader = p.amountTrader as any;
        return amountTrader && amountTrader["643"] === receipt.amount;
      });

      if (matchingPayouts.length === 0) {
        console.log(`  ❌ No payouts with amount ${receipt.amount}`);
        continue;
      }

      // Check if any of them are not linked yet
      const unlinkedPayouts = [];
      for (const payout of matchingPayouts) {
        const existingReceipt = await prisma.receipt.findFirst({
          where: { payoutId: payout.id }
        });
        if (!existingReceipt) {
          unlinkedPayouts.push(payout);
        }
      }

      if (unlinkedPayouts.length === 0) {
        console.log(`  ⚠️ All payouts with amount ${receipt.amount} are already linked`);
        continue;
      }

      // Link to the first unlinked payout
      const payoutToLink = unlinkedPayouts[0];
      console.log(`  ✅ Linking to payout ${payoutToLink.id} (Gate: ${payoutToLink.gatePayoutId})`);

      // Update receipt
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          payoutId: payoutToLink.id,
          isProcessed: true,
          updatedAt: new Date()
        }
      });

      console.log(`  ✅ Receipt linked successfully\!`);

      // Try to approve through AssetReleaseService
      const transaction = await prisma.transaction.findFirst({
        where: { payoutId: payoutToLink.id }
      });

      if (transaction && payoutToLink.status === 5) {
        console.log(`  🔄 Attempting to approve transaction ${transaction.id}...`);
        
        try {
          const { getAssetReleaseService } = await import("./src/services/assetReleaseService");
          const assetReleaseService = getAssetReleaseService();
          
          const approved = await assetReleaseService.approveTransactionWithReceipt(
            transaction.id,
            payoutToLink.id,
            receipt.filePath || ""
          );

          if (approved) {
            console.log(`  ✅ Transaction approved\!`);
          } else {
            console.log(`  ⚠️ Failed to approve transaction`);
          }
        } catch (error) {
          console.log(`  ❌ Error approving:`, error);
        }
      }
    }

    // Show final status
    console.log("\n\n📊 Final status:");
    const allReceipts = await prisma.receipt.count();
    const linkedReceipts = await prisma.receipt.count({
      where: { payoutId: { not: null } }
    });
    console.log(`Total receipts: ${allReceipts}`);
    console.log(`Linked receipts: ${linkedReceipts}`);
    console.log(`Unlinked receipts: ${allReceipts - linkedReceipts}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

forceLinkReceipts();
