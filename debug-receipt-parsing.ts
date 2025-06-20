import { extractTextFromPdfBuffer } from './src/ocr/utils/textExtractor';
import * as fs from 'fs/promises';

async function debugParsing() {
  const buffer = await fs.readFile('data/receipts/receipt_2025-06-19T19-41-43_Receipt.pdf');
  const text = await extractTextFromPdfBuffer(buffer);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // The actual structure is:
  // Labels: lines 9-12 (Комиссия, Отправитель, Телефон получателя, Получатель)
  // Values: lines 13-16 (Без комиссии, Ильман Демельханов, +7 (902) 397-02-35, Геннадий Т.)
  // Then more labels and values
  
  console.log('First block:');
  console.log('Labels:', lines.slice(9, 13));
  console.log('Values:', lines.slice(13, 17));
  
  console.log('\nSecond block:');
  console.log('Labels:', lines.slice(17, 19));
  console.log('Values:', lines.slice(19, 21));
  
  // This is actually a "mixed" format where labels and values come in blocks
  // Let's manually extract the values
  const data = {
    commission: lines[13], // "Без комиссии"
    sender: lines[14], // "Ильман Демельханов"
    recipientPhone: lines[15], // "+7 (902) 397-02-35"
    recipientName: lines[16], // "Геннадий Т."
    recipientBank: lines[19], // "ВТБ"
    senderAccount: lines[20], // "408178104000****3166"
  };
  
  console.log('\nExtracted data:', data);
}

debugParsing();