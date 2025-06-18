import { readFile } from "fs/promises";
import * as path from "path";

async function readPDF() {
  try {
    const pdfPath = "/home/user/projects/itrader_project/data/pdf/Receipt (32).pdf";
    
    // Read PDF file
    const pdfBuffer = await readFile(pdfPath);
    
    // Use pdf-parse directly
    const pdf = await import('pdf-parse/lib/pdf-parse.js');
    const data = await pdf.default(pdfBuffer);
    
    // Show only extracted text
    console.log("Extracted text from PDF:");
    console.log("========================");
    console.log(data.text);
    
  } catch (error) {
    console.error("Error reading PDF:", error);
  }
}

readPDF();