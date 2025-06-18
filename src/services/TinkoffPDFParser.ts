/**
 * Enhanced Tinkoff PDF Parser Service
 * Extends the base TinkoffReceiptParser with additional functionality for Gmail processing
 */

import { TinkoffReceiptParser as BaseParser, ParsedReceipt, TransferType } from "../ocr/receiptParser";
import { createLogger } from "../logger";
import { extractTextFromPdfBuffer } from "../ocr/utils/textExtractor";

const logger = createLogger("TinkoffPDFParser");

export interface ExtendedParsedReceipt extends ParsedReceipt {
  // Additional fields for enhanced parsing
  transactionId?: string; // Transaction ID from receipt if available
  paymentMethod?: string; // Payment method used
  recipientAccountNumber?: string; // Account number if available
  senderCard?: string; // Sender's card number if available
  operationNumber?: string; // Operation/reference number
}

export interface ParsingMetadata {
  parseTime: number; // Time taken to parse in milliseconds
  textLength: number; // Length of extracted text
  confidence: number; // Confidence score (0-1)
  warnings: string[]; // Any warnings during parsing
}

export interface ParseResult {
  receipt: ExtendedParsedReceipt | null;
  metadata: ParsingMetadata;
  rawText: string;
  error?: string;
}

export class TinkoffPDFParser extends BaseParser {
  private lastParseMetadata: ParsingMetadata | null = null;

  /**
   * Enhanced parse from buffer with extended result
   */
  async parseFromBufferExtended(pdfBuffer: Buffer): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    
    try {
      // Extract text from PDF using the existing utility
      const text = await extractTextFromPdfBuffer(pdfBuffer);
      this.lastExtractedText = text;

      logger.info("Extracted text from PDF", {
        textLength: text.length,
      });

      // Parse using base parser
      const baseReceipt = await this.parseFromBuffer(pdfBuffer);

      // Enhance with additional fields
      const enhancedReceipt = this.enhanceReceipt(baseReceipt, text);

      // Calculate confidence score
      const confidence = this.calculateConfidence(enhancedReceipt, text);

      // Check for potential issues
      if (text.length < 100) {
        warnings.push("Text length is suspiciously short");
      }
      if (!text.includes("Тинькофф") && !text.includes("Т-Банк")) {
        warnings.push("Bank name not found in text");
      }
      if (confidence < 0.7) {
        warnings.push("Low parsing confidence");
      }

      const metadata: ParsingMetadata = {
        parseTime: Date.now() - startTime,
        textLength: text.length,
        confidence,
        warnings,
      };

      this.lastParseMetadata = metadata;

      logger.info("Receipt parsed successfully", {
        amount: enhancedReceipt.amount,
        transferType: enhancedReceipt.transferType,
        confidence,
        parseTime: metadata.parseTime,
      });

      return {
        receipt: enhancedReceipt,
        metadata,
        rawText: text,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";
      
      logger.error("Failed to parse receipt", error as Error);

      const metadata: ParsingMetadata = {
        parseTime: Date.now() - startTime,
        textLength: this.lastExtractedText?.length || 0,
        confidence: 0,
        warnings: [...warnings, errorMessage],
      };

      return {
        receipt: null,
        metadata,
        rawText: this.lastExtractedText || "",
        error: errorMessage,
      };
    }
  }

