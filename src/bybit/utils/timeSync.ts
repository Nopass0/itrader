/**
 * Time synchronization utility for Bybit API
 * Handles server time offset to fix timestamp mismatches
 */

import axios from 'axios';

export class TimeSync {
  private static serverTimeOffset: number = 0;
  private static lastSync: number = 0;
  private static syncInterval: number = 60 * 60 * 1000; // Sync every hour
  private static isMockMode: boolean = false;
  
  /**
   * Set mock offset for testing
   */
  static setMockOffset(offset: number): void {
    this.isMockMode = true;
    this.serverTimeOffset = offset;
    this.lastSync = Date.now();
  }

  /**
   * Get server time from Bybit API
   */
  private static async fetchServerTime(testnet: boolean = false): Promise<number> {
    const baseUrl = testnet 
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
    
    try {
      const response = await axios.get(`${baseUrl}/v5/market/time`);
      if (response.data.retCode === 0 && response.data.result?.timeSecond) {
        // Bybit returns time in seconds, convert to milliseconds
        return parseInt(response.data.result.timeSecond) * 1000;
      }
      throw new Error('Invalid server time response');
    } catch (error) {
      console.error('[TimeSync] Failed to fetch server time:', error);
      throw error;
    }
  }

  /**
   * Synchronize with server time
   */
  static async sync(testnet: boolean = false): Promise<void> {
    try {
      const localTime = Date.now();
      const serverTime = await this.fetchServerTime(testnet);
      
      // Calculate offset: serverTime - localTime
      this.serverTimeOffset = serverTime - localTime;
      this.lastSync = Date.now();
      
      console.log(`[TimeSync] Time synchronized. Offset: ${this.serverTimeOffset}ms`);
      console.log(`[TimeSync] Local time: ${new Date(localTime).toISOString()}`);
      console.log(`[TimeSync] Server time: ${new Date(serverTime).toISOString()}`);
    } catch (error) {
      console.error('[TimeSync] Synchronization failed:', error);
      // If sync fails, use no offset
      this.serverTimeOffset = 0;
    }
  }

  /**
   * Get synchronized timestamp
   */
  static getTimestamp(): string {
    // Check if we need to resync
    if (!this.isSynchronized()) {
      console.warn('[TimeSync] Not synchronized, using local time');
      return Date.now().toString();
    }
    
    if (Date.now() - this.lastSync > this.syncInterval) {
      // Don't await to avoid blocking, sync will happen in background
      this.sync().catch(err => console.error('[TimeSync] Background sync failed:', err));
    }
    
    // Apply offset to current time
    // Important: The offset might be negative if local time is ahead
    const localTime = Date.now();
    const synchronizedTime = localTime + this.serverTimeOffset;
    
    return synchronizedTime.toString();
  }

  /**
   * Force immediate synchronization
   */
  static async forceSync(testnet: boolean = false): Promise<void> {
    await this.sync(testnet);
  }

  /**
   * Get current offset
   */
  static getOffset(): number {
    return this.serverTimeOffset;
  }

  /**
   * Check if synchronized
   */
  static isSynchronized(): boolean {
    return this.lastSync > 0 && (Date.now() - this.lastSync) < this.syncInterval;
  }

  /**
   * Get synchronized timestamp (number)
   */
  static getSynchronizedTimestamp(): number {
    if (!this.isSynchronized()) {
      console.warn('[TimeSync] Not synchronized, using local time');
      return Date.now();
    }
    
    // Apply offset to current time
    const localTime = Date.now();
    const synchronizedTime = localTime + this.serverTimeOffset;
    
    return synchronizedTime;
  }

  /**
   * Get last sync time
   */
  static getLastSyncTime(): number {
    return this.lastSync;
  }

  /**
   * Clear synchronization
   */
  static clear(): void {
    this.serverTimeOffset = 0;
    this.lastSync = 0;
  }
}