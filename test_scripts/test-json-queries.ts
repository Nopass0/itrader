/**
 * Test script to verify JSON field queries work correctly after the fix
 */

import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function testJsonQueries() {
  console.log("Testing JSON field queries with SQLite...\n");

  try {
    // 1. Test fetching all payouts (no JSON filtering)
    console.log("1. Fetching all payouts...");
    const allPayouts = await prisma.payout.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    console.log(`Found ${allPayouts.length} payouts`);

    // 2. Test filtering by amount field (regular field)
    console.log("\n2. Testing regular field filtering...");
    const payoutsWithAmount = await prisma.payout.findMany({
      where: { amount: { not: null } },
      take: 5,
    });
    console.log(`Found ${payoutsWithAmount.length} payouts with amount field`);

    // 3. Test fetching payouts with amountTrader JSON field
    console.log("\n3. Fetching payouts with amountTrader field...");
    const payoutsWithAmountTrader = await prisma.payout.findMany({
      where: { amountTrader: { not: null } },
      take: 5,
    });
    console.log(`Found ${payoutsWithAmountTrader.length} payouts with amountTrader`);

    // 4. Demonstrate application-level JSON filtering
    console.log("\n4. Testing application-level JSON filtering...");
    const targetAmount = 1000; // Example amount
    const filteredPayouts = payoutsWithAmountTrader.filter((payout) => {
      if (payout.amountTrader && typeof payout.amountTrader === "object") {
        const amountTrader = payout.amountTrader as any;
        return amountTrader["643"] === targetAmount;
      }
      return false;
    });
    console.log(`Found ${filteredPayouts.length} payouts with amountTrader['643'] = ${targetAmount}`);

    // 5. Test complex query without JSON path filtering
    console.log("\n5. Testing complex query (no JSON path filtering)...");
    const complexQuery = await prisma.payout.findMany({
      where: {
        AND: [
          { status: 1 },
          { wallet: { contains: "9" } },
          { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
      take: 5,
    });
    console.log(`Found ${complexQuery.length} payouts with complex query`);

    // 6. Show example of how to handle JSON fields in application code
    console.log("\n6. Example of JSON field handling:");
    if (payoutsWithAmountTrader.length > 0) {
      const examplePayout = payoutsWithAmountTrader[0];
      console.log("Payout ID:", examplePayout.id);
      console.log("Amount field:", examplePayout.amount);
      console.log("AmountTrader JSON:", JSON.stringify(examplePayout.amountTrader, null, 2));
      
      if (examplePayout.amountTrader && typeof examplePayout.amountTrader === "object") {
        const amountTrader = examplePayout.amountTrader as any;
        console.log("RUB amount (643):", amountTrader["643"]);
      }
    }

    console.log("\n✅ All tests completed successfully!");
    console.log("\nKey takeaways:");
    console.log("- SQLite doesn't support JSON path queries in Prisma");
    console.log("- Fetch data first, then filter JSON fields in application code");
    console.log("- Use regular field queries where possible to reduce data transfer");

  } catch (error) {
    console.error("❌ Error during testing:", error);
    if (error instanceof Error && error.message.includes("path")) {
      console.error("\nThis error suggests JSON path queries are still being used somewhere.");
      console.error("Make sure to remove all queries with pattern: { jsonField: { path: [...], equals: ... } }");
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testJsonQueries().catch(console.error);