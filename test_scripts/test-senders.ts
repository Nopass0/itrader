import { TinkoffReceiptParser } from "./src/ocr";
import * as fs from "fs/promises";
import * as path from "path";

async function testSenders() {
  const parser = new TinkoffReceiptParser();
  const pdfDir = path.join(__dirname, "data", "pdf");
  
  console.log("=== Тест извлечения отправителей ===\n");
  
  const files = await fs.readdir(pdfDir);
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  
  for (const file of pdfFiles) {
    const filePath = path.join(pdfDir, file);
    
    try {
      const receipt = await parser.parseReceiptFromFile(filePath);
      console.log(`${file}: ${receipt.sender}`);
    } catch (error) {
      console.log(`${file}: ОШИБКА`);
    }
  }
}

testSenders().catch(console.error);