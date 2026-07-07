import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbWebhook, DbWebhookDelivery } from '../db/types';
import { replayWebhookDelivery } from '../services/webhook-delivery';

const mockDb = vi.hoisted(() => ({
  createDelivery: vi.fn(),
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
      attempts: null,
      error: null,
      delivered_at: '2026-07-04T12:06:00Z',
    };

    mockDb.createDelivery.mockReturnValue(fresh);

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
      });
    });
  });
});
