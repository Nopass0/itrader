import { extractTextFromPdfBuffer } from './src/ocr/utils/textExtractor';
import * as fs from 'fs/promises';

async function debug() {
  const buffer = await fs.readFile('data/receipts/receipt_2025-06-19T19-41-43_Receipt.pdf');
  const text = await extractTextFromPdfBuffer(buffer);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Find label positions
  const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
  const positions: {[key: string]: number} = {};
  
  console.log('Label positions:');
  labels.forEach(label => {
    const idx = lines.indexOf(label);
    if (idx !== -1) {
      positions[label] = idx;
      console.log(`${idx.toString().padStart(3, '0')}: ${label}`);
    }
  });
  
  console.log('\nAll lines:');
  lines.forEach((line, idx) => {
    console.log(`${idx.toString().padStart(3, '0')}: ${line}`);
  });
  
  // Check if consecutive
  const indices = Object.values(positions).sort((a, b) => a - b);
  const isConsecutive = indices.every((val, i) => i === 0 || val === indices[i-1] + 1);
  console.log('\nLabels are consecutive:', isConsecutive);
  console.log('Structure type:', isConsecutive ? 'columnar' : 'sequential');
}

debug();