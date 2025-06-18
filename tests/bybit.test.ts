import { describe, it, expect } from 'bun:test';
import { P2PClient } from '../src/bybit/p2pClient';
import { TimeSyncManager } from '../src/bybit/utils/timeSync';

// prevent network calls during tests
TimeSyncManager.syncServerTime = async () => {};

class MockHttpClient {
  logs: any[] = [];
  constructor(private responses: Record<string, any> = {}) {}
  async request(method: string, endpoint: string, params: any = {}) {
    this.logs.push({ method, endpoint, params });
    return this.responses[endpoint] || { retCode: 0, result: {} };
  }
}


describe('P2PClient endpoints', () => {
  const http = new MockHttpClient();
  const p2p = new P2PClient({ apiKey: 'k', apiSecret: 's', testnet: true });
  // replace internal http client with mock
  (p2p as any).httpClient = {
    get: async (endpoint: string, params?: any) => http.request('GET', endpoint, params),
    post: async (endpoint: string, data?: any) => http.request('POST', endpoint, data),
    delete: async (endpoint: string, data?: any) => http.request('DELETE', endpoint, data),
  };

  it('account info endpoint', async () => {
    await p2p.getAccountInfo();
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/user/personal/info');
  });

  it('ads endpoint', async () => {
    await p2p.getActiveAdvertisements({ asset: 'USDT', fiatCurrency: 'RUB', side: 'BUY' });
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/item/online');
  });

  it('payment methods endpoint', async () => {
    await p2p.getPaymentMethods();
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/user/payment/list');
  });

  it('order list endpoint', async () => {
    await p2p.getOrders();
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/order/simplifyList');
  });

  it('create ad endpoint', async () => {
    await p2p.createAdvertisement({
      side: 'BUY',
      asset: 'USDT',
      fiatCurrency: 'RUB',
      priceType: 'FIXED',
      price: '1',
      quantity: '1',
      minOrderAmount: '10',
      maxOrderAmount: '10',
      paymentIds: ['1'],
    });
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/item/create');
  });

  it('chat message endpoint', async () => {
    await p2p.sendChatMessage({ orderId: '123', message: 'hi' });
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/order/message/send');
  });

  it('chat list endpoint', async () => {
    await p2p.getChatMessages('123');
    const log = http.logs.pop();
    expect(log.endpoint).toBe('/v5/p2p/order/message/listpage');
  });
});
