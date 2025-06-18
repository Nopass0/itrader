/**
 * Signature utilities for Bybit API authentication
 */

import crypto from 'crypto';
import { TimeSync } from './timeSync';

export class SignatureUtils {
  /**
   * Generate HMAC signature for API requests
   */
  static generateSignature(
    timestamp: string,
    apiKey: string,
    recvWindow: string,
    queryString: string,
    apiSecret: string
  ): string {
    const message = timestamp + apiKey + recvWindow + queryString;
    return crypto
      .createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Generate query string from parameters
   */
  static generateQueryString(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const queryParts: string[] = [];
    
    for (const key of sortedKeys) {
      if (params[key] !== undefined && params[key] !== null) {
        queryParts.push(`${key}=${params[key]}`);
      }
    }
    
    return queryParts.join('&');
  }

  /**
   * Get current timestamp in milliseconds
   */
  static getTimestamp(): string {
    // Use synchronized time to handle system clock offset
    return TimeSync.getTimestamp();
  }
}