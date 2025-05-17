import { config } from '../config';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Simple logger with levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Map log levels to numeric values for comparison
const logLevelValues: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get the configured log level or default to 'info'
const configuredLevel = (config.logger.level as LogLevel) || 'info';
const configuredLevelValue = logLevelValues[configuredLevel];

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Set up file logging
const LOGS_DIR = path.resolve(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Create log filename based on current date/time
const now = new Date();
const logFileName = `server-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.log`;
const logFilePath = path.join(LOGS_DIR, logFileName);

// Create log file stream
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Write startup message to log file
logStream.write(`=== Log started at ${now.toISOString()} ===\n`);

// Timestamp formatter
const timestamp = () => {
  return new Date().toISOString();
};

// Format message for file logging (without colors)
const formatForFile = (level: string, args: any[]): string => {
  const ts = timestamp();
  // Convert objects to strings
  const stringArgs = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  return `[${ts}] ${level}: ${stringArgs}\n`;
};

// Logger implementation
export const logger = {
  debug(...args: any[]): void {
    if (logLevelValues.debug >= configuredLevelValue) {
      // Console output with colors
      console.debug(
        `${colors.dim}[${timestamp()}]${colors.reset} ${colors.cyan}DEBUG${colors.reset}:`,
        ...args
      );

      // File output
      logStream.write(formatForFile('DEBUG', args));
    }
  },

  info(...args: any[]): void {
    if (logLevelValues.info >= configuredLevelValue) {
      // Console output with colors
      console.info(
        `${colors.dim}[${timestamp()}]${colors.reset} ${colors.green}INFO${colors.reset}:`,
        ...args
      );

      // File output
      logStream.write(formatForFile('INFO', args));
    }
  },

  warn(...args: any[]): void {
    if (logLevelValues.warn >= configuredLevelValue) {
      // Console output with colors
      console.warn(
        `${colors.dim}[${timestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}:`,
        ...args
      );

      // File output
      logStream.write(formatForFile('WARN', args));
    }
  },

  error(...args: any[]): void {
    if (logLevelValues.error >= configuredLevelValue) {
      // Console output with colors
      console.error(
        `${colors.dim}[${timestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset}:`,
        ...args
      );

      // File output
      logStream.write(formatForFile('ERROR', args));
    }
  },

  // Ensure logs are properly written when application exits
  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      logStream.end(`=== Log ended at ${new Date().toISOString()} ===\n`, () => {
        resolve();
      });
    });
  }
};