/**
 * Exchange Rate Manager
 * Manages exchange rates for P2P advertisements with support for constant and automatic modes
 */

import { db } from "../db";
import { createLogger } from "../logger";
import { PrismaClient } from "../../generated/prisma";
import { BybitP2PRateFetcher } from "./bybitP2PRateFetcher";
import { P2PConfig } from "../bybit/types/p2p";

const logger = createLogger('ExchangeRateManager');
const prisma = new PrismaClient();

export type ExchangeRateMode = "constant" | "automatic";

interface ExchangeRateConfig {
  mode: ExchangeRateMode;
  constantRate: number;
  updateInterval: number;
  fallbackRate: number;
  lastUpdate: Date;
}

interface ExchangeRateRule {
  id: string;
  name: string;
  priority: number;
  timeStart?: string | null;
  timeEnd?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  pageNumber: number;
  adIndex: number;
  priceAdjustment: number;
  enabled: boolean;
}

class ExchangeRateManager {
  private static instance: ExchangeRateManager;
  private config: ExchangeRateConfig;
  private rateUpdateListeners: ((rate: number) => void)[] = [];
  private initialized: boolean = false;
  private updateInterval?: NodeJS.Timeout;
  private rateFetcher?: BybitP2PRateFetcher;
  private lastFetchedRate?: number;
  private lastFetchTime?: Date;

  private constructor() {
    this.config = {
      mode: "constant",
      constantRate: 78,
      updateInterval: 300000, // 5 minutes
      fallbackRate: 78,
      lastUpdate: new Date(),
    };
  }

  /**
   * Initialize the manager by loading settings from database
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Load or create config from database
      let dbConfig = await prisma.exchangeRateConfig.findUnique({
        where: { id: 'default' }
      });

      if (!dbConfig) {
        // Create default config
        dbConfig = await prisma.exchangeRateConfig.create({
          data: {
            id: 'default',
            mode: 'constant',
            constantRate: 78,
            updateInterval: 300000,
            fallbackRate: 78
          }
        });
      }

      this.config = {
        mode: dbConfig.mode as ExchangeRateMode,
        constantRate: dbConfig.constantRate,
        updateInterval: dbConfig.updateInterval,
        fallbackRate: dbConfig.fallbackRate,
        lastUpdate: dbConfig.lastUpdate
      };

      // Initialize rate fetcher if we have any Bybit account
      try {
        const bybitAccounts = await prisma.platformAccount.findMany({
          where: {
            platform: 'bybit',
            isActive: true
          },
          take: 1
        });

        if (bybitAccounts.length > 0) {
          const account = bybitAccounts[0];
          const credentials = account.credentials as any;
          
          if (credentials?.apiKey && credentials?.apiSecret) {
            const p2pConfig: P2PConfig = {
              apiKey: credentials.apiKey,
              apiSecret: credentials.apiSecret,
              testnet: false,
              debugMode: false
            };
            this.rateFetcher = new BybitP2PRateFetcher(p2pConfig);
          }
        }
      } catch (error) {
        logger.warn('Failed to initialize Bybit rate fetcher', error as Error);
      }

      this.initialized = true;
      
      logger.info('ExchangeRateManager initialized', {
        mode: this.config.mode,
        constantRate: this.config.constantRate,
        updateInterval: this.config.updateInterval,
        hasBybitCredentials: !!this.rateFetcher
      });

      // Start automatic updates if in automatic mode
      if (this.config.mode === 'automatic') {
        this.startAutomaticUpdates();
      }
    } catch (error) {
      logger.error('Failed to initialize ExchangeRateManager', error as Error);
    }
  }

  /**
   * Get the singleton instance of ExchangeRateManager
   */
  public static getInstance(): ExchangeRateManager {
    if (!ExchangeRateManager.instance) {
      ExchangeRateManager.instance = new ExchangeRateManager();
    }
    return ExchangeRateManager.instance;
  }

  /**
   * Get the current exchange rate
   * @returns The current exchange rate based on the active mode
   */
  public async getRate(): Promise<number> {
    // Ensure we're initialized
    await this.initialize();
    
    switch (this.config.mode) {
      case "constant":
        return this.config.constantRate;
      case "automatic":
        // Return last fetched rate if available and recent (within update interval)
        if (this.lastFetchedRate && this.lastFetchTime) {
          const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
          if (timeSinceLastFetch < this.config.updateInterval) {
            return this.lastFetchedRate;
          }
        }
        
        // Otherwise, fetch new rate
        try {
          const rate = await this.fetchAutomaticRate();
          return rate;
        } catch (error) {
          logger.error("Failed to fetch automatic rate, using fallback", error as Error);
          return this.config.fallbackRate;
        }
      default:
        return this.config.constantRate;
    }
  }

