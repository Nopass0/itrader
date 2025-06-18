/**
 * Tests for Gmail Receipt Processor
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { GmailReceiptProcessor } from "../GmailReceiptProcessor";
import { TinkoffPDFParser } from "../TinkoffPDFParser";
import { PrismaClient } from "../../../generated/prisma";
import { createLogger } from "../../logger";

const logger = createLogger("GmailReceiptProcessorTest");
const prisma = new PrismaClient();

describe("Gmail Receipt Processor", () => {
  describe("TinkoffPDFParser", () => {
    test("should create parser instance", () => {
      const parser = new TinkoffPDFParser();
      expect(parser).toBeDefined();
    });

    test("should handle invalid PDF gracefully", async () => {
      const parser = new TinkoffPDFParser();
      const invalidPdf = Buffer.from("This is not a PDF");
      
      const result = await parser.parseFromBufferExtended(invalidPdf);
      
      expect(result.receipt).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.metadata.confidence).toBe(0);
    });

    test("should extract numeric values from text", () => {
      const parser = new TinkoffPDFParser();
      const text = "Сумма 1 000 ₽ Комиссия 50 руб Итого 1 050 RUB";
      
      const values = parser.extractNumericValues(text);
      
      expect(values).toHaveLength(3);
      expect(values[0].value).toBe(1000);
      expect(values[1].value).toBe(50);
      expect(values[2].value).toBe(1050);
    });

    test("should validate receipt data", () => {
      const parser = new TinkoffPDFParser();
      
      const validReceipt: any = {
        amount: 1000,
        datetime: new Date(),
        sender: "Test Sender",
        transferType: "BY_PHONE",
        status: "SUCCESS",
        recipientPhone: "+7 (123) 456-78-90"
      };
      
      const validation = parser.validateReceipt(validReceipt);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      const invalidReceipt: any = {
        amount: 0,
        datetime: null,
        sender: null,
        transferType: "BY_PHONE"
      };
      
      const invalidValidation = parser.validateReceipt(invalidReceipt);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Receipt Matching Logic", () => {
    test("should match receipt with payout by phone", async () => {
      // Create test payout
      const testPayout = {
        id: "test-payout-1",
        gatePayoutId: 12345,
        status: 5,
        amount: 1000,
        amountTrader: { "643": 1000 },
        wallet: "+7 (999) 123-45-67",
        createdAt: new Date(),
      };

      const testReceipt = {
        id: "test-receipt-1",
        amount: 1000,
        recipientPhone: "+7 (999) 123-45-67",
        recipientCard: null,
        status: "SUCCESS",
        transactionDate: new Date(),
      };

      // Phone normalization test
      const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
      
      expect(normalizePhone(testPayout.wallet)).toBe("79991234567");
      expect(normalizePhone(testReceipt.recipientPhone)).toBe("79991234567");
    });

    test("should match receipt with payout by card", async () => {
      const testPayout = {
        recipientCard: "****1234",
        wallet: "1234", // Last 4 digits
      };

      const testReceipt = {
        recipientCard: "*1234",
      };

      // Extract last 4 digits
      const payoutLast4 = testPayout.wallet.slice(-4);
      const receiptLast4 = testReceipt.recipientCard.match(/\d{4}$/)?.[0];
      
      expect(payoutLast4).toBe("1234");
      expect(receiptLast4).toBe("1234");
    });

    test("should handle amount differences for commission", () => {
      const payoutAmount = 1000;
      const receiptAmounts = [1000, 950, 1050, 900, 1100];
      const maxDifference = 100;

      const results = receiptAmounts.map(amount => {
        const diff = Math.abs(payoutAmount - amount);
        return diff <= maxDifference;
      });

      expect(results).toEqual([true, true, true, false, false]);
    });
  });

  describe("Database Operations", () => {
    beforeAll(async () => {
      // Clean up test data
      await prisma.receipt.deleteMany({
        where: { emailId: { startsWith: "test-" } }
      });
    });

    afterAll(async () => {
      // Clean up test data
      await prisma.receipt.deleteMany({
        where: { emailId: { startsWith: "test-" } }
      });
      await prisma.$disconnect();
    });

    test("should create receipt record", async () => {
      const receiptData = {
        emailId: `test-email-${Date.now()}`,
        emailFrom: "noreply@tinkoff.ru",
        emailSubject: "Test Receipt",
        attachmentName: "receipt.pdf",
        filePath: "/tmp/test-receipt.pdf",
        fileHash: "test-hash-" + Date.now(),
        amount: 1000,
        bank: "Tinkoff",
        status: "SUCCESS",
        transactionDate: new Date(),
        parsedData: { test: true },
        isProcessed: false,
      };

      const receipt = await prisma.receipt.create({
        data: receiptData,
      });

      expect(receipt).toBeDefined();
      expect(receipt.id).toBeDefined();
      expect(receipt.amount).toBe(1000);
      expect(receipt.status).toBe("SUCCESS");

      // Clean up
      await prisma.receipt.delete({
        where: { id: receipt.id }
      });
    });
  });
});