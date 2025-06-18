/**
 * Wrapper for pdf-parse to avoid initialization errors
 */

let pdfParse: any = null;
let initializationError: Error | null = null;

// Try to load pdf-parse module
try {
  // This will be loaded on first use, not during module initialization
  const loadPdfParse = () => {
    if (!pdfParse && !initializationError) {
      try {
        pdfParse = require('pdf-parse');
      } catch (error) {
        initializationError = error as Error;
        console.warn('pdf-parse module failed to load:', error);
      }
    }
    
    if (initializationError) {
      throw new Error(`pdf-parse is not available: ${initializationError.message}`);
    }
    
    return pdfParse;
  };

  // Export a function that loads pdf-parse on demand
  module.exports = (dataBuffer: Buffer) => {
    const pdf = loadPdfParse();
    return pdf(dataBuffer);
  };
} catch (error) {
  // If there's an error, export a function that always throws
  module.exports = () => {
    throw new Error('pdf-parse module is not available');
  };
}