  /**
   * Fetch rate based on automatic rules
   */
  private async fetchAutomaticRate(): Promise<number> {
    if (!this.rateFetcher) {
      throw new Error("Bybit credentials not configured");
    }

    // Get enabled rules sorted by priority
    const rules = await prisma.exchangeRateRule.findMany({
      where: { enabled: true },
      orderBy: { priority: 'desc' }
    });

    if (rules.length === 0) {
      logger.warn("No automatic rate rules configured, using fallback rate");
      return this.config.fallbackRate;
    }

    // Find the first matching rule
    const currentTime = new Date();
    const currentHourMinute = currentTime.getHours() * 100 + currentTime.getMinutes();

    for (const rule of rules) {
      if (this.isRuleApplicable(rule, currentHourMinute)) {
        try {
          logger.info(`Applying rate rule: ${rule.name}`, { 
            pageNumber: rule.pageNumber, 
            adIndex: rule.adIndex 
          });

          const baseRate = await this.rateFetcher.fetchRate({
            pageNumber: rule.pageNumber,
            adIndex: rule.adIndex,
            side: 'sell' // We buy USDT, so we look at sell ads
          });

          // Apply price adjustment
          const adjustedRate = baseRate * (1 + rule.priceAdjustment / 100);
          
          this.lastFetchedRate = adjustedRate;
          this.lastFetchTime = new Date();

          // Save to history
          await this.saveRateToHistory(adjustedRate, 'automatic', {
            rule: rule.name,
            baseRate,
            adjustment: rule.priceAdjustment,
            pageNumber: rule.pageNumber,
            adIndex: rule.adIndex
          });

          return adjustedRate;
        } catch (error) {
          logger.error(`Failed to apply rule ${rule.name}`, error as Error);
          // Continue to next rule
        }
      }
    }

    logger.warn("No applicable rules found, using fallback rate");
    return this.config.fallbackRate;
  }

