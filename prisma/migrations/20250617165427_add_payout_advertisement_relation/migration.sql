/*
  Warnings:

  - You are about to drop the column `transactionId` on the `Payout` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bybitAdId" TEXT,
    "bybitAccountId" TEXT NOT NULL,
    "payoutId" TEXT,
    "type" TEXT,
    "currency" TEXT,
    "fiat" TEXT,
    "price" TEXT,
    "minAmount" REAL,
    "maxAmount" REAL,
    "paymentMethods" JSONB,
    "description" TEXT,
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "side" TEXT,
    "asset" TEXT,
    "fiatCurrency" TEXT,
    "quantity" TEXT,
    "minOrderAmount" TEXT,
    "maxOrderAmount" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT,
    CONSTRAINT "Advertisement_bybitAccountId_fkey" FOREIGN KEY ("bybitAccountId") REFERENCES "BybitAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Advertisement" ("asset", "autoReply", "autoReplyMessage", "bybitAccountId", "bybitAdId", "createdAt", "currency", "description", "fiat", "fiatCurrency", "id", "isActive", "maxAmount", "maxOrderAmount", "minAmount", "minOrderAmount", "paymentMethod", "paymentMethods", "price", "quantity", "side", "status", "type", "updatedAt") SELECT "asset", "autoReply", "autoReplyMessage", "bybitAccountId", "bybitAdId", "createdAt", "currency", "description", "fiat", "fiatCurrency", "id", "isActive", "maxAmount", "maxOrderAmount", "minAmount", "minOrderAmount", "paymentMethod", "paymentMethods", "price", "quantity", "side", "status", "type", "updatedAt" FROM "Advertisement";
DROP TABLE "Advertisement";
ALTER TABLE "new_Advertisement" RENAME TO "Advertisement";
CREATE UNIQUE INDEX "Advertisement_bybitAdId_key" ON "Advertisement"("bybitAdId");
CREATE UNIQUE INDEX "Advertisement_payoutId_key" ON "Advertisement"("payoutId");
CREATE INDEX "Advertisement_bybitAccountId_idx" ON "Advertisement"("bybitAccountId");
CREATE INDEX "Advertisement_isActive_idx" ON "Advertisement"("isActive");
CREATE INDEX "Advertisement_payoutId_idx" ON "Advertisement"("payoutId");
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
    CONSTRAINT "Payout_gateAccountId_fkey" FOREIGN KEY ("gateAccountId") REFERENCES "GateAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payout" ("amount", "amountTrader", "approvedAt", "attachments", "bank", "completedAt", "createdAt", "description", "expiredAt", "failureReason", "gateAccount", "gateAccountId", "gatePayoutId", "id", "meta", "method", "paymentMethodId", "recipientCard", "recipientName", "status", "tooltip", "totalTrader", "trader", "updatedAt", "wallet") SELECT "amount", "amountTrader", "approvedAt", "attachments", "bank", "completedAt", "createdAt", "description", "expiredAt", "failureReason", "gateAccount", "gateAccountId", "gatePayoutId", "id", "meta", "method", "paymentMethodId", "recipientCard", "recipientName", "status", "tooltip", "totalTrader", "trader", "updatedAt", "wallet" FROM "Payout";
DROP TABLE "Payout";
ALTER TABLE "new_Payout" RENAME TO "Payout";
CREATE UNIQUE INDEX "Payout_gatePayoutId_key" ON "Payout"("gatePayoutId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");
CREATE INDEX "Payout_gateAccount_idx" ON "Payout"("gateAccount");
CREATE INDEX "Payout_gateAccountId_idx" ON "Payout"("gateAccountId");
CREATE INDEX "Payout_gatePayoutId_idx" ON "Payout"("gatePayoutId");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payoutId" TEXT,
    "advertisementId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "counterpartyName" TEXT,
    "status" TEXT NOT NULL,
    "chatStep" INTEGER NOT NULL DEFAULT 0,
    "paymentSentAt" DATETIME,
    "checkReceivedAt" DATETIME,
    "receiptReceivedAt" DATETIME,
    "completedAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("advertisementId", "amount", "chatStep", "checkReceivedAt", "completedAt", "counterpartyName", "createdAt", "failureReason", "id", "orderId", "paymentSentAt", "payoutId", "receiptReceivedAt", "status", "updatedAt") SELECT "advertisementId", "amount", "chatStep", "checkReceivedAt", "completedAt", "counterpartyName", "createdAt", "failureReason", "id", "orderId", "paymentSentAt", "payoutId", "receiptReceivedAt", "status", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_payoutId_key" ON "Transaction"("payoutId");
CREATE UNIQUE INDEX "Transaction_advertisementId_key" ON "Transaction"("advertisementId");
CREATE UNIQUE INDEX "Transaction_orderId_key" ON "Transaction"("orderId");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
