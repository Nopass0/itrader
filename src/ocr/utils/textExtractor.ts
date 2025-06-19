/**
 * Утилиты для извлечения текста из PDF
 */

import * as fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OcrError } from '../types/models';

const execAsync = promisify(exec);

// Lazy load pdf-parse to avoid initialization errors
let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    try {
      // Try to use the wrapper first
      pdfParse = require('./pdfParseWrapper');
    } catch (error) {
      console.warn('pdf-parse wrapper not available, trying direct import');
      try {
        // Use dynamic import to avoid initialization errors
        const module = await import('pdf-parse');
        pdfParse = module.default || module;
      } catch (importError) {
        console.error('Failed to load pdf-parse:', importError);
        // Return a mock function if pdf-parse fails to load
        pdfParse = async (buffer: Buffer) => {
          throw new Error('pdf-parse module not available');
        };
      }
    }
  }
  return pdfParse;
}

/**
 * Извлекает текст из PDF файла
 * @param filePath - Путь к PDF файлу
 * @returns Извлеченный текст
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    // Сначала пробуем pdftotext, так как он надежнее
    try {
      const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
      if (stdout && stdout.trim().length > 0) {
        return stdout;
      }
    } catch (error: unknown) {
      console.warn('pdftotext failed, trying pdf-parse:', error);
    }
    
    // Читаем файл для pdf-parse
    const dataBuffer = await fs.readFile(filePath);
    
    // Пробуем извлечь текст через pdf-parse
    try {
      const pdf = await getPdfParse();
      const data = await pdf(dataBuffer);
      if (data.text && data.text.trim().length > 0) {
        return data.text;
      }
    } catch (error: unknown) {
      console.warn('pdf-parse failed:', error);
    }
    
    throw new OcrError('Не удалось извлечь текст из PDF');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OcrError(`Ошибка при извлечении текста из PDF: ${message}`);
  }
}

/**
 * Извлекает текст из PDF буфера
 * @param pdfBuffer - Буфер с PDF данными
 * @returns Извлеченный текст
 */
export async function extractTextFromPdfBuffer(pdfBuffer: Buffer): Promise<string> {
  try {
    // Сначала пробуем pdftotext через временный файл
    const tmpFile = `/tmp/receipt_${Date.now()}.pdf`;
    try {
      await fs.writeFile(tmpFile, pdfBuffer);
      const { stdout } = await execAsync(`pdftotext "${tmpFile}" -`);
      await fs.unlink(tmpFile).catch(() => {}); // Cleanup
      if (stdout && stdout.trim().length > 0) {
        return stdout;
      }
    } catch (error: unknown) {
      console.warn('pdftotext from buffer failed:', error);
      await fs.unlink(tmpFile).catch(() => {}); // Cleanup on error
    }
    
    // Fallback to pdf-parse
    try {
      const pdf = await getPdfParse();
      const data = await pdf(pdfBuffer);
      if (data.text && data.text.trim().length > 0) {
        return data.text;
      }
    } catch (error: unknown) {
      console.warn('pdf-parse from buffer failed:', error);
    }
    
    throw new OcrError('PDF не содержит текста');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OcrError(`Ошибка при извлечении текста из PDF буфера: ${message}`);
  }
}