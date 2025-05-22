import { PrismaClient } from '@prisma/client';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const prisma = new PrismaClient();

export interface ProxyConfig {
  id: number;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: string;
  responseTime?: number;
  successRate?: number;
}

export class ProxyService {
  private static instance: ProxyService;
  private activeProxies: ProxyConfig[] = [];
  private currentProxyIndex = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadActiveProxies();
  }

  static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  // Start the proxy checker service
  startChecker() {
    if (this.checkInterval) return;
    
    console.log('[ProxyService] Starting proxy checker (every 10 minutes)...');
    
    // Initial check
    this.checkAllProxies();
    
    // Check every 10 minutes
    this.checkInterval = setInterval(() => {
      this.checkAllProxies();
    }, 10 * 60 * 1000);
  }

  // Stop the proxy checker
  stopChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[ProxyService] Proxy checker stopped');
    }
  }

  // Load active proxies from database - only good ones
  private async loadActiveProxies() {
    try {
      const proxies = await prisma.proxy.findMany({
        where: {
          isActive: true,
          status: 'active',
          // Only load proxies with good success rates
          successRate: {
            gte: 0.7 // At least 70% success rate
          },
          // Exclude proxies with too many recent failures
          failureCount: {
            lt: 10
          },
          // Only recently checked proxies
          lastChecked: {
            gte: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
          }
        },
        orderBy: [
          { successRate: 'desc' },
          { responseTime: 'asc' },
          { lastUsed: 'desc' }
        ]
      });

      this.activeProxies = proxies.map(proxy => ({
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
        protocol: proxy.protocol,
        responseTime: proxy.responseTime || undefined,
        successRate: proxy.successRate || undefined
      }));

      console.log(`[ProxyService] Loaded ${this.activeProxies.length} active high-quality proxies`);
      
      // If we have too few proxies, relax the criteria
      if (this.activeProxies.length < 5) {
        await this.loadActiveProxiesRelaxed();
      }
    } catch (error) {
      console.error('[ProxyService] Error loading active proxies:', error);
      this.activeProxies = [];
    }
  }

  // Load active proxies with relaxed criteria if we don't have enough good ones
  private async loadActiveProxiesRelaxed() {
    try {
      const proxies = await prisma.proxy.findMany({
        where: {
          isActive: true,
          status: 'active',
          // More relaxed criteria
          successRate: {
            gte: 0.3 // At least 30% success rate
          },
          failureCount: {
            lt: 20
          }
        },
        orderBy: [
          { successRate: 'desc' },
          { responseTime: 'asc' }
        ],
        take: 20 // Limit to prevent too many bad proxies
      });

      this.activeProxies = proxies.map(proxy => ({
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
        protocol: proxy.protocol,
        responseTime: proxy.responseTime || undefined,
        successRate: proxy.successRate || undefined
      }));

      console.log(`[ProxyService] Loaded ${this.activeProxies.length} active proxies (relaxed criteria)`);
    } catch (error) {
      console.error('[ProxyService] Error loading relaxed active proxies:', error);
    }
  }

  // Get next proxy for rotation
  getNextProxy(): ProxyConfig | null {
    if (this.activeProxies.length === 0) {
      return null;
    }

    const proxy = this.activeProxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.activeProxies.length;
    
    // Update last used time
    this.updateProxyLastUsed(proxy.id);
    
    return proxy;
  }

  // Get random proxy (for load balancing) with weighted selection based on success rate
  getRandomProxy(): ProxyConfig | null {
    if (this.activeProxies.length === 0) {
      return null;
    }

    // Use weighted random selection based on success rate
    const proxiesWithWeights = this.activeProxies.map(proxy => ({
      ...proxy,
      weight: (proxy.successRate || 0.5) * 100 // Higher success rate = higher weight
    }));

    const totalWeight = proxiesWithWeights.reduce((sum, proxy) => sum + proxy.weight, 0);
    let random = Math.random() * totalWeight;

    for (const proxy of proxiesWithWeights) {
      random -= proxy.weight;
      if (random <= 0) {
        // Update last used time
        this.updateProxyLastUsed(proxy.id);
        return proxy;
      }
    }

    // Fallback to first proxy if something goes wrong
    const proxy = this.activeProxies[0];
    this.updateProxyLastUsed(proxy.id);
    return proxy;
  }

  // Get the best proxy (highest success rate and lowest response time)
  getBestProxy(): ProxyConfig | null {
    if (this.activeProxies.length === 0) {
      return null;
    }

    // Find proxy with best combination of success rate and response time
    let bestProxy = this.activeProxies[0];
    let bestScore = this.calculateProxyScore(bestProxy);

    for (const proxy of this.activeProxies) {
      const score = this.calculateProxyScore(proxy);
      if (score > bestScore) {
        bestScore = score;
        bestProxy = proxy;
      }
    }

    // Update last used time
    this.updateProxyLastUsed(bestProxy.id);
    return bestProxy;
  }

  // Calculate proxy quality score
  private calculateProxyScore(proxy: ProxyConfig): number {
    const successRate = proxy.successRate || 0.5;
    const responseTime = proxy.responseTime || 10000; // Default 10s if unknown
    
    // Higher success rate is better, lower response time is better
    // Score = success_rate * (1 / normalized_response_time)
    const normalizedResponseTime = Math.max(responseTime / 1000, 0.1); // Convert to seconds, min 0.1s
    return successRate * (1 / normalizedResponseTime);
  }

  // Create proxy agent for fetch requests
  createProxyAgent(proxy: ProxyConfig): any {
    const auth = proxy.username && proxy.password ? 
      `${proxy.username}:${proxy.password}@` : '';
    
    const proxyUrl = `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;

    switch (proxy.protocol) {
      case 'socks5':
        return new SocksProxyAgent(proxyUrl);
      case 'http':
        return new HttpProxyAgent(proxyUrl);
      case 'https':
        return new HttpsProxyAgent(proxyUrl);
      default:
        throw new Error(`Unsupported proxy protocol: ${proxy.protocol}`);
    }
  }

  // Get our real IP address for comparison
  private async getRealIP(): Promise<string | null> {
    try {
      const response = await fetch('https://httpbin.org/ip', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        return data.origin;
      }
    } catch (error) {
      console.error('[ProxyService] Failed to get real IP:', error);
    }
    return null;
  }

  // Test a single proxy - check connectivity, response time, and IP change
  async testProxy(proxy: ProxyConfig): Promise<{ success: boolean; responseTime?: number; error?: string; proxyIP?: string; realIP?: string }> {
    const startTime = Date.now();
    
    try {
      const agent = this.createProxyAgent(proxy);
      
      // List of IP checking services to try
      const testUrls = [
        'https://httpbin.org/ip',
        'https://api.ipify.org?format=json',
        'https://ip-api.com/json',
        'https://ipinfo.io/json'
      ];

      let proxyIP: string | null = null;
      let realIP: string | null = null;

      // Get real IP first for comparison
      realIP = await this.getRealIP();

      // Test proxy with multiple services as fallback
      for (const url of testUrls) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(15000), // 15 second timeout
            // @ts-ignore
            agent: agent
          });

          const responseTime = Date.now() - startTime;

          if (response.ok) {
            const data = await response.json();
            
            // Extract IP from different response formats
            if (data.origin) {
              proxyIP = data.origin; // httpbin.org format
            } else if (data.ip) {
              proxyIP = data.ip; // ipify and ip-api format
            } else if (data.query) {
              proxyIP = data.query; // ip-api format
            }

            if (proxyIP) {
              // Validate that the IP actually changed
              const ipChanged = realIP && proxyIP !== realIP;
              
              if (ipChanged) {
                console.log(`[ProxyService] ✅ Proxy ${proxy.host}:${proxy.port} working correctly (${responseTime}ms)`);
                console.log(`[ProxyService]    Real IP: ${realIP} → Proxy IP: ${proxyIP}`);
                return { 
                  success: true, 
                  responseTime, 
                  proxyIP,
                  realIP: realIP || undefined
                };
              } else {
                console.log(`[ProxyService] ❌ Proxy ${proxy.host}:${proxy.port} NOT working - IP not changed`);
                console.log(`[ProxyService]    Real IP: ${realIP} → Proxy IP: ${proxyIP} (same!)`);
                return { 
                  success: false, 
                  error: `IP not changed (${proxyIP})`,
                  proxyIP,
                  realIP: realIP || undefined
                };
              }
            }
          }
        } catch (urlError: any) {
          console.log(`[ProxyService] Failed to test proxy with ${url}:`, urlError.message);
          continue; // Try next URL
        }
      }

      return { success: false, error: 'All test URLs failed' };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.log(`[ProxyService] ❌ Proxy ${proxy.host}:${proxy.port} test failed (${responseTime}ms):`, error.message);
      return { success: false, responseTime, error: error.message };
    }
  }

  // Check all proxies in the database
  private async checkAllProxies() {
    try {
      console.log('[ProxyService] Starting proxy validation check...');
      
      const allProxies = await prisma.proxy.findMany({
        where: { isActive: true }
      });

      console.log(`[ProxyService] Checking ${allProxies.length} proxies...`);

      const results = await Promise.allSettled(
        allProxies.map(async (dbProxy) => {
          const proxy: ProxyConfig = {
            id: dbProxy.id,
            host: dbProxy.host,
            port: dbProxy.port,
            username: dbProxy.username || undefined,
            password: dbProxy.password || undefined,
            protocol: dbProxy.protocol
          };

          const testResult = await this.testProxy(proxy);
          
          // Update database with test results
          await this.updateProxyStatus(dbProxy.id, testResult);
          
          return { proxy, result: testResult };
        })
      );

      // Count results
      let successful = 0;
      let failed = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.result.success) {
          successful++;
        } else {
          failed++;
        }
      });

      console.log(`[ProxyService] Proxy check completed: ${successful} working, ${failed} failed`);
      
      // Reload active proxies after check
      await this.loadActiveProxies();
      
    } catch (error) {
      console.error('[ProxyService] Error during proxy check:', error);
    }
  }

  // Update proxy status in database
  private async updateProxyStatus(proxyId: number, testResult: { success: boolean; responseTime?: number; error?: string; proxyIP?: string; realIP?: string }) {
    try {
      const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
      if (!proxy) return;

      let newSuccessRate = proxy.successRate || 0;
      let newStatus = proxy.status;
      let newFailureCount = proxy.failureCount;
      let newSuccessCount = proxy.successCount;

      let totalTests: number;
      
      if (testResult.success) {
        newSuccessCount++;
        newFailureCount = 0; // Reset consecutive failures
        newStatus = 'active';
        
        // Calculate success rate (weighted average)
        totalTests = newSuccessCount + proxy.failureCount;
        newSuccessRate = totalTests > 0 ? newSuccessCount / totalTests : 1.0;
      } else {
        newFailureCount++;
        
        // Calculate success rate first
        totalTests = newSuccessCount + newFailureCount;
        newSuccessRate = totalTests > 0 ? newSuccessCount / totalTests : 0.0;
        
        // Mark as failed if too many consecutive failures or low success rate
        if (newFailureCount >= 5 || (totalTests >= 10 && newSuccessRate < 0.2)) {
          newStatus = 'failed';
        }
      }

      await prisma.proxy.update({
        where: { id: proxyId },
        data: {
          status: newStatus,
          responseTime: testResult.responseTime,
          successRate: newSuccessRate,
          lastChecked: new Date(),
          failureCount: newFailureCount,
          successCount: newSuccessCount,
          verifiedIP: testResult.proxyIP || null,
          notes: testResult.error || (testResult.proxyIP ? `Verified IP: ${testResult.proxyIP}` : null)
        }
      });

    } catch (error) {
      console.error(`[ProxyService] Error updating proxy ${proxyId}:`, error);
    }
  }

  // Update last used time for a proxy
  private async updateProxyLastUsed(proxyId: number) {
    try {
      await prisma.proxy.update({
        where: { id: proxyId },
        data: { lastUsed: new Date() }
      });
    } catch (error) {
      console.error(`[ProxyService] Error updating proxy last used time:`, error);
    }
  }

  // Mark proxy as successful after actual use
  async markProxySuccess(proxyId: number, responseTime?: number) {
    try {
      const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
      if (!proxy) return;

      const newSuccessCount = proxy.successCount + 1;
      const totalTests = newSuccessCount + proxy.failureCount;
      const newSuccessRate = totalTests > 0 ? newSuccessCount / totalTests : 1.0;

      await prisma.proxy.update({
        where: { id: proxyId },
        data: {
          successCount: newSuccessCount,
          successRate: newSuccessRate,
          lastUsed: new Date(),
          status: 'active',
          responseTime: responseTime || proxy.responseTime,
          failureCount: 0 // Reset consecutive failures on success
        }
      });

      console.log(`[ProxyService] Marked proxy ${proxy.host}:${proxy.port} as successful (rate: ${(newSuccessRate * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error(`[ProxyService] Error marking proxy success:`, error);
    }
  }

  // Mark proxy as failed after actual use
  async markProxyFailure(proxyId: number, error?: string) {
    try {
      const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
      if (!proxy) return;

      const newFailureCount = proxy.failureCount + 1;
      const totalTests = proxy.successCount + newFailureCount;
      const newSuccessRate = totalTests > 0 ? proxy.successCount / totalTests : 0.0;

      // Determine new status
      let newStatus = proxy.status;
      if (newFailureCount >= 5 || (totalTests >= 10 && newSuccessRate < 0.2)) {
        newStatus = 'failed';
      }

      await prisma.proxy.update({
        where: { id: proxyId },
        data: {
          failureCount: newFailureCount,
          successRate: newSuccessRate,
          lastUsed: new Date(),
          status: newStatus,
          notes: error || proxy.notes
        }
      });

      console.log(`[ProxyService] Marked proxy ${proxy.host}:${proxy.port} as failed (failures: ${newFailureCount}, rate: ${(newSuccessRate * 100).toFixed(1)}%)`);
      
      // Reload active proxies if this proxy was marked as failed
      if (newStatus === 'failed') {
        await this.loadActiveProxies();
      }
    } catch (error) {
      console.error(`[ProxyService] Error marking proxy failure:`, error);
    }
  }

  // Add new proxy to database
  async addProxy(host: string, port: number, options?: {
    username?: string;
    password?: string;
    protocol?: string;
    country?: string;
    source?: string;
  }): Promise<number | null> {
    try {
      const proxy = await prisma.proxy.create({
        data: {
          host,
          port,
          username: options?.username,
          password: options?.password,
          protocol: options?.protocol || 'socks5',
          country: options?.country,
          source: options?.source,
          status: 'unknown'
        }
      });

      console.log(`[ProxyService] Added new proxy: ${host}:${port} (ID: ${proxy.id})`);
      return proxy.id;
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`[ProxyService] Proxy ${host}:${port} already exists`);
        return null;
      }
      console.error(`[ProxyService] Error adding proxy ${host}:${port}:`, error);
      return null;
    }
  }

  // Manual proxy test with detailed output
  async testProxyManual(proxyId: number): Promise<{
    success: boolean;
    proxy: ProxyConfig;
    testResult: any;
    realIP?: string;
    message: string;
  }> {
    try {
      const dbProxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
      if (!dbProxy) {
        return {
          success: false,
          proxy: {} as ProxyConfig,
          testResult: {},
          message: `Proxy with ID ${proxyId} not found`
        };
      }

      const proxy: ProxyConfig = {
        id: dbProxy.id,
        host: dbProxy.host,
        port: dbProxy.port,
        username: dbProxy.username || undefined,
        password: dbProxy.password || undefined,
        protocol: dbProxy.protocol
      };

      console.log(`[ProxyService] Manual test of proxy ${proxy.host}:${proxy.port}...`);
      
      const testResult = await this.testProxy(proxy);
      await this.updateProxyStatus(proxyId, testResult);

      const message = testResult.success 
        ? `✅ Proxy working! Real IP: ${testResult.realIP} → Proxy IP: ${testResult.proxyIP} (${testResult.responseTime}ms)`
        : `❌ Proxy failed: ${testResult.error}`;

      return {
        success: testResult.success,
        proxy,
        testResult,
        realIP: testResult.realIP,
        message
      };

    } catch (error: any) {
      return {
        success: false,
        proxy: {} as ProxyConfig,
        testResult: {},
        message: `Error testing proxy: ${error.message}`
      };
    }
  }

  // Get proxy statistics
  async getProxyStats(): Promise<{
    total: number;
    active: number;
    failed: number;
    testing: number;
    avgResponseTime: number;
    avgSuccessRate: number;
  }> {
    try {
      const stats = await prisma.proxy.aggregate({
        _count: { id: true },
        _avg: { responseTime: true, successRate: true }
      });

      const statusCounts = await prisma.proxy.groupBy({
        by: ['status'],
        _count: { id: true }
      });

      const result = {
        total: stats._count.id || 0,
        active: 0,
        failed: 0,
        testing: 0,
        avgResponseTime: Math.round(stats._avg.responseTime || 0),
        avgSuccessRate: Number((stats._avg.successRate || 0).toFixed(2))
      };

      statusCounts.forEach(group => {
        switch (group.status) {
          case 'active':
            result.active = group._count.id;
            break;
          case 'failed':
            result.failed = group._count.id;
            break;
          case 'testing':
            result.testing = group._count.id;
            break;
        }
      });

      return result;
    } catch (error) {
      console.error('[ProxyService] Error getting proxy stats:', error);
      return {
        total: 0,
        active: 0,
        failed: 0,
        testing: 0,
        avgResponseTime: 0,
        avgSuccessRate: 0
      };
    }
  }

  // Remove failed proxies
  async cleanupFailedProxies(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      
      const result = await prisma.proxy.deleteMany({
        where: {
          status: 'failed',
          lastChecked: {
            lt: cutoffTime
          },
          failureCount: {
            gte: 5
          }
        }
      });

      console.log(`[ProxyService] Cleaned up ${result.count} failed proxies`);
      return result.count;
    } catch (error) {
      console.error('[ProxyService] Error cleaning up failed proxies:', error);
      return 0;
    }
  }
}

export const proxyService = ProxyService.getInstance();