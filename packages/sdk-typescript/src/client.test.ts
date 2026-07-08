import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MerchantClient } from './client';

// Track the ofetch.create mock calls for base URL assertions
let createOptions: Record<string, unknown> = {};

// Mock ofetch
vi.mock('ofetch', () => ({
  ofetch: {
    create: vi.fn((options: Record<string, unknown>) => {
      createOptions = options;
      return vi.fn();
    }),
  },
}));

describe('MerchantClient', () => {
  const mockApiKey = 'fm_sk_test1234567890abcdef';
  const mockBaseUrl = 'http://localhost:3001';
  let client: MerchantClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MerchantClient({
      baseUrl: mockBaseUrl,
      apiKey: mockApiKey,
    });
    // Get the mock fetch function from the client internals
    // @ts-expect-error - accessing private fetch for testing
    mockFetch = client.fetch;
  });

  describe('constructor', () => {
    it('should create a client with the correct base URL (appending /api/v1)', () => {
      expect(createOptions.baseURL).toBe('http://localhost:3001/api/v1');
    });

    it('should handle trailing slashes in base URL gracefully', () => {
      const clientWithSlash = new MerchantClient({
        baseUrl: 'http://localhost:3001/',
        apiKey: mockApiKey,
      });
      expect(clientWithSlash).toBeInstanceOf(MerchantClient);
    });

    it('should not duplicate /api/v1 when base URL already includes it', () => {
      new MerchantClient({
        baseUrl: 'http://localhost:3001/api/v1',
        apiKey: mockApiKey,
      });
      expect(createOptions.baseURL).toBe('http://localhost:3001/api/v1');
    });

    it('should expose all resource APIs', () => {
      expect(client.invoices).toBeDefined();
      expect(client.webhooks).toBeDefined();
      expect(client.transactions).toBeDefined();
      expect(client.balance).toBeDefined();
      expect(client.fiber).toBeDefined();
      expect(client.stats).toBeDefined();
    });
  });

  describe('health', () => {
    it('should call GET /health', async () => {
      mockFetch.mockResolvedValue({ status: 'ok', version: '1.0.0' });
      const result = await client.health();
      expect(mockFetch).toHaveBeenCalledWith('/health');
      expect(result.status).toBe('ok');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('invoices', () => {
    const mockInvoice = {
      id: 'inv-123',
      paymentHash: '0xabc123',
      invoiceAddress: 'fibt1...',
      amount: '5000',
      currency: 'CKB',
      description: 'Test invoice',
      status: 'pending',
      expiresAt: '2026-07-04T13:00:00Z',
      createdAt: '2026-07-04T12:00:00Z',
      updatedAt: '2026-07-04T12:00:00Z',
    };

    describe('create', () => {
      it('should POST /invoices with the given data', async () => {
        mockFetch.mockResolvedValue(mockInvoice);
        const result = await client.invoices.create({
          amount: '5000',
          currency: 'CKB',
          description: 'Test invoice',
        });
        expect(mockFetch).toHaveBeenCalledWith('/invoices', {
          method: 'POST',
          body: { amount: '5000', currency: 'CKB', description: 'Test invoice' },
        });
        expect(result.id).toBe('inv-123');
        expect(result.status).toBe('pending');
      });

      it('should accept optional fields', async () => {
        mockFetch.mockResolvedValue(mockInvoice);
        await client.invoices.create({
          amount: '1000',
          currency: 'RUSD',
          description: 'Optional test',
          metadata: { orderId: 'ORD-001' },
          expiry: 3600,
          webhookUrl: 'https://example.com/webhook',
          allowMpp: true,
        });
        expect(mockFetch).toHaveBeenCalledWith('/invoices', {
          method: 'POST',
          body: expect.objectContaining({
            amount: '1000',
            currency: 'RUSD',
            metadata: { orderId: 'ORD-001' },
            expiry: 3600,
            webhookUrl: 'https://example.com/webhook',
            allowMpp: true,
          }),
        });
      });
    });

    describe('get', () => {
      it('should GET /invoices/:id', async () => {
        mockFetch.mockResolvedValue(mockInvoice);
        const result = await client.invoices.get('inv-123');
        expect(mockFetch).toHaveBeenCalledWith('/invoices/inv-123');
        expect(result.id).toBe('inv-123');
      });
    });

    describe('list', () => {
      it('should GET /invoices with optional filters', async () => {
        mockFetch.mockResolvedValue({ items: [mockInvoice], total: 1 });
        const result = await client.invoices.list({ status: 'paid', limit: 10 });
        expect(mockFetch).toHaveBeenCalledWith('/invoices', {
          params: { status: 'paid', limit: 10 },
        });
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
      });

      it('should work without filters', async () => {
        mockFetch.mockResolvedValue({ items: [], total: 0 });
        await client.invoices.list();
        expect(mockFetch).toHaveBeenCalledWith('/invoices', { params: undefined });
      });
    });

    describe('cancel', () => {
      it('should POST /invoices/:id/cancel', async () => {
        mockFetch.mockResolvedValue({ ...mockInvoice, status: 'cancelled' });
        const result = await client.invoices.cancel('inv-123');
        expect(mockFetch).toHaveBeenCalledWith('/invoices/inv-123/cancel', { method: 'POST' });
        expect(result.status).toBe('cancelled');
      });
    });

    describe('refund', () => {
      it('should POST /invoices/:id/refund with a reason', async () => {
        mockFetch.mockResolvedValue({ ...mockInvoice, status: 'refunded' });
        const result = await client.invoices.refund('inv-123', 'Customer request');
        expect(mockFetch).toHaveBeenCalledWith('/invoices/inv-123/refund', {
          method: 'POST',
          body: { reason: 'Customer request' },
        });
        expect(result.status).toBe('refunded');
      });

      it('should POST /invoices/:id/refund without a reason', async () => {
        mockFetch.mockResolvedValue({ ...mockInvoice, status: 'refunded' });
        await client.invoices.refund('inv-123');
        expect(mockFetch).toHaveBeenCalledWith('/invoices/inv-123/refund', {
          method: 'POST',
          body: { reason: undefined },
        });
      });
    });

    describe('getQrCode', () => {
      it('should GET /invoices/:id/qr', async () => {
        mockFetch.mockResolvedValue({ invoiceAddress: 'fibt1...', qrData: 'fibt1...' });
        const result = await client.invoices.getQrCode('inv-123');
        expect(mockFetch).toHaveBeenCalledWith('/invoices/inv-123/qr');
        expect(result.invoiceAddress).toBe('fibt1...');
        expect(result.qrData).toBe('fibt1...');
      });
    });
  });

  describe('webhooks', () => {
    const mockWebhook = {
      id: 'wh-123',
      url: 'https://example.com/webhook',
      events: ['invoice.paid', 'invoice.expired'],
      secret: 'whsec_abc123',
      active: true,
      createdAt: '2026-07-04T12:00:00Z',
    };

    describe('register', () => {
      it('should POST /webhooks with registration data', async () => {
        mockFetch.mockResolvedValue(mockWebhook);
        const result = await client.webhooks.register({
          url: 'https://example.com/webhook',
          events: ['invoice.paid', 'invoice.expired'],
          description: 'Test webhook',
        });
        expect(mockFetch).toHaveBeenCalledWith('/webhooks', {
          method: 'POST',
          body: expect.objectContaining({
            url: 'https://example.com/webhook',
            events: ['invoice.paid', 'invoice.expired'],
          }),
        });
        expect(result.id).toBe('wh-123');
        expect(result.secret).toBe('whsec_abc123');
      });
    });

    describe('list', () => {
      it('should GET /webhooks', async () => {
        mockFetch.mockResolvedValue([mockWebhook]);
        const result = await client.webhooks.list();
        expect(mockFetch).toHaveBeenCalledWith('/webhooks');
        expect(result).toHaveLength(1);
      });
    });

    describe('get', () => {
      it('should GET /webhooks/:id', async () => {
        mockFetch.mockResolvedValue(mockWebhook);
        const result = await client.webhooks.get('wh-123');
        expect(mockFetch).toHaveBeenCalledWith('/webhooks/wh-123');
        expect(result.id).toBe('wh-123');
      });
    });

    describe('update', () => {
      it('should PATCH /webhooks/:id', async () => {
        mockFetch.mockResolvedValue({ ...mockWebhook, active: false });
        const result = await client.webhooks.update('wh-123', { description: 'Updated' });
        expect(mockFetch).toHaveBeenCalledWith('/webhooks/wh-123', {
          method: 'PATCH',
          body: { description: 'Updated' },
        });
        expect(result.active).toBe(false);
      });
    });

    describe('delete', () => {
      it('should DELETE /webhooks/:id', async () => {
        mockFetch.mockResolvedValue(undefined);
        await client.webhooks.delete('wh-123');
        expect(mockFetch).toHaveBeenCalledWith('/webhooks/wh-123', { method: 'DELETE' });
      });
    });

    describe('getDeliveries', () => {
      it('should GET /webhooks/:id/deliveries', async () => {
        const mockDeliveries = [
          { id: 'del-1', event: 'invoice.paid', url: 'https://example.com', status: 200, success: true, attempts: 1, payload: {}, deliveredAt: '2026-07-04T12:00:00Z' },
        ];
        mockFetch.mockResolvedValue(mockDeliveries);
        const result = await client.webhooks.getDeliveries('wh-123');
        expect(mockFetch).toHaveBeenCalledWith('/webhooks/wh-123/deliveries');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('del-1');
      });
    });

    describe('retryDelivery', () => {
      it('should POST /webhooks/:id/deliveries/:deliveryId/retry', async () => {
        const mockResponse = {
          message: 'Delivery retry queued',
          delivery: {
            id: 'del-retry',
            webhookId: 'wh-123',
            event: 'invoice.paid',
            url: 'https://example.com',
            status: 0,
            success: false,
            attempts: 0,
            payload: {},
            deliveredAt: '2026-07-04T12:05:00Z',
          },
        };
        mockFetch.mockResolvedValue(mockResponse);
        const result = await client.webhooks.retryDelivery('wh-123', 'del-1');
        expect(mockFetch).toHaveBeenCalledWith('/webhooks/wh-123/deliveries/del-1/retry', { method: 'POST' });
        expect(result.delivery.id).toBe('del-retry');
      });
    });

    describe('test', () => {
      it('should POST /webhooks/:id/test', async () => {
        const mockResponse = { message: 'Test event sent', webhookId: 'wh-123' };
        mockFetch.mockResolvedValue(mockResponse);
        const result = await client.webhooks.test('wh-123');
        expect(mockFetch).toHaveBeenCalledWith('/webhooks/wh-123/test', { method: 'POST' });
        expect(result.webhookId).toBe('wh-123');
      });
    });
  });

  describe('transactions', () => {
    const mockTransaction = {
      id: 'tx-123',
      paymentHash: '0xdef456',
      direction: 'incoming',
      amount: '5000',
      currency: 'CKB',
      fee: '0',
      status: 'Succeeded',
      createdAt: '2026-07-04T12:00:00Z',
    };

    describe('list', () => {
      it('should GET /transactions with filters', async () => {
        mockFetch.mockResolvedValue({ items: [mockTransaction], total: 1 });
        const result = await client.transactions.list({ direction: 'incoming', status: 'Succeeded', limit: 50 });
        expect(mockFetch).toHaveBeenCalledWith('/transactions', {
          params: { direction: 'incoming', status: 'Succeeded', limit: 50 },
        });
        expect(result.items).toHaveLength(1);
        expect(result.items[0].direction).toBe('incoming');
      });

      it('should work without filters', async () => {
        mockFetch.mockResolvedValue({ items: [], total: 0 });
        await client.transactions.list();
        expect(mockFetch).toHaveBeenCalledWith('/transactions', { params: undefined });
      });
    });

    describe('get', () => {
      it('should GET /transactions/:id', async () => {
        mockFetch.mockResolvedValue(mockTransaction);
        const result = await client.transactions.get('tx-123');
        expect(mockFetch).toHaveBeenCalledWith('/transactions/tx-123');
        expect(result.id).toBe('tx-123');
      });
    });
  });

  describe('balance', () => {
    const mockChannel = {
      localBalance: '500000',
      remoteBalance: '500000',
      capacity: '1000000',
      asset: 'CKB',
      channelId: 'ch-1',
      state: 'Ready',
      peerPubkey: '02abc...',
    };

    describe('getChannels', () => {
      it('should GET /balance/channels', async () => {
        mockFetch.mockResolvedValue([mockChannel]);
        const result = await client.balance.getChannels();
        expect(mockFetch).toHaveBeenCalledWith('/balance/channels');
        expect(result).toHaveLength(1);
        expect(result[0].asset).toBe('CKB');
      });
    });

    describe('getTotal', () => {
      it('should GET /balance/total', async () => {
        mockFetch.mockResolvedValue({ local: '500000', remote: '500000', total: '1000000' });
        const result = await client.balance.getTotal();
        expect(mockFetch).toHaveBeenCalledWith('/balance/total');
        expect(result.total).toBe('1000000');
      });
    });
  });

  describe('fiber', () => {
    const mockStatus = {
      mode: 'live',
      reachable: true,
      rpcUrlConfigured: true,
      currency: 'Fibt',
      checkedAt: '2026-07-08T12:00:00Z',
      worker: {
        enabled: true,
        active: true,
        running: false,
        mode: 'live',
        intervalMs: 30000,
        batchSize: 25,
      },
      node: {
        nodeId: '02abc',
        version: '0.6.0',
        peersCount: 2,
        channelsCount: 1,
        pendingChannelsCount: 0,
      },
      channels: {
        total: 1,
        ready: 1,
        pending: 0,
        failed: 0,
        localBalance: '500000',
        remoteBalance: '500000',
        totalCapacity: '1000000',
        items: [],
      },
    };

    it('should GET /fiber/status', async () => {
      mockFetch.mockResolvedValue(mockStatus);
      const result = await client.fiber.getStatus();
      expect(mockFetch).toHaveBeenCalledWith('/fiber/status');
      expect(result.reachable).toBe(true);
      expect(result.worker.enabled).toBe(true);
    });

    it('should POST /fiber/settlement/run', async () => {
      const mockRun = {
        trigger: 'manual',
        running: false,
        skipped: false,
        startedAt: '2026-07-08T12:00:00Z',
        finishedAt: '2026-07-08T12:00:01Z',
        summary: {
          checked: 2,
          paid: 1,
          received: 0,
          expired: 0,
          unchanged: 1,
          errors: 0,
        },
      };
      mockFetch.mockResolvedValue(mockRun);
      const result = await client.fiber.runSettlement();
      expect(mockFetch).toHaveBeenCalledWith('/fiber/settlement/run', { method: 'POST' });
      expect(result.summary?.paid).toBe(1);
    });
  });

  describe('stats', () => {
    const mockStats = {
      totalInvoices: 100,
      paidInvoices: 75,
      totalVolume: '500000',
      successRate: 75,
      activeChannels: 2,
      channelBalances: { local: '500000', remote: '500000' },
    };

    describe('get', () => {
      it('should GET /stats', async () => {
        mockFetch.mockResolvedValue(mockStats);
        const result = await client.stats.get();
        expect(mockFetch).toHaveBeenCalledWith('/stats');
        expect(result.totalInvoices).toBe(100);
        expect(result.paidInvoices).toBe(75);
      });
    });

    describe('revenueHistory', () => {
      it('should GET /stats/revenue with days param', async () => {
        const mockRevenue = [
          { date: '2026-07-01', volume: '1000', count: 2 },
          { date: '2026-07-02', volume: '2000', count: 3 },
        ];
        mockFetch.mockResolvedValue(mockRevenue);
        const result = await client.stats.revenueHistory(7);
        expect(mockFetch).toHaveBeenCalledWith('/stats/revenue', { params: { days: 7 } });
        expect(result).toHaveLength(2);
        expect(result[0].date).toBe('2026-07-01');
      });

      it('should work without days param', async () => {
        mockFetch.mockResolvedValue([]);
        await client.stats.revenueHistory();
        expect(mockFetch).toHaveBeenCalledWith('/stats/revenue', { params: { days: undefined } });
      });
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      const apiError = new Error('HTTP Error: 400 Bad Request');
      mockFetch.mockRejectedValue(apiError);
      await expect(client.invoices.get('invalid-id')).rejects.toThrow('HTTP Error: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockFetch.mockRejectedValue(networkError);
      await expect(client.health()).rejects.toThrow('Network Error');
    });
  });
});
