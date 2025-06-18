import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { PDFParser } from '../src/ocr/pdfParser';

async function findTBankPDF() {
  const pdfDir = '/home/user/projects/itrader_project/data/pdf';
  const parser = new PDFParser();
  
  try {
    const files = await readdir(pdfDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    console.log(`Проверяю ${pdfFiles.length} PDF файлов...`);
    
    for (const filename of pdfFiles) {
      const filePath = join(pdfDir, filename);
      console.log(`\nПроверяю файл: ${filename}`);
      
      try {
        const pdfBuffer = await readFile(filePath);
        const parsed = await parser.parseReceipt(pdfBuffer);
        
        if (parsed.text.includes('Клиенту Т-Банка')) {
          console.log(`\n✅ НАЙДЕН ФАЙЛ С ТЕКСТОМ "Клиенту Т-Банка": ${filename}`);
          console.log('\n=== ПОЛНЫЙ ТЕКСТ ФАЙЛА ===\n');
          console.log(parsed.text);
          console.log('\n=== КОНЕЦ ТЕКСТА ===\n');
          
          // Также покажем извлеченную информацию
          console.log('Извлеченная информация:');
          if (parsed.amount) console.log(`- Сумма: ${parsed.amount}`);
          if (parsed.date) console.log(`- Дата: ${parsed.date}`);
          if (parsed.time) console.log(`- Время: ${parsed.time}`);
          if (parsed.status) console.log(`- Статус: ${parsed.status}`);
          if (parsed.sender) console.log(`- Отправитель: ${parsed.sender}`);
          if (parsed.recipient) console.log(`- Получатель: ${parsed.recipient}`);
          if (parsed.recipientPhone) console.log(`- Телефон получателя: ${parsed.recipientPhone}`);
          if (parsed.transactionId) console.log(`- ID транзакции: ${parsed.transactionId}`);
          if (parsed.bankName) console.log(`- Банк: ${parsed.bankName}`);
        }
      } catch (err) {
        console.error(`Ошибка при обработке ${filename}:`, err.message);
      }
    }
    
    console.log('\nПоиск завершен.');
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

findTBankPDF();