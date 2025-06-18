import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Decimal } from 'decimal.js';
import { ReceiptProcessor } from '../src/ocr/processor';

async function findTBankPDF() {
  const pdfDir = '/home/user/projects/itrader_project/data/pdf';
  const processor = new ReceiptProcessor();
  
  try {
    const files = await readdir(pdfDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    console.log(`Проверяю ${pdfFiles.length} PDF файлов...`);
    
    for (const filename of pdfFiles) {
      const filePath = join(pdfDir, filename);
      console.log(`\nПроверяю файл: ${filename}`);
      
      try {
        const pdfBuffer = await readFile(filePath);
        
        // Используем большую сумму для обхода валидации
        const dummyAmount = new Decimal('999999');
        const receipt = await processor.processReceipt(pdfBuffer, dummyAmount);
        
        if (receipt.rawText && receipt.rawText.includes('Клиенту Т-Банка')) {
          console.log(`\n✅ НАЙДЕН ФАЙЛ С ТЕКСТОМ "Клиенту Т-Банка": ${filename}`);
          console.log('\n=== ПОЛНЫЙ ТЕКСТ ФАЙЛА ===\n');
          console.log(receipt.rawText);
          console.log('\n=== КОНЕЦ ТЕКСТА ===\n');
          
          // Также покажем извлеченную информацию
          console.log('Извлеченная информация:');
          console.log(`- Сумма: ${receipt.amount.toString()}`);
          console.log(`- Банк: ${receipt.bank}`);
          console.log(`- Референс: ${receipt.reference}`);
          console.log(`- Дата/время: ${receipt.timestamp.toLocaleString('ru-RU')}`);
          if (receipt.phone) console.log(`- Телефон: ${receipt.phone}`);
          if (receipt.cardNumber) console.log(`- Номер карты: ${receipt.cardNumber}`);
          if (receipt.status) console.log(`- Статус: ${receipt.status}`);
        }
      } catch (err: any) {
        // Попробуем получить текст из ошибки, если он там есть
        if (err.message && err.message.includes('rawText')) {
          console.log(`Ошибка при обработке ${filename}, но получаем текст из ошибки...`);
        } else {
          console.error(`Ошибка при обработке ${filename}:`, err.message);
        }
      }
    }
    
    console.log('\nПоиск завершен.');
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

findTBankPDF();