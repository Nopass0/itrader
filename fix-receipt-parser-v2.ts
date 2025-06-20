/**
 * Fix for the V2 parser to handle the sequential format correctly
 * The issue is that extractSequentialFields assumes all values come after all labels,
 * but in reality values are interspersed with labels.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const PARSER_FILE = path.join(process.cwd(), 'src/ocr/receiptParserV2.ts');

async function fixParser() {
  console.log('Reading parser file...');
  let content = await fs.readFile(PARSER_FILE, 'utf-8');
  
  // Find the extractSequentialFields method
  const methodStart = content.indexOf('private extractSequentialFields(lines: string[], result: TinkoffReceiptData): void {');
  if (methodStart === -1) {
    console.error('Could not find extractSequentialFields method');
    return;
  }
  
  // Find the end of the method
  let braceCount = 0;
  let inMethod = false;
  let methodEnd = methodStart;
  
  for (let i = methodStart; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      inMethod = true;
    } else if (content[i] === '}') {
      braceCount--;
      if (inMethod && braceCount === 0) {
        methodEnd = i + 1;
        break;
      }
    }
  }
  
  // Replace the method with the fixed version
  const newMethod = `private extractSequentialFields(lines: string[], result: TinkoffReceiptData): void {
    // В последовательной структуре значения могут быть как после лейблов, так и между ними
    const labels = ['Комиссия', 'Отправитель', 'Телефон получателя', 'Получатель', 'Банк получателя', 'Счет списания'];
    
    // Находим индексы лейблов
    const labelIndices: {[key: string]: number} = {};
    labels.forEach(label => {
      const idx = lines.indexOf(label);
      if (idx !== -1) labelIndices[label] = idx;
    });
    
    // Для каждого лейбла ищем значение сразу после него
    Object.entries(labelIndices).forEach(([label, idx]) => {
      // Проверяем следующие строки после лейбла
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        const line = lines[i];
        
        // Пропускаем другие лейблы
        if (labels.includes(line)) continue;
        
        // Пропускаем служебные строки
        if (line.startsWith('Идентификатор операции') || line === 'СБП' || line.startsWith('Квитанция')) {
          break;
        }
        
        // Проверяем и присваиваем значение в зависимости от лейбла
        switch(label) {
          case 'Комиссия':
            if (result.commission === undefined && (line === 'Без комиссии' || line.match(/^\\d+$/))) {
              result.commission = line === 'Без комиссии' ? 0 : parseInt(line);
              break;
            }
            continue;
            
          case 'Отправитель':
            if (!result.senderName && line.match(/^[А-ЯЁ][а-яё]+(?:\\s+[А-ЯЁ][а-яё]+)*$/)) {
              result.senderName = line;
              break;
            }
            continue;
            
          case 'Телефон получателя':
            if (!result.recipientPhone && line.match(/^\\+7/)) {
              result.recipientPhone = line;
              break;
            }
            continue;
            
          case 'Получатель':
            // Для блока из 3 лейблов подряд (Получатель, Банк получателя, Счет списания)
            // значения идут после последнего лейбла в том же порядке
            if (labelIndices['Банк получателя'] === idx + 1 && labelIndices['Счет списания'] === idx + 2) {
              // Это блок из 3 лейблов подряд, ищем значения после последнего
              const valuesStart = idx + 3;
              if (valuesStart < lines.length && !result.recipientName) {
                const recipientLine = lines[valuesStart];
                if (recipientLine && recipientLine.match(/^[А-ЯЁ][а-яё]+/) && !recipientLine.includes('@')) {
                  result.recipientName = recipientLine;
                }
              }
              if (valuesStart + 1 < lines.length && !result.recipientBank) {
                const bankLine = lines[valuesStart + 1];
                if (bankLine && (bankLine.includes('банк') || bankLine.includes('Банк'))) {
                  result.recipientBank = bankLine;
                }
              }
              if (valuesStart + 2 < lines.length && !result.senderAccount) {
                const accountLine = lines[valuesStart + 2];
                if (accountLine && accountLine.includes('****')) {
                  result.senderAccount = accountLine;
                }
              }
              break;
            } else if (!result.recipientName && line.match(/^[А-ЯЁ][а-яё]+/) && !line.includes('@')) {
              // Обычный случай - значение сразу после лейбла
              result.recipientName = line;
              break;
            }
            continue;
            
          case 'Банк получателя':
            // Пропускаем если это часть блока из 3 лейблов (уже обработано выше)
            if (labelIndices['Получатель'] === idx - 1 && labelIndices['Счет списания'] === idx + 1) {
              break;
            }
            if (!result.recipientBank && (line.includes('банк') || line.includes('Банк'))) {
              result.recipientBank = line;
              break;
            }
            continue;
            
          case 'Счет списания':
            // Пропускаем если это часть блока из 3 лейблов (уже обработано выше)
            if (labelIndices['Получатель'] === idx - 2 && labelIndices['Банк получателя'] === idx - 1) {
              break;
            }
            if (!result.senderAccount && line.includes('****')) {
              result.senderAccount = line;
              break;
            }
            continue;
        }
        
        // Если нашли значение, прерываем цикл для этого лейбла
        break;
      }
    });
    
    // Специальная обработка для имени получателя в конце документа (для некоторых форматов)
    if (result.transferType === 'По номеру телефона' && !result.recipientName) {
      // Ищем имя получателя в последних строках (после email поддержки)
      for (let j = lines.length - 1; j >= Math.max(0, lines.length - 5); j--) {
        const lastLine = lines[j];
        // Проверяем что это имя (начинается с заглавной буквы, может содержать инициалы)
        if (lastLine && lastLine.match(/^[А-ЯЁ][а-яё]+(?:\\s+[А-ЯЁ]\\.?)+$/)) {
          result.recipientName = lastLine;
          break;
        }
      }
    }
  }`;
  
  // Replace the old method with the new one
  const before = content.substring(0, methodStart);
  const after = content.substring(methodEnd);
  content = before + newMethod + after;
  
  // Write the fixed file
  console.log('Writing fixed parser...');
  await fs.writeFile(PARSER_FILE, content, 'utf-8');
  
  console.log('Parser fixed successfully!');
  console.log('\nThe fix handles the sequential format where:');
  console.log('- Values can be interspersed with labels');
  console.log('- Special handling for the 3-label block (Получатель, Банк получателя, Счет списания)');
  console.log('- More robust value extraction that checks after each label');
}

fixParser().catch(console.error);