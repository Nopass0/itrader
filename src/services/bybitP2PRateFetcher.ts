/**
 * Bybit P2P Rate Fetcher
 * Fetches USDT/RUB rates from Bybit P2P advertisements
 */

import { P2PClient } from "../bybit/p2pClient";
import { P2PConfig } from "../bybit/types/p2p";
import { createLogger } from "../logger";

const logger = createLogger('BybitP2PRateFetcher');

interface RateFetchOptions {
  pageNumber?: number;
  adIndex?: number;
  side?: 'buy' | 'sell';
  token?: string;
  fiat?: string;
}

export class BybitP2PRateFetcher {
  private client: P2PClient;
  
  constructor(config: P2PConfig) {
    this.client = new P2PClient(config);
  }

  /**
   * Fetch rate from Bybit P2P advertisements
   * @param options Options for fetching rate
   * @returns The price of the selected advertisement
   */
  async fetchRate(options: RateFetchOptions = {}): Promise<number> {
    const {
      pageNumber = 1,
      adIndex = 0,
      side = 'buy', // We buy USDT, so we look at sell advertisements
      token = 'USDT',
      fiat = 'RUB'
    } = options;

    try {
      logger.info('Fetching rate from Bybit P2P', { pageNumber, adIndex, side, token, fiat });

      // Fetch advertisements
      const response = await this.client.getActiveAdvertisements({
        tokenId: token,
        currencyId: fiat,
        side: side === 'buy' ? 0 : 1, // 0 = buy, 1 = sell
        paymentMethod: '', // All payment methods
        page: pageNumber,
        size: 20 // Fetch 20 ads per page
      });

      if (!response || !response.list || response.list.length === 0) {
        throw new Error('No advertisements found');
      }

      // Check if the requested index exists
      if (adIndex >= response.list.length) {
        throw new Error(`Advertisement at index ${adIndex} not found. Only ${response.list.length} ads on page ${pageNumber}`);
      }

      const selectedAd = response.list[adIndex];
      const price = parseFloat(selectedAd.price);

      logger.info('Successfully fetched rate', {
        price,
        advertiser: selectedAd.nickName,
        minAmount: selectedAd.minQuote,
        maxAmount: selectedAd.maxQuote,
        tradableQuantity: selectedAd.tradableQuantity,
        paymentMethods: selectedAd.paymentMethods
      });

      return price;
    } catch (error) {
      logger.error('Failed to fetch rate from Bybit P2P', error as Error, { options });
      throw error;
    }
  }

  /**
   * Fetch rates from multiple pages/indices and calculate average
   * @param configs Array of configurations to fetch
   * @returns Average price
   */
  async fetchAverageRate(configs: RateFetchOptions[]): Promise<number> {
    if (configs.length === 0) {
      throw new Error('No configurations provided');
    }

    const rates: number[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      try {
        const rate = await this.fetchRate(config);
        rates.push(rate);
      } catch (error) {
        const errorMsg = `Failed to fetch from page ${config.pageNumber}, index ${config.adIndex}: ${(error as Error).message}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
      }
    }

    if (rates.length === 0) {
      throw new Error(`Failed to fetch any rates. Errors: ${errors.join('; ')}`);
    }

    const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    
    logger.info('Calculated average rate', {
      rates,
      averageRate,
      successCount: rates.length,
      errorCount: errors.length
    });

    return averageRate;
  }

  /**
   * Get rate statistics from a specific page
   * @param pageNumber Page number to analyze
   * @param side Buy or sell side
   * @returns Statistics about rates on the page
   */
  async getRateStatistics(pageNumber: number = 1, side: 'buy' | 'sell' = 'buy') {
    try {
      const response = await this.client.getActiveAdvertisements({
        tokenId: 'USDT',
        currencyId: 'RUB',
        side: side === 'buy' ? 0 : 1,
        paymentMethod: '',
        page: pageNumber,
        size: 20
      });

      if (!response || !response.list || response.list.length === 0) {
        throw new Error('No advertisements found');
      }

      const prices = response.list.map(ad => parseFloat(ad.price));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];

      return {
        count: prices.length,
        minPrice,
        maxPrice,
        avgPrice,
        median,
        prices,
        advertisements: response.list.map((ad, index) => ({
          index,
          price: parseFloat(ad.price),
          advertiser: ad.nickName,
          minAmount: parseFloat(ad.minQuote),
          maxAmount: parseFloat(ad.maxQuote),
          tradableQuantity: parseFloat(ad.tradableQuantity),
          paymentMethods: ad.paymentMethods
        }))
      };
    } catch (error) {
      logger.error('Failed to get rate statistics', error as Error, { pageNumber, side });
      throw error;
    }
  }
}