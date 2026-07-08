import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbWebhook, DbWebhookDelivery } from '../db/types';
import { processWebhookDeliveryQueue, replayWebhookDelivery } from '../services/webhook-delivery';

const mockDb = vi.hoisted(() => ({
  createDelivery: vi.fn(),
  getWebhookDeliveryJob: vi.fn(),
  listDueWebhookDeliveryJobs: vi.fn(),
  lockWebhookDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  listWebhooks: vi.fn(),
}));

vi.mock('../db', () => mockDb);

describe('webhook delivery service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('replays an existing delivery as a fresh delivery log', async () => {
    const webhook: DbWebhook = {
      id: 'wh-1',
      url: 'https://example.com/hook',
      events: JSON.stringify(['invoice.paid']),
      secret: 'whsec_test',
      description: null,
      active: 1,
      merchant_id: 'merchant-1',
      created_at: '2026-07-04T12:00:00Z',
    };
    const original: DbWebhookDelivery = {
      id: 'del-original',
      webhook_id: 'wh-1',
      event: 'invoice.paid',
      url: 'https://example.com/hook',
      status_code: 500,
      success: 0,
      attempts: 5,
      payload: JSON.stringify({ id: 'inv-1', status: 'paid' }),
      error: 'HTTP 500',
      delivered_at: '2026-07-04T12:05:00Z',
    };
    const fresh: DbWebhookDelivery = {
      ...original,
      id: 'del-retry',
      status_code: null,
      success: 0,
      attempts: null,
      error: null,
      next_attempt_at: '2026-07-04T12:06:00Z',
      locked_at: null,
      delivered_at: '2026-07-04T12:06:00Z',
    };

    mockDb.createDelivery.mockReturnValue(fresh);
    mockDb.getWebhookDeliveryJob.mockReturnValue({ ...fresh, secret: webhook.secret });
    mockDb.lockWebhookDelivery.mockReturnValue(true);

    const replay = replayWebhookDelivery(webhook, original);

    expect(replay).toBe(fresh);
    expect(mockDb.createDelivery).toHaveBeenCalledWith({
      id: expect.any(String),
      webhookId: 'wh-1',
      event: 'invoice.paid',
      url: 'https://example.com/hook',
      payload: { id: 'inv-1', status: 'paid' },
    });

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Fiber-Event': 'invoice.paid' }),
          body: expect.any(String),
        }),
      );
    });

    const [, request] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(request!.body as string)).toMatchObject({
      id: 'del-retry',
      type: 'invoice.paid',
      data: { id: 'inv-1', status: 'paid' },
    });
    await vi.waitFor(() => {
      expect(mockDb.updateDelivery).toHaveBeenCalledWith('del-retry', {
        statusCode: 200,
        success: true,
        attempts: 1,
        nextAttemptAt: null,
      });
    });
  });

  it('reschedules failed deliveries instead of sleeping in memory', async () => {
    const job = {
      id: 'del-failed',
      webhook_id: 'wh-1',
      event: 'invoice.paid',
      url: 'https://example.com/hook',
      status_code: null,
      success: 0,
      attempts: 0,
      payload: JSON.stringify({ id: 'inv-1', status: 'paid' }),
      error: null,
      next_attempt_at: new Date().toISOString(),
      locked_at: null,
      delivered_at: '2026-07-04T12:06:00Z',
      secret: 'whsec_test',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 500 }));
    mockDb.listDueWebhookDeliveryJobs.mockReturnValue([job]);
    mockDb.getWebhookDeliveryJob.mockReturnValue(job);
    mockDb.lockWebhookDelivery.mockReturnValue(true);

    const summary = await processWebhookDeliveryQueue({ limit: 1 });

    expect(summary.checked).toBe(1);
    expect(summary.rescheduled).toBe(1);
    expect(mockDb.updateDelivery).toHaveBeenCalledWith('del-failed', expect.objectContaining({
      statusCode: 500,
      success: false,
      attempts: 1,
      error: 'HTTP 500',
      nextAttemptAt: expect.any(String),
    }));
  });
});
