import { createLogger } from '../logger';
import { db } from '../db';

const logger = createLogger('LogCleanupService');

export interface LogCleanupConfig {
  enabled: boolean;
  intervalDays: number;
  runAtHour: number; // Hour of day to run cleanup (0-23)
}

export class LogCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private config: LogCleanupConfig;
  
  constructor() {
    this.config = {
      enabled: true,
      intervalDays: 1,
      runAtHour: 3 // 3 AM by default
    };
  }

  async loadConfig() {
    try {
      const enabled = await db.getSetting('logCleanupEnabled');
      const intervalDays = await db.getSetting('logCleanupIntervalDays');
      const runAtHour = await db.getSetting('logCleanupRunAtHour');
      
      this.config = {
        enabled: enabled !== 'false',
        intervalDays: intervalDays ? parseInt(intervalDays) : 1,
        runAtHour: runAtHour ? parseInt(runAtHour) : 3
      };
      
      logger.info('Log cleanup config loaded', this.config);
    } catch (error) {
      logger.error('Failed to load log cleanup config', error as Error);
    }
  }

  async saveConfig(config: Partial<LogCleanupConfig>) {
    try {
      if (config.enabled !== undefined) {
        await db.setSetting('logCleanupEnabled', config.enabled.toString());
        this.config.enabled = config.enabled;
      }
      
      if (config.intervalDays !== undefined) {
        await db.setSetting('logCleanupIntervalDays', config.intervalDays.toString());
        this.config.intervalDays = config.intervalDays;
      }
      
      if (config.runAtHour !== undefined) {
        await db.setSetting('logCleanupRunAtHour', config.runAtHour.toString());
        this.config.runAtHour = config.runAtHour;
      }
      
      logger.info('Log cleanup config saved', this.config);
      
      // Restart the service with new config
      await this.stop();
      await this.start();
    } catch (error) {
      logger.error('Failed to save log cleanup config', error as Error);
      throw error;
    }
  }

  async start() {
    await this.loadConfig();
    
    if (!this.config.enabled) {
      logger.info('Log cleanup service is disabled');
      return;
    }
    
    // Calculate time until next run
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(this.config.runAtHour, 0, 0, 0);
    
    // If the time has already passed today, set it for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const timeUntilNextRun = nextRun.getTime() - now.getTime();
    
    logger.info('Log cleanup service started', {
      nextRun: nextRun.toISOString(),
      timeUntilNextRun: Math.round(timeUntilNextRun / 1000 / 60) + ' minutes'
    });
    
    // Schedule the first run
    setTimeout(() => {
      this.performCleanup();
      
      // Then schedule recurring runs every 24 hours
      this.intervalId = setInterval(() => {
        this.performCleanup();
      }, 24 * 60 * 60 * 1000);
    }, timeUntilNextRun);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Log cleanup service stopped');
    }
  }

  async performCleanup() {
    try {
      logger.info('Starting log cleanup', { intervalDays: this.config.intervalDays });
      
      const deletedCount = await logger.cleanOldLogs(this.config.intervalDays);
      
      logger.info('Log cleanup completed', { deletedCount });
    } catch (error) {
      logger.error('Log cleanup failed', error as Error);
    }
  }

  getConfig(): LogCleanupConfig {
    return { ...this.config };
  }
}

// Singleton instance
let instance: LogCleanupService | null = null;

export function getLogCleanupService(): LogCleanupService {
  if (!instance) {
    instance = new LogCleanupService();
  }
  return instance;
}