  /**
   * Check if a rule is applicable based on current time and amount
   */
  private isRuleApplicable(rule: ExchangeRateRule, currentHourMinute: number): boolean {
    // Check time window
    if (rule.timeStart && rule.timeEnd) {
      const startTime = this.parseTime(rule.timeStart);
      const endTime = this.parseTime(rule.timeEnd);
      
      if (startTime && endTime) {
        // Handle cases where end time is next day (e.g., 23:00 - 02:00)
        if (endTime < startTime) {
          if (currentHourMinute < startTime && currentHourMinute > endTime) {
            return false;
          }
        } else {
          if (currentHourMinute < startTime || currentHourMinute > endTime) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Parse time string (HH:MM) to hour*100 + minute
   */
  private parseTime(timeStr: string): number | null {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    
    return hours * 100 + minutes;
  }

  /**
   * Start automatic rate updates
   */
  private startAutomaticUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Initial update
    this.updateRateAsync().catch(error => {
      logger.error("Failed initial automatic rate update", error as Error);
    });

    // Schedule periodic updates
    this.updateInterval = setInterval(() => {
      this.updateRateAsync().catch(error => {
        logger.error("Failed automatic rate update", error as Error);
      });
    }, this.config.updateInterval);

    logger.info("Started automatic rate updates", { 
      interval: this.config.updateInterval 
    });
  }

  /**
   * Stop automatic rate updates
   */
  private stopAutomaticUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
      logger.info("Stopped automatic rate updates");
    }
  }

  /**
   * Set a new exchange rate (works in constant mode)
   * @param rate The new exchange rate
   */
  public async setRate(rate: number): Promise<void> {
    if (rate <= 0) {
      throw new Error("Exchange rate must be positive");
    }

    this.config.constantRate = rate;
    this.config.lastUpdate = new Date();
    
    // Update database
    await prisma.exchangeRateConfig.update({
      where: { id: 'default' },
      data: { 
        constantRate: rate,
        lastUpdate: new Date()
      }
    });

    // Save to history
    await this.saveRateToHistory(rate, 'manual', { mode: 'constant' });

    // Notify listeners
    this.notifyListeners(rate);

    logger.info(`Exchange rate updated to ${rate} RUB/USDT`, { rate });
  }

  /**
   * Set the exchange rate mode
   * @param mode The mode to set ('constant' or 'automatic')
   */
  public async setMode(mode: ExchangeRateMode): Promise<void> {
    if (mode !== "constant" && mode !== "automatic") {
      throw new Error(
        `Invalid mode: ${mode}. Must be 'constant' or 'automatic'`,
      );
    }

    const previousMode = this.config.mode;
    this.config.mode = mode;

    // Update database
    await prisma.exchangeRateConfig.update({
      where: { id: 'default' },
      data: { mode }
    });

    logger.info(`Exchange rate mode changed from ${previousMode} to ${mode}`);

    if (mode === "automatic") {
      if (!this.rateFetcher) {
        logger.warn("Automatic mode selected but Bybit credentials not configured");
      } else {
        this.startAutomaticUpdates();
      }
    } else {
      this.stopAutomaticUpdates();
    }
  }

  /**
   * Get the current configuration
   * @returns The current exchange rate configuration
   */
  public getConfig(): Readonly<ExchangeRateConfig> {
    return { ...this.config };
  }

  /**
   * Add a listener for rate updates
   * @param listener Function to call when rate is updated
   * @returns Function to remove the listener
   */
  public onRateUpdate(listener: (rate: number) => void): () => void {
    this.rateUpdateListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.rateUpdateListeners.indexOf(listener);
      if (index > -1) {
        this.rateUpdateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of a rate update
   * @param rate The new rate
   */
  private notifyListeners(rate: number): void {
    this.rateUpdateListeners.forEach((listener) => {
      try {
        listener(rate);
      } catch (error) {
        logger.error("Error in rate update listener", error as Error);
      }
    });
  }

  /**
   * Update the rate asynchronously (useful for automatic mode)
   * @returns Promise that resolves to the new rate
   */
  public async updateRateAsync(): Promise<number> {
    if (this.config.mode === "automatic") {
      try {
        const newRate = await this.fetchAutomaticRate();
        this.notifyListeners(newRate);
        return newRate;
      } catch (error) {
        logger.error("Failed to update automatic rate", error as Error);
        return this.config.fallbackRate;
      }
    }

    return this.getRate();
  }

  /**
   * Save rate to history
   */
  private async saveRateToHistory(rate: number, source: string, metadata?: any): Promise<void> {
    try {
      await prisma.exchangeRateHistory.create({
        data: {
          rate,
          source,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        }
      });
    } catch (error) {
      logger.error("Failed to save rate to history", error as Error);
    }
  }

  /**
   * Update configuration
   */
  public async updateConfig(updates: Partial<ExchangeRateConfig>): Promise<void> {
    await this.initialize();

    const updatedConfig = { ...this.config, ...updates };
    
    await prisma.exchangeRateConfig.update({
      where: { id: 'default' },
      data: {
        mode: updatedConfig.mode,
        constantRate: updatedConfig.constantRate,
        updateInterval: updatedConfig.updateInterval,
        fallbackRate: updatedConfig.fallbackRate,
        lastUpdate: new Date()
      }
    });

    this.config = updatedConfig;

    // Restart automatic updates if interval changed
    if (this.config.mode === 'automatic' && updates.updateInterval !== undefined) {
      this.stopAutomaticUpdates();
      this.startAutomaticUpdates();
    }

    logger.info("Exchange rate configuration updated", updatedConfig);
  }

  /**
   * Get rate rules
   */
  public async getRules(): Promise<ExchangeRateRule[]> {
    const rules = await prisma.exchangeRateRule.findMany({
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' }
      ]
    });
    return rules;
  }

  /**
   * Create a new rate rule
   */
  public async createRule(rule: Omit<ExchangeRateRule, 'id'>): Promise<ExchangeRateRule> {
    const created = await prisma.exchangeRateRule.create({
      data: rule
    });
    
    logger.info("Created exchange rate rule", { ruleName: rule.name });
    return created;
  }

  /**
   * Update a rate rule
   */
  public async updateRule(id: string, updates: Partial<ExchangeRateRule>): Promise<ExchangeRateRule> {
    const updated = await prisma.exchangeRateRule.update({
      where: { id },
      data: updates
    });
    
    logger.info("Updated exchange rate rule", { ruleId: id, updates });
    return updated;
  }

  /**
   * Delete a rate rule
   */
  public async deleteRule(id: string): Promise<void> {
    await prisma.exchangeRateRule.delete({
      where: { id }
    });
    
    logger.info("Deleted exchange rate rule", { ruleId: id });
  }

  /**
   * Test a rate rule without applying it
   */
  public async testRule(rule: Omit<ExchangeRateRule, 'id'>): Promise<{ rate: number; metadata: any }> {
    if (!this.rateFetcher) {
      throw new Error("Bybit credentials not configured");
    }

    try {
      const baseRate = await this.rateFetcher.fetchRate({
        pageNumber: rule.pageNumber,
        adIndex: rule.adIndex,
        side: 'sell'
      });

      const adjustedRate = baseRate * (1 + rule.priceAdjustment / 100);
      
      return {
        rate: adjustedRate,
        metadata: {
          baseRate,
          adjustment: rule.priceAdjustment,
          pageNumber: rule.pageNumber,
          adIndex: rule.adIndex
        }
      };
    } catch (error) {
      logger.error("Failed to test rule", error as Error, { rule });
      throw error;
    }
  }

  /**
   * Get rate statistics from Bybit P2P
   */
  public async getRateStatistics(pageNumber: number = 1): Promise<any> {
    if (!this.rateFetcher) {
      throw new Error("Bybit credentials not configured");
    }

    return await this.rateFetcher.getRateStatistics(pageNumber, 'sell');
  }

  /**
   * Reset to default configuration
   */
  public async reset(): Promise<void> {
    this.stopAutomaticUpdates();
    
    this.config = {
      mode: "constant",
      constantRate: 78,
      updateInterval: 300000,
      fallbackRate: 78,
      lastUpdate: new Date(),
    };

    await prisma.exchangeRateConfig.update({
      where: { id: 'default' },
      data: this.config
    });

    logger.info("Exchange rate manager reset to defaults");
  }
}

// Export singleton instance getter
export const getExchangeRateManager = (): ExchangeRateManager => {
  return ExchangeRateManager.getInstance();
};

// Export the class for type checking
export { ExchangeRateManager };