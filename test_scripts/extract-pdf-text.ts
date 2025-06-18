import { PDFParser } from "../src/ocr/pdfParser";
import * as fs from "fs";
import * as path from "path";

async function extractPdfText() {
  try {
    const pdfPath = path.join(__dirname, "../data/pdf/Receipt (32).pdf");
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    const parser = new PDFParser();
    const result = await parser.parseReceipt(pdfBuffer);
    
    console.log("=== ПОЛНЫЙ ИЗВЛЕЧЕННЫЙ ТЕКСТ ИЗ PDF ===");
    console.log(result.text);
    console.log("\n=== РАСПОЗНАННАЯ ИНФОРМАЦИЯ ===");
    console.log("Сумма:", result.amount);
    console.log("Дата:", result.date);
    console.log("Время:", result.time);
    console.log("Статус:", result.status);
    console.log("Отправитель:", result.sender);
    console.log("Получатель:", result.recipient);
    console.log("Телефон получателя:", result.recipientPhone);
    console.log("ID транзакции:", result.transactionId);
    console.log("Банк:", result.bankName);
  } catch (error) {
    console.error("Ошибка при извлечении текста из PDF:", error);
  }
}

extractPdfText();