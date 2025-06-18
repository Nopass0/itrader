/*
  Warnings:

  - You are about to alter the column `status` on the `Payout` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "emailFrom" TEXT NOT NULL,
    "emailSubject" TEXT,
    "attachmentName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT,
    "amount" REAL NOT NULL,
    "bank" TEXT NOT NULL,
    "reference" TEXT,
    "transferType" TEXT,
    "status" TEXT NOT NULL,
    "senderName" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientCard" TEXT,
    "recipientBank" TEXT,
    "commission" REAL,
    "transactionDate" DATETIME NOT NULL,
    "parsedData" JSONB NOT NULL,
    "rawText" TEXT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "payoutId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gatePayoutId" INTEGER,
    "paymentMethodId" INTEGER,
    "wallet" TEXT,
    "amountTrader" JSONB,
    "totalTrader" JSONB,
    "status" INTEGER NOT NULL,
    "approvedAt" DATETIME,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "meta" JSONB,
    "method" JSONB,
    "attachments" JSONB,
    "tooltip" JSONB,
    "bank" JSONB,
    "trader" JSONB,
    "gateAccount" TEXT,
    "gateAccountId" TEXT,
    "amount" REAL,
    "recipientCard" TEXT,
    "recipientName" TEXT,
    "description" TEXT,
    "failureReason" TEXT,
    "completedAt" DATETIME,
    "transactionId" TEXT,
    CONSTRAINT "Payout_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payout_gateAccountId_fkey" FOREIGN KEY ("gateAccountId") REFERENCES "GateAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payout" ("amount", "amountTrader", "attachments", "bank", "completedAt", "createdAt", "description", "failureReason", "gateAccountId", "gatePayoutId", "id", "meta", "method", "paymentMethodId", "recipientCard", "recipientName", "status", "tooltip", "totalTrader", "trader", "transactionId", "updatedAt", "wallet") SELECT "amount", "amountTrader", "attachments", "bank", "completedAt", "createdAt", "description", "failureReason", "gateAccountId", "gatePayoutId", "id", "meta", "method", "paymentMethodId", "recipientCard", "recipientName", "status", "tooltip", "totalTrader", "trader", "transactionId", "updatedAt", "wallet" FROM "Payout";
DROP TABLE "Payout";
ALTER TABLE "new_Payout" RENAME TO "Payout";
CREATE UNIQUE INDEX "Payout_gatePayoutId_key" ON "Payout"("gatePayoutId");
CREATE UNIQUE INDEX "Payout_transactionId_key" ON "Payout"("transactionId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");
CREATE INDEX "Payout_gateAccount_idx" ON "Payout"("gateAccount");
CREATE INDEX "Payout_gateAccountId_idx" ON "Payout"("gateAccountId");
CREATE INDEX "Payout_gatePayoutId_idx" ON "Payout"("gatePayoutId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_emailId_key" ON "Receipt"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_fileHash_key" ON "Receipt"("fileHash");

-- CreateIndex
CREATE INDEX "Receipt_emailId_idx" ON "Receipt"("emailId");

-- CreateIndex
CREATE INDEX "Receipt_fileHash_idx" ON "Receipt"("fileHash");

-- CreateIndex
CREATE INDEX "Receipt_amount_idx" ON "Receipt"("amount");

-- CreateIndex
CREATE INDEX "Receipt_bank_idx" ON "Receipt"("bank");

-- CreateIndex
CREATE INDEX "Receipt_transactionDate_idx" ON "Receipt"("transactionDate");

-- CreateIndex
CREATE INDEX "Receipt_isProcessed_idx" ON "Receipt"("isProcessed");

-- CreateIndex
CREATE INDEX "Receipt_payoutId_idx" ON "Receipt"("payoutId");
