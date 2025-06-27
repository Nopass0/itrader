/**
 * Fallback text extractor using alternative methods
 */

import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';

const execAsync = promisify(exec);

/**
 * Try to extract text using alternative command-line tools
 */
export async function fallbackExtractText(filePath: string): Promise<string | null> {
  console.log('[FallbackExtractor] Trying alternative extraction methods for:', filePath);
  
  // Try ps2ascii (for PostScript in PDFs)
  try {
    const { stdout } = await execAsync(`ps2ascii "${filePath}"`, { maxBuffer: 10 * 1024 * 1024 });
    if (stdout && stdout.trim().length > 0) {
      console.log('[FallbackExtractor] Success with ps2ascii');
      return stdout;
    }
  } catch (error) {
    console.log('[FallbackExtractor] ps2ascii not available or failed');
  }
  
  // Try pdfinfo to check if PDF is valid
  try {
    const { stdout: pdfInfo } = await execAsync(`pdfinfo "${filePath}"`);
    console.log('[FallbackExtractor] PDF info:', pdfInfo);
  } catch (error) {
    console.error('[FallbackExtractor] PDF might be corrupted');
  }
  
  // Try strings command as last resort
  try {
    const { stdout } = await execAsync(`strings "${filePath}" | grep -E "(Успешно|Сумма|Итого|₽|руб)"`, { maxBuffer: 10 * 1024 * 1024 });
    if (stdout && stdout.trim().length > 0) {
      console.log('[FallbackExtractor] Found some text with strings command');
      return stdout;
    }
  } catch (error) {
    console.log('[FallbackExtractor] strings command failed');
  }
  
  return null;
}

/**
 * Extract text using Node.js streams (for large files)
 */
export async function extractTextUsingStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath);
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      // Try to find text patterns in the buffer
      const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000000)); // First 1MB
      resolve(text);
    });
    
    stream.on('error', reject);
  });
}