import { proxyService } from './proxyService.js';
import { proxyFetcher } from './proxyFetcher.js';

export class ProxyManager {
  private static instance: ProxyManager;
  private isInitialized = false;
  private healthMonitorInterval: NodeJS.Timeout | null = null;
  private autoCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {}

  static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  // Initialize all proxy services
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[ProxyManager] Already initialized');
      return;
    }

    try {
      console.log('[ProxyManager] Initializing proxy management system...');

      // Start proxy fetcher to get initial proxies
      console.log('[ProxyManager] Starting proxy fetcher...');
      proxyFetcher.start();

      // Wait a bit for initial proxies to be fetched
      console.log('[ProxyManager] Waiting for initial proxy fetch...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Start proxy checker service with more frequent checks
      console.log('[ProxyManager] Starting proxy checker...');
      proxyService.startChecker();

      // Start continuous health monitoring
      this.startContinuousMonitoring();

      // Get initial stats
      const stats = await proxyService.getProxyStats();
      console.log('[ProxyManager] Initial proxy stats:', stats);

      this.isInitialized = true;
      console.log('[ProxyManager] Proxy management system initialized successfully');

    } catch (error) {
      console.error('[ProxyManager] Error initializing proxy system:', error);
      throw error;
    }
  }

  // Start continuous health monitoring
  private startContinuousMonitoring() {
    console.log('[ProxyManager] Starting continuous health monitoring...');
    
    // Health monitoring every 5 minutes
    this.healthMonitorInterval = setInterval(async () => {
      try {
        const stats = await proxyService.getProxyStats();
        console.log(`[ProxyManager] Health check - Active: ${stats.active}, Failed: ${stats.failed}, Working rate: ${((stats.active / (stats.active + stats.failed)) * 100).toFixed(1)}%`);
        
        // If we have too few active proxies, trigger emergency fetch
        if (stats.active < 10) {
          console.log('[ProxyManager] Low active proxy count, triggering emergency fetch...');
          await this.emergencyProxyFetch();
        }
        
        // Auto-clean failed proxies if too many
        if (stats.failed > 100) {
          console.log('[ProxyManager] Too many failed proxies, cleaning up...');
          await proxyService.cleanupFailedProxies(12);
        }
      } catch (error) {
        console.error('[ProxyManager] Error in health monitoring:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Auto cleanup every hour
    this.autoCleanupInterval = setInterval(async () => {
      try {
        const cleaned = await proxyService.cleanupFailedProxies(6);
        if (cleaned > 0) {
          console.log(`[ProxyManager] Auto-cleanup removed ${cleaned} old failed proxies`);
        }
      } catch (error) {
        console.error('[ProxyManager] Error in auto-cleanup:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  // Emergency proxy fetch when running low
  private async emergencyProxyFetch() {
    try {
      console.log('[ProxyManager] Emergency proxy fetch initiated...');
      
      // Fetch from multiple sources in parallel
      const fetchPromises = proxyFetcher.getSources().slice(0, 5).map(source => 
        proxyFetcher.fetchManual(source.name).catch(err => {
          console.error(`[ProxyManager] Emergency fetch from ${source.name} failed:`, err.message);
          return 0;
        })
      );
      
      const results = await Promise.all(fetchPromises);
      const totalFetched = results.reduce((sum, count) => sum + count, 0);
      
      console.log(`[ProxyManager] Emergency fetch completed: ${totalFetched} new proxies`);
      
      if (totalFetched > 0) {
        // Trigger immediate proxy check for new proxies
        proxyService.stopChecker();
        proxyService.startChecker();
      }
    } catch (error) {
      console.error('[ProxyManager] Emergency proxy fetch failed:', error);
    }
  }

  // Shutdown all proxy services
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('[ProxyManager] Shutting down proxy management system...');

    try {
      // Stop all intervals
      if (this.healthMonitorInterval) {
        clearInterval(this.healthMonitorInterval);
        this.healthMonitorInterval = null;
      }
      if (this.autoCleanupInterval) {
        clearInterval(this.autoCleanupInterval);
        this.autoCleanupInterval = null;
      }
      
      proxyService.stopChecker();
      proxyFetcher.stop();
      
      this.isInitialized = false;
      console.log('[ProxyManager] Proxy management system shut down');
    } catch (error) {
      console.error('[ProxyManager] Error shutting down proxy system:', error);
    }
  }

  // Get system status
  async getStatus(): Promise<{
    isInitialized: boolean;
    stats: any;
    sources: any[];
  }> {
    const stats = await proxyService.getProxyStats();
    const sources = proxyFetcher.getSources();

    return {
      isInitialized: this.isInitialized,
      stats,
      sources: sources.map(s => ({ name: s.name, url: s.url, format: s.format }))
    };
  }

  // Manual operations
  async addCustomProxy(host: string, port: number, options?: {
    username?: string;
    password?: string;
    protocol?: string;
    country?: string;
  }): Promise<number | null> {
    return await proxyService.addProxy(host, port, {
      ...options,
      source: 'manual'
    });
  }

  async cleanupOldProxies(): Promise<number> {
    return await proxyService.cleanupFailedProxies(24);
  }

  async forceProxyCheck(): Promise<void> {
    console.log('[ProxyManager] Force checking all proxies...');
    // Stop current checker
    proxyService.stopChecker();
    
    // Start it again to trigger immediate check
    proxyService.startChecker();
  }

  async fetchFromCustomSource(url: string, apiKey?: string): Promise<number> {
    return await proxyFetcher.fetchFromPremiumSource(url, apiKey);
  }
}

export const proxyManager = ProxyManager.getInstance();