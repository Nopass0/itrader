-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gatePayoutId" INTEGER,
    "gateAccountId" TEXT,
    "amount" REAL NOT NULL,
    "recipientCard" TEXT NOT NULL,
    "recipientName" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "completedAt" DATETIME,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paymentMethodId" INTEGER,
    "wallet" TEXT,
    "amountTrader" JSONB,
    "totalTrader" JSONB,
    "meta" JSONB,
    "method" JSONB,
    "attachments" JSONB,
    "tooltip" JSONB,
    "bank" JSONB,
    "trader" JSONB,
    CONSTRAINT "Payout_gateAccountId_fkey" FOREIGN KEY ("gateAccountId") REFERENCES "GateAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payout_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bybitAdId" TEXT,
    "bybitAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "fiat" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "minAmount" REAL NOT NULL,
    "maxAmount" REAL NOT NULL,
    "paymentMethods" JSONB NOT NULL,
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
    CONSTRAINT "Advertisement_bybitAccountId_fkey" FOREIGN KEY ("bybitAccountId") REFERENCES "BybitAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
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
    "completedAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "messageId" TEXT,
    "sender" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "isAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "sentAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT,
    CONSTRAINT "ChatMessage_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GateAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT DEFAULT '',
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BybitAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeAdsCount" INTEGER NOT NULL DEFAULT 0,
    "lastSync" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BlacklistedTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payoutId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "wallet" TEXT,
    "amount" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SystemAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SystemAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "groupId" TEXT,
    "customReactions" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatTemplate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ResponseGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResponseGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TemplateUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "context" TEXT,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateUsage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChatTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExchangeRateHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_gatePayoutId_key" ON "Payout"("gatePayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_transactionId_key" ON "Payout"("transactionId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_gateAccountId_idx" ON "Payout"("gateAccountId");

-- CreateIndex
CREATE INDEX "Payout_gatePayoutId_idx" ON "Payout"("gatePayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertisement_bybitAdId_key" ON "Advertisement"("bybitAdId");

-- CreateIndex
CREATE INDEX "Advertisement_bybitAccountId_idx" ON "Advertisement"("bybitAccountId");

-- CreateIndex
CREATE INDEX "Advertisement_isActive_idx" ON "Advertisement"("isActive");

-- CreateIndex
CREATE INDEX "Advertisement_type_idx" ON "Advertisement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_payoutId_key" ON "Transaction"("payoutId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");

-- CreateIndex
CREATE INDEX "ChatMessage_transactionId_idx" ON "ChatMessage"("transactionId");

-- CreateIndex
CREATE INDEX "ChatMessage_isProcessed_idx" ON "ChatMessage"("isProcessed");

-- CreateIndex
CREATE INDEX "ChatMessage_sender_idx" ON "ChatMessage"("sender");

-- CreateIndex
CREATE UNIQUE INDEX "GateAccount_accountId_key" ON "GateAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "BybitAccount_accountId_key" ON "BybitAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_email_key" ON "GmailAccount"("email");

-- CreateIndex
CREATE INDEX "BlacklistedTransaction_wallet_idx" ON "BlacklistedTransaction"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEmail_emailId_key" ON "ProcessedEmail"("emailId");

-- CreateIndex
CREATE INDEX "ProcessedEmail_processedAt_idx" ON "ProcessedEmail"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemAccount_username_key" ON "SystemAccount"("username");

-- CreateIndex
CREATE INDEX "SystemAccount_username_idx" ON "SystemAccount"("username");

-- CreateIndex
CREATE INDEX "SystemAccount_role_idx" ON "SystemAccount"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");

-- CreateIndex
CREATE INDEX "AuthToken_accountId_idx" ON "AuthToken"("accountId");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomStatus_code_key" ON "CustomStatus"("code");

-- CreateIndex
CREATE INDEX "CustomStatus_code_idx" ON "CustomStatus"("code");

-- CreateIndex
CREATE INDEX "ChatTemplate_groupId_idx" ON "ChatTemplate"("groupId");

-- CreateIndex
CREATE INDEX "ChatTemplate_priority_idx" ON "ChatTemplate"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseGroup_name_key" ON "ResponseGroup"("name");

-- CreateIndex
CREATE INDEX "TemplateUsage_templateId_idx" ON "TemplateUsage"("templateId");

-- CreateIndex
CREATE INDEX "TemplateUsage_usedAt_idx" ON "TemplateUsage"("usedAt");

-- CreateIndex
CREATE INDEX "AutomationLog_level_idx" ON "AutomationLog"("level");

-- CreateIndex
CREATE INDEX "AutomationLog_module_idx" ON "AutomationLog"("module");

-- CreateIndex
CREATE INDEX "AutomationLog_createdAt_idx" ON "AutomationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExchangeRateHistory_source_idx" ON "ExchangeRateHistory"("source");

-- CreateIndex
CREATE INDEX "ExchangeRateHistory_timestamp_idx" ON "ExchangeRateHistory"("timestamp");
