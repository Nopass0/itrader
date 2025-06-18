import { TinkoffReceiptParser, TransferType, ReceiptParseError } from "./src/ocr";
import * as fs from "fs/promises";
import * as path from "path";

async function testReceiptParser() {
  const parser = new TinkoffReceiptParser();
  const pdfDir = path.join(__dirname, "data", "pdf");
  
  console.log("=== Тестирование парсера чеков Тинькофф ===\n");
  
  try {
    const files = await fs.readdir(pdfDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    console.log(`Найдено ${pdfFiles.length} PDF файлов\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of pdfFiles) {
      const filePath = path.join(pdfDir, file);
      console.log(`--- Обработка: ${file} ---`);
      
      try {
        const receipt = await parser.parseReceiptFromFile(filePath);
        successCount++;
        
        console.log("✅ Успешно распарсен:");
        console.log(`  Дата и время: ${receipt.datetime.toLocaleString('ru-RU')}`);
        console.log(`  Сумма: ${receipt.amount} ₽`);
        console.log(`  Статус: ${receipt.status}`);
        console.log(`  Отправитель: ${receipt.sender}`);
        
        switch (receipt.transferType) {
          case TransferType.BY_PHONE:
            console.log(`  Тип: Перевод по номеру телефона`);
            console.log(`  Телефон получателя: ${receipt.recipientPhone}`);
            console.log(`  Банк получателя: ${receipt.recipientBank}`);
            break;
            
          case TransferType.TO_TBANK:
            console.log(`  Тип: Перевод клиенту Т-Банка`);
            console.log(`  Получатель: ${receipt.recipientName}`);
            console.log(`  Карта получателя: ${receipt.recipientCard}`);
            break;
            
          case TransferType.TO_CARD:
            console.log(`  Тип: Перевод на карту`);
            console.log(`  Карта получателя: ${receipt.recipientCard}`);
            console.log(`  Комиссия: ${receipt.commission} ₽`);
            break;
        }
        
        if ('commission' in receipt && receipt.commission !== undefined && receipt.transferType !== TransferType.TO_CARD) {
          console.log(`  Комиссия: ${receipt.commission} ₽`);
        }
        
      } catch (error) {
        errorCount++;
        if (error instanceof ReceiptParseError) {
          console.log(`❌ Ошибка парсинга: ${error.message}`);
        } else {
          console.log(`❌ Неизвестная ошибка: ${error}`);
        }
      }
      
      console.log();
    }
    
    console.log("=== ИТОГО ===");
    console.log(`Успешно распарсено: ${successCount}`);
    console.log(`Ошибок: ${errorCount}`);
    console.log(`Всего файлов: ${pdfFiles.length}`);
    
  } catch (error) {
    console.error("Ошибка при чтении директории:", error);
  }
}

// Запускаем тест
testReceiptParser().catch(console.error);