#!/usr/bin/env bun

import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function deleteReceipts() {
  // Delete all receipts
  const deleted = await prisma.receipt.deleteMany({});
  console.log(`Deleted ${deleted.count} receipts`);
}

deleteReceipts()
  .then(() => prisma.$disconnect())
  .catch(console.error);