  /**
   * Parse multiple PDFs in batch
   */
  async parseBatch(pdfBuffers: Buffer[]): Promise<ParseResult[]> {
    logger.info("Starting batch parsing", { count: pdfBuffers.length });
    
    const results: ParseResult[] = [];
    
    for (let i = 0; i < pdfBuffers.length; i++) {
      logger.info("Parsing PDF", { index: i + 1, total: pdfBuffers.length });
      
      const result = await this.parseFromBufferExtended(pdfBuffers[i]);
      results.push(result);
      
      // Add small delay between parses to avoid overwhelming the system
      if (i < pdfBuffers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info("Batch parsing complete", {
      total: pdfBuffers.length,
      successful: results.filter(r => r.receipt !== null).length,
      failed: results.filter(r => r.receipt === null).length,
    });
    
    return results;
  }

  /**
   * Enhance receipt with additional fields
   */
  private enhanceReceipt(baseReceipt: ParsedReceipt, text: string): ExtendedParsedReceipt {
    const enhanced: ExtendedParsedReceipt = { ...baseReceipt };

    // Extract transaction ID if available
    const transactionIdMatch = text.match(/(?:Номер операции|Идентификатор|ID)[\s:]*(\d+)/i);
    if (transactionIdMatch) {
      enhanced.transactionId = transactionIdMatch[1];
    }

    // Extract operation number
    const operationMatch = text.match(/(?:Операция|Operation)[\s:]*(\S+)/i);
    if (operationMatch) {
      enhanced.operationNumber = operationMatch[1];
    }

    // Extract sender card if available
    const senderCardMatch = text.match(/(?:Карта отправителя|С карты)[\s:]*(\*?\d{4})/i);
    if (senderCardMatch) {
      enhanced.senderCard = senderCardMatch[1];
    }

    // Extract recipient account number for bank transfers
    const accountMatch = text.match(/(?:Счет получателя|На счет)[\s:]*(\d{20})/);
    if (accountMatch) {
      enhanced.recipientAccountNumber = accountMatch[1];
    }

    // Determine payment method
    if (text.includes("СБП") || text.includes("Система быстрых платежей")) {
      enhanced.paymentMethod = "СБП";
    } else if (text.includes("Перевод на карту")) {
      enhanced.paymentMethod = "Card Transfer";
    } else if (text.includes("Перевод по номеру")) {
      enhanced.paymentMethod = "Phone Transfer";
    }

    return enhanced;
  }

  /**
   * Calculate confidence score for parsed receipt
   */
  private calculateConfidence(receipt: ExtendedParsedReceipt, text: string): number {
    let score = 0;
    let maxScore = 0;

    // Check for required fields
    const checks = [
      { condition: receipt.amount > 0, weight: 2 },
      { condition: receipt.datetime !== null, weight: 2 },
      { condition: receipt.status === "SUCCESS", weight: 2 },
      { condition: receipt.sender !== null, weight: 1 },
      { condition: receipt.transferType !== null, weight: 1 },
      { condition: text.includes("Успешно"), weight: 1 },
      { condition: text.includes("Тинькофф") || text.includes("Т-Банк"), weight: 1 },
      { condition: receipt.transactionId !== null, weight: 0.5 },
      { condition: receipt.operationNumber !== null, weight: 0.5 },
    ];

    for (const check of checks) {
      maxScore += check.weight;
      if (check.condition) {
        score += check.weight;
      }
    }

    // Additional checks based on transfer type
    if (receipt.transferType === TransferType.BY_PHONE) {
      maxScore += 1;
      if ("recipientPhone" in receipt && receipt.recipientPhone) {
        score += 1;
      }
    } else if (receipt.transferType === TransferType.TO_CARD) {
      maxScore += 1;
      if ("recipientCard" in receipt && receipt.recipientCard) {
        score += 1;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Validate receipt data
   */
  validateReceipt(receipt: ExtendedParsedReceipt): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!receipt.amount || receipt.amount <= 0) {
      errors.push("Invalid amount");
    }

    if (!receipt.datetime) {
      errors.push("Missing datetime");
    }

    if (!receipt.sender) {
      errors.push("Missing sender");
    }

    if (!receipt.transferType) {
      errors.push("Missing transfer type");
    }

    // Type-specific validation
    switch (receipt.transferType) {
      case TransferType.BY_PHONE:
        if (!("recipientPhone" in receipt) || !receipt.recipientPhone) {
          errors.push("Missing recipient phone for phone transfer");
        }
        break;
      case TransferType.TO_CARD:
        if (!("recipientCard" in receipt) || !receipt.recipientCard) {
          errors.push("Missing recipient card for card transfer");
        }
        break;
      case TransferType.TO_TBANK:
        if (!("recipientName" in receipt) || !receipt.recipientName) {
          errors.push("Missing recipient name for T-Bank transfer");
        }
        break;
    }

    // Date validation (not in future)
    if (receipt.datetime && receipt.datetime > new Date()) {
      errors.push("Receipt date is in the future");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get last parse metadata
   */
  getLastParseMetadata(): ParsingMetadata | null {
    return this.lastParseMetadata;
  }

  /**
   * Extract all numeric values from text (useful for debugging)
   */
  extractNumericValues(text: string): { label: string; value: number }[] {
    const values: { label: string; value: number }[] = [];
    
    // Pattern to find numbers with optional label
    const pattern = /([А-Яа-я\w\s]+)?(\d{1,3}(?:\s+\d{3})*(?:[.,]\d{2})?)\s*(?:₽|руб|RUB)?/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const label = match[1]?.trim() || "Unknown";
      const valueStr = match[2].replace(/\s+/g, "").replace(",", ".");
      const value = parseFloat(valueStr);
      
      if (!isNaN(value) && value > 0) {
        values.push({ label, value });
      }
    }
    
    return values;
  }
}