/**
 * Утилиты для извлечения текста из PDF
 */

import * as fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OcrError } from '../types/models';
import { fallbackExtractText } from './fallbackTextExtractor';

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
    console.log('[TextExtractor] Starting PDF text extraction from file:', filePath);
    
    // Проверяем существование файла
    try {
      const stats = await fs.stat(filePath);
      console.log('[TextExtractor] File exists, size:', stats.size);
    } catch (error) {
      throw new OcrError(`Файл не найден: ${filePath}`);
    }
    
    // Сначала пробуем pdftotext, так как он надежнее
    try {
      const { stdout, stderr } = await execAsync(`pdftotext "${filePath}" -`, { maxBuffer: 10 * 1024 * 1024 });
      
      if (stderr) {
        console.warn('[TextExtractor] pdftotext stderr:', stderr);
      }
      
      if (stdout && stdout.trim().length > 0) {
        console.log('[TextExtractor] Successfully extracted text with pdftotext, length:', stdout.length);
        return stdout;
      } else {
        console.warn('[TextExtractor] pdftotext returned empty text');
      }
    } catch (error: unknown) {
      console.error('[TextExtractor] pdftotext failed:', error);
    }
    
    // Читаем файл для pdf-parse
    console.log('[TextExtractor] Trying pdf-parse fallback');
    const dataBuffer = await fs.readFile(filePath);
    
    // Пробуем извлечь текст через pdf-parse
    try {
      const pdf = await getPdfParse();
      const data = await pdf(dataBuffer);
      if (data.text && data.text.trim().length > 0) {
        console.log('[TextExtractor] Successfully extracted text with pdf-parse, length:', data.text.length);
        return data.text;
      } else {
        console.warn('[TextExtractor] pdf-parse returned empty text');
      }
    } catch (error: unknown) {
      console.error('[TextExtractor] pdf-parse failed:', error);
    }
    
    // Try fallback methods
    console.log('[TextExtractor] Trying fallback extraction methods');
    const fallbackText = await fallbackExtractText(filePath);
    if (fallbackText && fallbackText.trim().length > 0) {
      console.log('[TextExtractor] Fallback extraction succeeded, length:', fallbackText.length);
      return fallbackText;
    }
    
    throw new OcrError('Не удалось извлечь текст из PDF - все методы не вернули текст');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TextExtractor] Fatal error:', message);
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
    console.log('[TextExtractor] Starting PDF text extraction, buffer size:', pdfBuffer.length);
    
    // Сначала пробуем pdftotext через временный файл
    const tmpFile = `/tmp/receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
    try {
      await fs.writeFile(tmpFile, pdfBuffer);
      console.log('[TextExtractor] Wrote PDF to temp file:', tmpFile);
      
      const { stdout, stderr } = await execAsync(`pdftotext "${tmpFile}" -`, { maxBuffer: 10 * 1024 * 1024 });
      await fs.unlink(tmpFile).catch(() => {}); // Cleanup
      
      if (stderr) {
        console.warn('[TextExtractor] pdftotext stderr:', stderr);
      }
      
      if (stdout && stdout.trim().length > 0) {
        console.log('[TextExtractor] Successfully extracted text with pdftotext, length:', stdout.length);
        return stdout;
      } else {
        console.warn('[TextExtractor] pdftotext returned empty text');
      }
    } catch (error: unknown) {
      console.error('[TextExtractor] pdftotext from buffer failed:', error);
      await fs.unlink(tmpFile).catch(() => {}); // Cleanup on error
    }
    
    // Fallback to pdf-parse
    console.log('[TextExtractor] Trying pdf-parse fallback');
    try {
      const pdf = await getPdfParse();
      const data = await pdf(pdfBuffer);
      if (data.text && data.text.trim().length > 0) {
        console.log('[TextExtractor] Successfully extracted text with pdf-parse, length:', data.text.length);
        return data.text;
      } else {
        console.warn('[TextExtractor] pdf-parse returned empty text');
      }
    } catch (error: unknown) {
      console.error('[TextExtractor] pdf-parse from buffer failed:', error);
    }
    
    throw new OcrError('PDF не содержит текста или не удалось извлечь текст');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TextExtractor] Fatal error:', message);
    throw new OcrError(`Ошибка при извлечении текста из PDF буфера: ${message}`);
  }
}