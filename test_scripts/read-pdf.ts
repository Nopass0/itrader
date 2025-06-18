import { PDFParser } from "../src/ocr/pdfParser";
import { readFile } from "fs/promises";

async function readPDF() {
  try {
    const pdfPath = "/home/user/projects/itrader_project/data/pdf/Receipt (32).pdf";
    
    // Read PDF file
    const pdfBuffer = await readFile(pdfPath);
    
    // Parse PDF
    const parser = new PDFParser();
    const result = await parser.parseReceipt(pdfBuffer);
    
    // Show only extracted text
    console.log("Extracted text from PDF:");
    console.log("========================");
    console.log(result.text);
    
  } catch (error) {
    console.error("Error reading PDF:", error);
  }
}

readPDF();