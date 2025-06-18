/**
 * Simple PDF parser for extracting text and information
 */

import { Decimal } from "decimal.js";
import { extractTextFromPdfBuffer } from "./utils/textExtractor";

export interface ParsedReceiptInfo {
  text: string;
  amount?: string;
  date?: string;
  time?: string;
  status?: string;
  sender?: string;
  recipient?: string;
  recipientPhone?: string;
  recipientCard?: string;
  transactionId?: string;
  bankName?: string;
}

export class PDFParser {
  /**
   * Parse PDF receipt without validation
   */
  async parseReceipt(pdfData: Buffer): Promise<ParsedReceiptInfo> {
    // Extract text from PDF
    const text = await extractTextFromPdfBuffer(pdfData);
    
    const info: ParsedReceiptInfo = { text };
    
    // Extract amount
    const amountMatch = text.match(/Итого\s*([0-9\s]+)\s*[i₽]/i) || 
                       text.match(/Сумма\s*([0-9\s]+)\s*[i₽]/i) ||
                       text.match(/([0-9\s]+)\s*[i₽]\s*Сумма/i);
    if (amountMatch) {
      info.amount = amountMatch[1].replace(/\s/g, '').trim();
    }
    
    // Extract date
    const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (dateMatch) {
      info.date = dateMatch[1];
    }
    
    // Extract time
    const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      info.time = timeMatch[1];
    }
    
    // Extract status
    const statusMatch = text.match(/Статус\s*([^\n]+)/i);
    if (statusMatch) {
      info.status = statusMatch[1].trim();
    }
    
    // Extract sender
    const senderMatch = text.match(/(?:Отправитель|Sender)\s*([^\n]+)/i);
    if (senderMatch) {
      info.sender = senderMatch[1].trim();
    }
    
    // Extract recipient
    const recipientMatch = text.match(/(?:Получатель|Recipient)\s*([^\n]+)/i);
    if (recipientMatch) {
      info.recipient = recipientMatch[1].trim();
    }
    
    // Extract recipient phone
    const phoneMatch = text.match(/Телефон получателя\s*([+\d\s\-()]+)/i);
    if (phoneMatch) {
      info.recipientPhone = phoneMatch[1].trim();
    }
    
    // Extract transaction type
    const transTypeMatch = text.match(/Перевод\s*([^\n]+)/i);
    if (transTypeMatch) {
      info.transactionId = transTypeMatch[1].trim();
    }
    
    // Try to detect bank
    if (text.includes("Т-Банк") || text.includes("Тинькофф")) {
      info.bankName = "T-Банк (Тинькофф)";
    } else if (text.includes("Сбер")) {
      info.bankName = "Сбербанк";
    } else if (text.includes("Альфа")) {
      info.bankName = "Альфа-Банк";
    }
    
    return info;
  }
}