/**
 * Debug script to analyze V2 parser behavior step by step
 */

import { TinkoffReceiptParserV2 } from './src/ocr/receiptParserV2';
import * as fs from 'fs/promises';

const RECEIPT_PATH = '/home/user/projects/itrader_project/data/receipts/receipt_2025-06-20T14-15-48_Receipt.pdf';

// Create a custom parser class for debugging
class DebugTinkoffReceiptParserV2 extends TinkoffReceiptParserV2 {
  async debugParseReceiptPDF(filePath: string) {
    const pdfBuffer = await fs.readFile(filePath);
    const text = await this.extractTextFromPdf(pdfBuffer);
    this.lastExtractedText = text;
    
    console.log('==== EXTRACTED TEXT ====');
    console.log(text);
    console.log('\n==== LINES ====');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    lines.forEach((line, i) => console.log(`${i}: "${line}"`));
    
    // Check structure
    console.log('\n==== STRUCTURE ANALYSIS ====');
    const structure = this.analyzeStructureDebug(lines);
    console.log('Structure detected:', structure);
    
    // Check mixed block format
    console.log('\n==== MIXED BLOCK FORMAT CHECK ====');
    const isMixed = this.isMixedBlockFormatDebug(lines);
    console.log('Is mixed block format:', isMixed);
    
    // Try to extract sender
    console.log('\n==== SENDER EXTRACTION ====');
    const sender = this.extractSenderDebug(lines);
    console.log('Extracted sender:', sender);
    
    // Continue with normal parsing
    try {
      const result = await this.parseReceiptPDF(filePath);
      console.log('\n==== PARSE RESULT ====');
      console.log(result);
    } catch (error) {
      console.log('\n==== PARSE ERROR ====');
      console.log(error.message);
    }
  }
  
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    // Use the same extractor as the parent class
    const { extractTextFromPdfBuffer } = await import('./src/ocr/utils/textExtractor');
    return extractTextFromPdfBuffer(buffer);
  }
  
  private analyzeStructureDebug(lines: string[]): 'columnar' | 'sequential' {
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    const labelPositions: { label: string; index: number }[] = [];
    
    labels.forEach(label => {
      const idx = lines.indexOf(label);
      if (idx !== -1) {
        labelPositions.push({ label, index: idx });
      }
    });
    
    console.log('Label positions:', labelPositions);
    
    if (labelPositions.length < 4) return 'sequential';
    
    labelPositions.sort((a, b) => a.index - b.index);
    
    const firstFour = labelPositions.slice(0, 4);
    console.log('First four labels:', firstFour);
    
    for (let i = 1; i < firstFour.length; i++) {
      const prevIdx = firstFour[i-1].index;
      const currIdx = firstFour[i].index;
      
      console.log(`Checking between ${firstFour[i-1].label} (${prevIdx}) and ${firstFour[i].label} (${currIdx})`);
      for (let j = prevIdx + 1; j < currIdx; j++) {
        const line = lines[j];
        if (line && !labels.includes(line)) {
          console.log(`  Found non-label value at ${j}: "${line}"`);
          return 'sequential';
        }
      }
    }
    
    return 'columnar';
  }
  
  private isMixedBlockFormatDebug(lines: string[]): boolean {
    const firstBlockLabels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель'];
    const firstBlockStart = lines.indexOf('Комиссия');
    
    console.log('First block start index:', firstBlockStart);
    
    if (firstBlockStart === -1) return false;
    
    let allLabelsFound = true;
    for (let i = 0; i < firstBlockLabels.length; i++) {
      const expected = firstBlockLabels[i];
      const actual = lines[firstBlockStart + i];
      console.log(`Label ${i}: expected="${expected}", actual="${actual}"`);
      if (actual !== expected) {
        allLabelsFound = false;
        break;
      }
    }
    
    if (!allLabelsFound) {
      console.log('Not all labels found in sequence');
      return false;
    }
    
    const valueStart = firstBlockStart + firstBlockLabels.length;
    console.log('Value start index:', valueStart);
    
    if (valueStart + 4 > lines.length) {
      console.log('Not enough lines for values');
      return false;
    }
    
    const possibleCommission = lines[valueStart];
    const possibleSender = lines[valueStart + 1];
    const possiblePhone = lines[valueStart + 2];
    
    console.log('Possible commission:', possibleCommission);
    console.log('Possible sender:', possibleSender);
    console.log('Possible phone:', possiblePhone);
    
    const isCommissionValid = possibleCommission === 'Без комиссии' || /^\d+$/.test(possibleCommission);
    const isSenderValid = /^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/.test(possibleSender);
    const isPhoneValid = /^\+7/.test(possiblePhone);
    
    console.log('Is commission valid:', isCommissionValid);
    console.log('Is sender valid:', isSenderValid);
    console.log('Is phone valid:', isPhoneValid);
    
    return isCommissionValid && isSenderValid && isPhoneValid;
  }
  
  private extractSenderDebug(lines: string[]): string | null {
    const senderIdx = lines.indexOf('Отправитель');
    console.log('Sender label index:', senderIdx);
    
    if (senderIdx === -1) return null;
    
    // Check next few lines
    for (let i = senderIdx + 1; i < Math.min(senderIdx + 5, lines.length); i++) {
      const line = lines[i];
      console.log(`Checking line ${i}: "${line}"`);
      
      if (line && line.match(/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*$/)) {
        console.log(`  -> Matches sender pattern!`);
        return line;
      } else {
        console.log(`  -> Does not match sender pattern`);
      }
    }
    
    return null;
  }
}

// Run the debug
async function debug() {
  const parser = new DebugTinkoffReceiptParserV2();
  await parser.debugParseReceiptPDF(RECEIPT_PATH);
}

debug().catch(console.error);