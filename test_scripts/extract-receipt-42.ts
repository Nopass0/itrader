import { readFile } from 'fs/promises';
import { extractTextFromPdfBuffer } from '../src/ocr/utils/textExtractor';

async function extractFullText() {
  const filePath = '/home/user/projects/itrader_project/data/pdf/Receipt (42).pdf';
  
  try {
    console.log('Извлекаю полный текст из Receipt (42).pdf...\n');
    
    const pdfBuffer = await readFile(filePath);
    
    // Пробуем извлечь текст напрямую через функцию извлечения
    try {
      const text = await extractTextFromPdfBuffer(pdfBuffer);
      
      console.log('=== ПОЛНЫЙ ТЕКСТ ФАЙЛА Receipt (42).pdf ===\n');
      console.log(text);
      console.log('\n=== КОНЕЦ ТЕКСТА ===');
      
      // Дополнительно покажем информацию о файле
      console.log('\nИнформация о содержимом:');
      console.log('- Содержит "Клиенту Т-Банка":', text.includes('Клиенту Т-Банка') ? 'ДА' : 'НЕТ');
      console.log('- Размер текста:', text.length, 'символов');
      
      // Найдем и покажем строки с ключевой информацией
      const lines = text.split('\n');
      console.log('\nКлючевые строки:');
      lines.forEach((line, index) => {
        if (line.includes('Клиенту Т-Банка') || 
            line.includes('Сумма') || 
            line.includes('Отправитель') || 
            line.includes('Получатель') ||
            line.includes('Квитанция') ||
            line.includes('Статус')) {
          console.log(`Строка ${index + 1}: ${line.trim()}`);
        }
      });
      
    } catch (err: any) {
      console.error('Ошибка при извлечении текста:', err.message);
      console.log('\nПопробуем альтернативный метод...');
      
      // Если не удалось извлечь через extractTextFromPdfBuffer, попробуем через fs и показать сырые данные
      console.log('\nПоказываю первые 1000 байт файла в hex:');
      console.log(pdfBuffer.subarray(0, 1000).toString('hex'));
    }
    
  } catch (err) {
    console.error('Ошибка при чтении файла:', err);
  }
}

extractFullText();