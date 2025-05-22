import { proxyService } from './proxyService.js';

export interface ProxySource {
  name: string;
  url: string;
  format: 'text' | 'json' | 'csv';
  parser: (data: string) => Array<{ host: string; port: number; protocol?: string; country?: string }>;
}

export class ProxyFetcher {
  private static instance: ProxyFetcher;
  private fetchInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Expanded proxy sources for better coverage
  private sources: ProxySource[] = [
    // SOCKS5 Sources
    {
      name: 'Free Proxy List - SOCKS5',
      url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'Proxy List - SOCKS5',
      url: 'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'Monosans SOCKS5',
      url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'Hookzof SOCKS5',
      url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'RX4096 Proxy List',
      url: 'https://raw.githubusercontent.com/rx443/proxy-list/main/online/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'Prox7 SOCKS5',
      url: 'https://raw.githubusercontent.com/prox7/proxy-list/main/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    // HTTP/HTTPS Sources (backup)
    {
      name: 'Monosans HTTP',
      url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data, 'http')
    },
    {
      name: 'TheSpeedX HTTP',
      url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data, 'http')
    },
    {
      name: 'Clarketm Proxy List',
      url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data, 'http')
    },
    {
      name: 'Sunny9577 Proxy List',
      url: 'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data, 'http')
    },
    {
      name: 'RoostKid Proxy List',
      url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'Zaeem20 Proxy List',
      url: 'https://raw.githubusercontent.com/zaeem20/FREE_PROXIES_LIST/master/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'ProxyScrape API - SOCKS5',
      url: 'https://api.proxyscrape.com/v2/?request=get&protocol=socks5&timeout=10000&country=all&format=textplain',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'ProxyScrape API - HTTP',
      url: 'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all&format=textplain',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data, 'http')
    },
    {
      name: 'Jetkai Proxy List',
      url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    },
    {
      name: 'ALIILAPRO Proxy List',
      url: 'https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/socks5.txt',
      format: 'text',
      parser: (data: string) => this.parseSimpleList(data)
    }
  ];

  constructor() {}

  static getInstance(): ProxyFetcher {
    if (!ProxyFetcher.instance) {
      ProxyFetcher.instance = new ProxyFetcher();
    }
    return ProxyFetcher.instance;
  }

  // Start the proxy fetcher service
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[ProxyFetcher] Starting proxy fetcher service...');
    
    // Initial fetch
    this.fetchFromAllSources();
    
    // Fetch every 2 hours for more fresh proxies
    this.fetchInterval = setInterval(() => {
      this.fetchFromAllSources();
    }, 2 * 60 * 60 * 1000);
  }

  // Stop the proxy fetcher
  stop() {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }
    this.isRunning = false;
    console.log('[ProxyFetcher] Proxy fetcher stopped');
  }

  // Fetch proxies from all sources
  private async fetchFromAllSources() {
    console.log('[ProxyFetcher] Starting proxy fetch from all sources...');
    let totalAdded = 0;

    for (const source of this.sources) {
      try {
        const count = await this.fetchFromSource(source);
        totalAdded += count;
        
        // Add delay between requests to be respectful
        await this.delay(2000);
      } catch (error) {
        console.error(`[ProxyFetcher] Error fetching from ${source.name}:`, error);
      }
    }

    console.log(`[ProxyFetcher] Proxy fetch completed. Added ${totalAdded} new proxies.`);
  }

  // Fetch proxies from a single source
  private async fetchFromSource(source: ProxySource): Promise<number> {
    try {
      console.log(`[ProxyFetcher] Fetching from ${source.name}...`);
      
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.text();
      const proxies = source.parser(data);
      
      console.log(`[ProxyFetcher] Parsed ${proxies.length} proxies from ${source.name}`);

      let addedCount = 0;
      for (const proxy of proxies) {
        const proxyId = await proxyService.addProxy(proxy.host, proxy.port, {
          protocol: proxy.protocol || 'socks5',
          country: proxy.country,
          source: source.name
        });
        
        if (proxyId !== null) {
          addedCount++;
        }
      }

      console.log(`[ProxyFetcher] Added ${addedCount} new proxies from ${source.name}`);
      return addedCount;

    } catch (error: any) {
      console.error(`[ProxyFetcher] Error fetching from ${source.name}:`, error.message);
      return 0;
    }
  }

  // Parse simple IP:PORT format
  parseSimpleList(data: string, defaultProtocol: string = 'socks5'): Array<{ host: string; port: number; protocol?: string }> {
    const proxies: Array<{ host: string; port: number; protocol?: string }> = [];
    const lines = data.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }

      // Match IP:PORT format
      const match = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/);
      if (match) {
        const [, host, portStr] = match;
        const port = parseInt(portStr, 10);
        
        // Validate IP and port
        if (this.isValidIP(host) && port > 0 && port <= 65535) {
          proxies.push({ host, port, protocol: defaultProtocol });
        }
      }
    }

    return proxies;
  }

  // Validate IP address
  isValidIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return false;
      }
    }
    
    return true;
  }

  // Utility delay function
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Add custom proxy source
  addSource(source: ProxySource) {
    this.sources.push(source);
    console.log(`[ProxyFetcher] Added custom source: ${source.name}`);
  }

  // Get current sources
  getSources(): ProxySource[] {
    return [...this.sources];
  }

  // Manual fetch from specific source
  async fetchManual(sourceName: string): Promise<number> {
    const source = this.sources.find(s => s.name === sourceName);
    if (!source) {
      throw new Error(`Source not found: ${sourceName}`);
    }

    return await this.fetchFromSource(source);
  }

  // Fetch proxies with authentication from premium sources
  async fetchFromPremiumSource(url: string, apiKey?: string): Promise<number> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.text();
      const proxies = this.parseSimpleList(data);
      
      let addedCount = 0;
      for (const proxy of proxies) {
        const proxyId = await proxyService.addProxy(proxy.host, proxy.port, {
          protocol: proxy.protocol || 'socks5',
          source: 'premium-api'
        });
        
        if (proxyId !== null) {
          addedCount++;
        }
      }

      console.log(`[ProxyFetcher] Added ${addedCount} proxies from premium source`);
      return addedCount;

    } catch (error: any) {
      console.error('[ProxyFetcher] Error fetching from premium source:', error.message);
      return 0;
    }
  }
}

export const proxyFetcher = ProxyFetcher.getInstance();