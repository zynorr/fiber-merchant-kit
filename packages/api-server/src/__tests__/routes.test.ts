/**
 * Route-level integration tests using supertest
 *
 * Mocks the database and Fiber node client to test HTTP request/response flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import type { DbMerchant, DbInvoice, DbWebhook, DbWebhookDelivery } from '../db/types';

// ── Mock objects created via vi.hoisted() to avoid hoisting issues ──

const mockDb = vi.hoisted(() => ({
  findMerchantByApiKey: vi.fn(),
  createInvoice: vi.fn(),
  getInvoice: vi.fn(),
  listInvoices: vi.fn(),
  updateInvoiceStatus: vi.fn(),
  createTransaction: vi.fn(),
  upsertIncomingPaymentTransaction: vi.fn(),
  createWebhook: vi.fn(),
  getWebhook: vi.fn(),
  listWebhooks: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  createDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  getDeliveries: vi.fn(),
  getDelivery: vi.fn(),
  getTransaction: vi.fn(),
  listTransactions: vi.fn(),
  getMerchantStats: vi.fn(),
  getRevenueHistory: vi.fn(),
  getInvoiceByPaymentHash: vi.fn(),
  seedDemoMerchant: vi.fn(),
  initDatabase: vi.fn(),
  closeDb: vi.fn(),
  getDb: vi.fn(),
}));

const mockFiberClient = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  getInvoiceStatus: vi.fn(),
  listChannels: vi.fn(),
  sendPayment: vi.fn(),
  getNodeInfo: vi.fn(),
}));

const mockWebhookDeliveryService = vi.hoisted(() => ({
  dispatchWebhookEvent: vi.fn(),
  replayWebhookDelivery: vi.fn(),
}));

vi.mock('../db', () => mockDb);
vi.mock('../lib/fiber-client', () => ({
  getFiberClient: () => mockFiberClient,
}));
vi.mock('../services/fiber-client', () => ({
  FiberNodeClient: vi.fn().mockImplementation(() => mockFiberClient),
}));
vi.mock('../services/webhook-delivery', () => mockWebhookDeliveryService);

// ── Test Constants ─────────────────────────────────────────────

const API_KEY = 'fm_sk_test_valid_key_12345';
const DEMO_MERCHANT: DbMerchant = {
  id: 'merchant-1',
  api_key: API_KEY,
  label: 'Test Merchant',
  active: 1,
  created_at: '2026-01-01T00:00:00Z',
  last_used_at: null,
};

// ── Tests ──────────────────────────────────────────────────────

describe('API Routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockDb.findMerchantByApiKey.mockReturnValue(DEMO_MERCHANT);
    mockFiberClient.getNodeInfo.mockResolvedValue({
      node_id: 'demo-node',
      version: '0.1.0',
      peers: 0,
      channels: 2,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Health ─────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns ok status when fiber node is reachable', async () => {
      mockFiberClient.getNodeInfo.mockResolvedValue({
        node_id: 'test-node', version: '0.1.0', peers: 1, channels: 3,
      });

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.fiberNode.node_id).toBe('test-node');
    });

    it('returns degraded status when fiber node is unreachable', async () => {
      mockFiberClient.getNodeInfo.mockRejectedValue(new Error('Connection refused'));

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.fiberNode).toBe('unreachable');
    });

    it('does not require authentication', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
    });
  });

  // ── Authentication ─────────────────────────────────────────

  describe('Authentication', () => {
    it('returns 401 when no auth header is provided', async () => {
      const res = await request(app).get('/api/v1/invoices');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing|authorization/i);
    });

    it('returns 401 when auth header has no Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Token ${API_KEY}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 when API key format is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', 'Bearer invalid_key_format');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/format/i);
    });

    it('returns 401 when API key is not found', async () => {
      mockDb.findMerchantByApiKey.mockReturnValue(undefined);
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer fm_sk_nonexistent_key`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid|inactive/i);
    });
  });

  // ── Invoices ───────────────────────────────────────────────

  describe('Invoice routes', () => {
    const mockInvoice: DbInvoice = {
      id: 'inv-123',
      payment_hash: '0xabc',
      preimage: 'preimage123',
      invoice_address: 'fibt1test...',
      amount: '5000',
      currency: 'CKB',
      description: 'Test order',
      metadata: null,
      status: 'pending',
      expires_at: '2026-07-05T00:00:00Z',
      paid_at: null,
      refunded_at: null,
      webhook_url: null,
      merchant_id: 'merchant-1',
      created_at: '2026-07-04T00:00:00Z',
      updated_at: '2026-07-04T00:00:00Z',
    };

    describe('POST /api/v1/invoices', () => {
      it('creates an invoice successfully', async () => {
        mockFiberClient.createInvoice.mockResolvedValue({
          paymentHash: '0xabc123',
          preimage: 'preimage_val',
          invoiceAddress: 'fibt1created...',
        });
        mockDb.getInvoice.mockReturnValue(mockInvoice);

        const res = await request(app)
          .post('/api/v1/invoices')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ amount: '5000', currency: 'CKB', description: 'Test order' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('inv-123');
        expect(res.body.status).toBe('pending');
        expect(mockFiberClient.createInvoice).toHaveBeenCalled();
        expect(mockDb.createInvoice).toHaveBeenCalled();
        expect(mockDb.createTransaction).toHaveBeenCalled();
      });

      it('returns 400 for invalid request body', async () => {
        const res = await request(app)
          .post('/api/v1/invoices')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ amount: '0' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
      });

      it('returns 400 for missing amount', async () => {
        const res = await request(app)
          .post('/api/v1/invoices')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({});

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/v1/invoices', () => {
      it('lists invoices', async () => {
        mockDb.listInvoices.mockReturnValue({
          items: [mockInvoice],
          total: 1,
        });

        const res = await request(app)
          .get('/api/v1/invoices')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.total).toBe(1);
      });

      it('filters by status', async () => {
        mockDb.listInvoices.mockReturnValue({ items: [], total: 0 });

        await request(app)
          .get('/api/v1/invoices?status=paid')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(mockDb.listInvoices).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'paid' }),
        );
      });
    });

    describe('GET /api/v1/invoices/:id', () => {
      it('returns invoice by id', async () => {
        mockDb.getInvoice.mockReturnValue(mockInvoice);
        mockFiberClient.getInvoiceStatus.mockResolvedValue({ status: 'Open' });

        const res = await request(app)
          .get('/api/v1/invoices/inv-123')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('inv-123');
        expect(res.body.paymentHash).toBe('0xabc');
      });

      it('returns 404 for unknown invoice', async () => {
        mockDb.getInvoice.mockReturnValue(undefined);

        const res = await request(app)
          .get('/api/v1/invoices/nonexistent')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(404);
      });

      it('auto-polls and updates status when invoice becomes paid', async () => {
        mockDb.getInvoice
          .mockReturnValueOnce(mockInvoice)
          .mockReturnValue({ ...mockInvoice, status: 'paid', paid_at: '2026-07-04T12:05:00Z' });
        mockDb.updateInvoiceStatus.mockReturnValue(true);
        mockFiberClient.getInvoiceStatus.mockResolvedValue({ status: 'Paid' });

        const res = await request(app)
          .get('/api/v1/invoices/inv-123')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paid');
        expect(mockDb.updateInvoiceStatus).toHaveBeenCalledWith('inv-123', 'paid', 'merchant-1');
        expect(mockDb.upsertIncomingPaymentTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ invoiceId: 'inv-123', paymentHash: '0xabc' }),
        );
      });
    });

    describe('POST /api/v1/invoices/:id/cancel', () => {
      it('cancels a pending invoice', async () => {
        mockDb.getInvoice.mockReturnValue(mockInvoice);

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/cancel')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(mockDb.updateInvoiceStatus).toHaveBeenCalledWith('inv-123', 'cancelled', 'merchant-1');
      });

      it('returns 400 for non-pending invoice', async () => {
        mockDb.getInvoice.mockReturnValue({ ...mockInvoice, status: 'paid' });

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/cancel')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/cannot cancel/i);
      });
    });

    describe('POST /api/v1/invoices/:id/simulate-payment', () => {
      it('marks a pending invoice paid in demo mode', async () => {
        mockDb.getInvoice
          .mockReturnValueOnce(mockInvoice)
          .mockReturnValue({ ...mockInvoice, status: 'paid', paid_at: '2026-07-04T12:05:00Z' });
        mockDb.updateInvoiceStatus.mockReturnValue(true);

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/simulate-payment')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paid');
        expect(mockDb.updateInvoiceStatus).toHaveBeenCalledWith('inv-123', 'paid', 'merchant-1');
        expect(mockDb.upsertIncomingPaymentTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ invoiceId: 'inv-123', paymentHash: '0xabc' }),
        );
      });

      it('returns 400 when the invoice is not pending or received', async () => {
        mockDb.getInvoice.mockReturnValue({ ...mockInvoice, status: 'paid' });

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/simulate-payment')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/cannot simulate payment/i);
      });
    });

    describe('POST /api/v1/invoices/:id/refund', () => {
      it('refunds a paid invoice', async () => {
        mockDb.getInvoice.mockReturnValue({ ...mockInvoice, status: 'paid' });
        mockFiberClient.sendPayment.mockResolvedValue({
          success: true,
          paymentHash: '0xrefund123',
          fee: '1000',
        });

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/refund')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ reason: 'Customer request' });

        expect(res.status).toBe(200);
        expect(mockDb.updateInvoiceStatus).toHaveBeenCalledWith('inv-123', 'refunded', 'merchant-1');
      });

      it('returns 400 for non-paid invoice', async () => {
        mockDb.getInvoice.mockReturnValue({ ...mockInvoice, status: 'pending' });

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/refund')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(400);
      });

      it('returns 500 when refund payment fails', async () => {
        mockDb.getInvoice.mockReturnValue({ ...mockInvoice, status: 'paid' });
        mockFiberClient.sendPayment.mockResolvedValue({ success: false, error: 'Insufficient balance' });

        const res = await request(app)
          .post('/api/v1/invoices/inv-123/refund')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/v1/invoices/:id/qr', () => {
      it('returns QR code data', async () => {
        mockDb.getInvoice.mockReturnValue(mockInvoice);

        const res = await request(app)
          .get('/api/v1/invoices/inv-123/qr')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.invoiceAddress).toBe('fibt1test...');
        expect(res.body.qrData).toBe('fibt1test...');
      });
    });
  });

  // ── Webhooks ───────────────────────────────────────────────

  describe('Webhook routes', () => {
    const mockWebhook: DbWebhook = {
      id: 'wh-123',
      url: 'https://example.com/hook',
      events: JSON.stringify(['invoice.paid', 'invoice.expired']),
      secret: 'whsec_test',
      description: 'Test webhook',
      active: 1,
      merchant_id: 'merchant-1',
      created_at: '2026-07-04T00:00:00Z',
    };
    const mockDelivery: DbWebhookDelivery = {
      id: 'del-1',
      webhook_id: 'wh-123',
      event: 'invoice.paid',
      url: 'https://example.com/hook',
      status_code: 500,
      success: 0,
      attempts: 5,
      payload: '{"id":"inv-123","status":"paid"}',
      error: 'HTTP 500',
      delivered_at: '2026-07-04T12:00:00Z',
    };

    describe('POST /api/v1/webhooks', () => {
      it('registers a webhook', async () => {
        mockDb.createWebhook.mockReturnValue(mockWebhook);

        const res = await request(app)
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({
            url: 'https://example.com/hook',
            events: ['invoice.paid', 'invoice.expired'],
            description: 'Test webhook',
          });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('wh-123');
        expect(res.body.secret).toBeTruthy();
      });

      it('returns 400 for invalid URL', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ url: 'not-a-url', events: ['invoice.paid'] });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/v1/webhooks', () => {
      it('lists webhooks', async () => {
        mockDb.listWebhooks.mockReturnValue([mockWebhook]);

        const res = await request(app)
          .get('/api/v1/webhooks')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe('wh-123');
      });
    });

    describe('GET /api/v1/webhooks/:id', () => {
      it('returns a webhook by id', async () => {
        mockDb.getWebhook.mockReturnValue(mockWebhook);

        const res = await request(app)
          .get('/api/v1/webhooks/wh-123')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('wh-123');
      });

      it('returns 404 for unknown webhook', async () => {
        mockDb.getWebhook.mockReturnValue(undefined);

        const res = await request(app)
          .get('/api/v1/webhooks/nonexistent')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/v1/webhooks/:id', () => {
      it('updates a webhook', async () => {
        mockDb.updateWebhook.mockReturnValue({ ...mockWebhook, active: 0 });

        const res = await request(app)
          .patch('/api/v1/webhooks/wh-123')
          .set('Authorization', `Bearer ${API_KEY}`)
          .send({ active: false });

        expect(res.status).toBe(200);
        expect(mockDb.updateWebhook).toHaveBeenCalled();
      });
    });

    describe('DELETE /api/v1/webhooks/:id', () => {
      it('deletes a webhook', async () => {
        mockDb.deleteWebhook.mockReturnValue(true);

        const res = await request(app)
          .delete('/api/v1/webhooks/wh-123')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(204);
        expect(mockDb.deleteWebhook).toHaveBeenCalledWith('wh-123', 'merchant-1');
      });

      it('returns 404 when deleting an unknown webhook', async () => {
        mockDb.deleteWebhook.mockReturnValue(false);

        const res = await request(app)
          .delete('/api/v1/webhooks/missing')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/v1/webhooks/:id/deliveries', () => {
      it('returns delivery logs', async () => {
        mockDb.getWebhook.mockReturnValue(mockWebhook);
        mockDb.getDeliveries.mockReturnValue([
          { id: 'del-1', webhook_id: 'wh-123', event: 'invoice.paid', url: 'https://example.com', status_code: 200, success: 1, attempts: 1, payload: '{}', error: null, delivered_at: '2026-07-04T12:00:00Z' },
        ]);

        const res = await request(app)
          .get('/api/v1/webhooks/wh-123/deliveries')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].status).toBe(200);
        expect(res.body[0].success).toBe(true);
        expect(res.body[0].deliveredAt).toBe('2026-07-04T12:00:00Z');
      });
    });

    describe('POST /api/v1/webhooks/:id/deliveries/:deliveryId/retry', () => {
      it('queues a delivery retry', async () => {
        const replayDelivery = {
          ...mockDelivery,
          id: 'del-retry',
          status_code: null,
          success: 0,
          attempts: null,
          error: null,
          delivered_at: '2026-07-04T12:05:00Z',
        };
        mockDb.getWebhook.mockReturnValue(mockWebhook);
        mockDb.getDelivery.mockReturnValue(mockDelivery);
        mockWebhookDeliveryService.replayWebhookDelivery.mockReturnValue(replayDelivery);

        const res = await request(app)
          .post('/api/v1/webhooks/wh-123/deliveries/del-1/retry')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(202);
        expect(res.body.message).toMatch(/retry queued/i);
        expect(res.body.delivery.id).toBe('del-retry');
        expect(res.body.delivery.status).toBe(0);
        expect(mockDb.getDelivery).toHaveBeenCalledWith('del-1', 'wh-123', 'merchant-1');
        expect(mockWebhookDeliveryService.replayWebhookDelivery).toHaveBeenCalledWith(mockWebhook, mockDelivery);
      });

      it('returns 404 when retrying an unknown delivery', async () => {
        mockDb.getWebhook.mockReturnValue(mockWebhook);
        mockDb.getDelivery.mockReturnValue(undefined);

        const res = await request(app)
          .post('/api/v1/webhooks/wh-123/deliveries/missing/retry')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/delivery not found/i);
      });
    });

    describe('POST /api/v1/webhooks/:id/test', () => {
      it('sends a test event', async () => {
        mockDb.getWebhook.mockReturnValue(mockWebhook);

        const res = await request(app)
          .post('/api/v1/webhooks/wh-123/test')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/test event sent/i);
      });
    });
  });

  // ── Transactions ───────────────────────────────────────────

  describe('Transaction routes', () => {
    describe('GET /api/v1/transactions', () => {
      it('lists transactions', async () => {
        mockDb.listTransactions.mockReturnValue({
          items: [{ id: 'tx-1', payment_hash: '0xabc', direction: 'incoming', amount: '5000', currency: 'CKB', fee: '0', status: 'Succeeded', counterparty: null, description: null, metadata: null, created_at: '2026-07-04T00:00:00Z' }],
          total: 1,
        });

        const res = await request(app)
          .get('/api/v1/transactions')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
      });

      it('filters by direction', async () => {
        mockDb.listTransactions.mockReturnValue({ items: [], total: 0 });

        await request(app)
          .get('/api/v1/transactions?direction=incoming')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(mockDb.listTransactions).toHaveBeenCalledWith(
          expect.objectContaining({ direction: 'incoming' }),
        );
      });
    });

    describe('GET /api/v1/transactions/:id', () => {
      it('returns a transaction by id', async () => {
        mockDb.getTransaction.mockReturnValue({
          id: 'tx-1',
          payment_hash: '0xabc',
          direction: 'incoming',
          amount: '5000',
          currency: 'CKB',
          fee: '0',
          status: 'Succeeded',
          counterparty: null,
          description: null,
          metadata: null,
          created_at: '2026-07-04T00:00:00Z',
        });

        const res = await request(app)
          .get('/api/v1/transactions/tx-1')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('tx-1');
      });

      it('returns 404 for unknown transaction', async () => {
        mockDb.getTransaction.mockReturnValue(undefined);

        const res = await request(app)
          .get('/api/v1/transactions/nonexistent')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(404);
      });
    });
  });

  // ── Balance ────────────────────────────────────────────────

  describe('Balance routes', () => {
    describe('GET /api/v1/balance/channels', () => {
      it('returns channel balances', async () => {
        mockFiberClient.listChannels.mockResolvedValue([
          { localBalance: '500000', remoteBalance: '500000', capacity: '1000000', asset: 'CKB', channelId: 'ch-1', state: 'Ready', peerPubkey: '02abc' },
        ]);

        const res = await request(app)
          .get('/api/v1/balance/channels')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].asset).toBe('CKB');
      });
    });

    describe('GET /api/v1/balance/total', () => {
      it('returns total balance', async () => {
        mockFiberClient.listChannels.mockResolvedValue([
          { localBalance: '500000', remoteBalance: '500000' },
          { localBalance: '200000', remoteBalance: '800000' },
        ]);

        const res = await request(app)
          .get('/api/v1/balance/total')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.local).toBe('700000');
        expect(res.body.remote).toBe('1300000');
        expect(res.body.total).toBe('2000000');
      });
    });
  });

  // ── Fiber Status ─────────────────────────────────────────────

  describe('Fiber status routes', () => {
    describe('GET /api/v1/fiber/status', () => {
      it('returns live node, channel, and worker status', async () => {
        vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
        mockFiberClient.getNodeInfo.mockResolvedValue({
          node_id: '02node',
          version: '0.6.0',
          peers_count: '0x2',
          channels_count: '0x1',
          pending_channels_count: '0x0',
        });
        mockFiberClient.listChannels.mockResolvedValue([
          {
            localBalance: '700000',
            remoteBalance: '300000',
            capacity: '1000000',
            asset: 'CKB',
            channelId: 'ch-1',
            state: 'ChannelReady',
            peerPubkey: '02peer',
          },
        ]);

        const res = await request(app)
          .get('/api/v1/fiber/status')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.mode).toBe('live');
        expect(res.body.reachable).toBe(true);
        expect(res.body.node.nodeId).toBe('02node');
        expect(res.body.node.peersCount).toBe(2);
        expect(res.body.channels.ready).toBe(1);
        expect(res.body.channels.localBalance).toBe('700000');
        expect(res.body.worker.enabled).toBe(true);
      });

      it('returns degraded Fiber status when the node is unreachable', async () => {
        vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
        mockFiberClient.getNodeInfo.mockRejectedValue(new Error('Connection refused'));
        mockFiberClient.listChannels.mockRejectedValue(new Error('Connection refused'));

        const res = await request(app)
          .get('/api/v1/fiber/status')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.mode).toBe('live');
        expect(res.body.reachable).toBe(false);
        expect(res.body.node).toBeNull();
        expect(res.body.channels.total).toBe(0);
        expect(res.body.error).toMatch(/Connection refused/);
      });
    });
  });

  // ── Stats ──────────────────────────────────────────────────

  describe('Stats routes', () => {
    describe('GET /api/v1/stats', () => {
      it('returns dashboard stats', async () => {
        mockDb.getMerchantStats.mockReturnValue({
          totalInvoices: 100,
          paidInvoices: 75,
          totalVolume: '500000',
          successRate: 75,
        });
        mockFiberClient.listChannels.mockResolvedValue([
          { localBalance: '500000', remoteBalance: '500000' },
        ]);

        const res = await request(app)
          .get('/api/v1/stats')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.totalInvoices).toBe(100);
        expect(res.body.paidInvoices).toBe(75);
        expect(res.body.activeChannels).toBe(1);
      });

      it('handles channel fetch failure gracefully', async () => {
        mockDb.getMerchantStats.mockReturnValue({
          totalInvoices: 10,
          paidInvoices: 5,
          totalVolume: '50000',
          successRate: 50,
        });
        mockFiberClient.listChannels.mockRejectedValue(new Error('Network error'));

        const res = await request(app)
          .get('/api/v1/stats')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body.activeChannels).toBe(0);
      });
    });

    describe('GET /api/v1/stats/revenue', () => {
      it('returns revenue history', async () => {
        mockDb.getRevenueHistory.mockReturnValue([
          { date: '2026-07-01', volume: 1000, count: 2 },
          { date: '2026-07-02', volume: 2000, count: 3 },
        ]);

        const res = await request(app)
          .get('/api/v1/stats/revenue?days=7')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].date).toBe('2026-07-01');
      });
    });
  });

  // ── Rate Limiting ─────────────────────────────────────────

  describe('Rate limiting', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      vi.stubEnv('DISABLE_RATE_LIMIT', 'false');
      vi.stubEnv('RATE_LIMIT_WINDOW_MS', '60000');
      vi.stubEnv('RATE_LIMIT_MAX_REQUESTS', '3');
      app = createApp();

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get('/api/v1/invoices')
          .set('Authorization', `Bearer ${API_KEY}`);
        expect(res.status).toBe(200);
      }

      // 4th request should be rate limited
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${API_KEY}`);

      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/too many requests/i);

      vi.unstubAllEnvs();
    });

    it('can be disabled via DISABLE_RATE_LIMIT env var', async () => {
      vi.stubEnv('DISABLE_RATE_LIMIT', 'true');
      vi.stubEnv('RATE_LIMIT_WINDOW_MS', '60000');
      vi.stubEnv('RATE_LIMIT_MAX_REQUESTS', '1');
      app = createApp();

      // Should handle multiple requests without rate limiting
      const res1 = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${API_KEY}`);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${API_KEY}`);
      expect(res2.status).toBe(200);

      vi.unstubAllEnvs();
    });
  });

  // ── 404 Handler ────────────────────────────────────────────

  describe('404 handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/v1/unknown-route')
        .set('Authorization', `Bearer ${API_KEY}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });
});
