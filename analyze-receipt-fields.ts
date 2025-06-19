import * as fs from 'fs/promises';
import { extractTextFromPdfBuffer } from './src/ocr/utils/textExtractor';

async function analyzeReceiptFields() {
  const receipts = [
    'data/receipts/receipt_2025-06-19T14-32-58_Receipt.pdf',
    'data/receipts/receipt_2025-06-19T14-40-12_Receipt.pdf'
  ];
  
  for (const receipt of receipts) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📄 Analyzing: ${receipt}`);
    console.log('='.repeat(80));
    
    const buffer = await fs.readFile(receipt);
    const text = await extractTextFromPdfBuffer(buffer);
    
    // Разбиваем на строки
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    console.log('\n📋 All lines with indices:');
    lines.forEach((line, idx) => {
      console.log(`[${idx.toString().padStart(2, '0')}] ${line}`);
    });
    
    // Анализируем структуру
    console.log('\n🔍 Field analysis:');
    
    // Дата и время
    const dateTimeMatch = text.match(/(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2})/);
    console.log(`DateTime: ${dateTimeMatch ? dateTimeMatch[1] : 'NOT FOUND'}`);
    
    // Итого
    const totalIdx = lines.findIndex(l => l === 'Итого');
    if (totalIdx !== -1 && totalIdx + 2 < lines.length) {
      console.log(`Total (Итого): ${lines[totalIdx + 2]}`);
    }
    
    // Тип перевода
    const transferTypeIdx = lines.findIndex(l => l === 'Перевод');
    if (transferTypeIdx !== -1 && transferTypeIdx + 2 < lines.length) {
      console.log(`Transfer Type: ${lines[transferTypeIdx + 2]}`);
    }
    
    // Статус
    const statusIdx = lines.findIndex(l => l === 'Статус');
    if (statusIdx !== -1 && statusIdx + 2 < lines.length) {
      console.log(`Status: ${lines[statusIdx + 2]}`);
    }
    
    // Сумма
    const amountIdx = lines.findIndex(l => l === 'Сумма');
    if (amountIdx !== -1 && amountIdx + 2 < lines.length) {
      console.log(`Amount (Сумма): ${lines[amountIdx + 2]}`);
    }
    
    // Все поля с лейблами
    const labelFields = [
      'Комиссия',
      'Отправитель', 
      'Телефон получателя',
      'Получатель',
      'Банк получателя',
      'Счет списания'
    ];
    
    console.log('\n📊 Label-based fields:');
    for (const label of labelFields) {
      const idx = lines.findIndex(l => l === label);
      if (idx !== -1) {
        // Ищем значение после лейбла
        let value = 'NOT FOUND';
        for (let i = idx + 1; i < lines.length; i++) {
          const line = lines[i];
          // Если встретили другой лейбл, прерываем
          if (labelFields.includes(line) || line === 'Идентификатор операции' || line === 'СБП') {
            break;
          }
          // Это значение
          value = line;
          break;
        }
        console.log(`${label}: ${value}`);
      }
    }
    
    // Идентификатор операции
    const operationIdx = lines.findIndex(l => l === 'Идентификатор операции');
    if (operationIdx !== -1 && operationIdx + 1 < lines.length) {
      console.log(`\nOperation ID: ${lines[operationIdx + 1]}`);
    }
    
    // СБП код
    const sbpIdx = lines.findIndex(l => l === 'СБП');
    if (sbpIdx !== -1 && sbpIdx + 1 < lines.length) {
      console.log(`SBP Code: ${lines[sbpIdx + 1]}`);
    }
    
    // Квитанция
    const receiptMatch = text.match(/Квитанция\s*№\s*([\d-]+)/);
    console.log(`Receipt Number: ${receiptMatch ? receiptMatch[1] : 'NOT FOUND'}`);
    
    // Email поддержки
    const supportMatch = text.match(/Служба поддержки\s+(\S+@\S+)/);
    console.log(`Support Email: ${supportMatch ? supportMatch[1] : 'NOT FOUND'}`);
  }
}

analyzeReceiptFields();