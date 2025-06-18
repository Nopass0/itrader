-- CreateTable
CREATE TABLE "TinkoffReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pdfHash" TEXT NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "transferDate" DATETIME NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionNumber" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "transactionId" TEXT,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TinkoffReceipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TinkoffReceipt_pdfHash_key" ON "TinkoffReceipt"("pdfHash");

-- CreateIndex
CREATE UNIQUE INDEX "TinkoffReceipt_transactionId_key" ON "TinkoffReceipt"("transactionId");

-- CreateIndex
CREATE INDEX "TinkoffReceipt_status_idx" ON "TinkoffReceipt"("status");

-- CreateIndex
CREATE INDEX "TinkoffReceipt_pdfHash_idx" ON "TinkoffReceipt"("pdfHash");

-- CreateIndex
CREATE INDEX "TinkoffReceipt_amount_idx" ON "TinkoffReceipt"("amount");

-- CreateIndex
CREATE INDEX "TinkoffReceipt_recipientWallet_idx" ON "TinkoffReceipt"("recipientWallet");

-- CreateIndex
CREATE INDEX "TinkoffReceipt_transferDate_idx" ON "TinkoffReceipt"("transferDate");

-- CreateIndex
CREATE INDEX "TinkoffReceipt_transactionId_idx" ON "TinkoffReceipt"("transactionId");
