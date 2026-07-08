import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDb,
  createDelivery,
  createMerchant,
  createWebhook,
  getDelivery,
  initDatabase,
  listDueWebhookDeliveryJobs,
  lockWebhookDelivery,
  updateDelivery,
} from '../db';
import { processWebhookDeliveryQueue } from '../services/webhook-delivery';

describe('webhook delivery outbox persistence', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiber-webhook-outbox-test-'));
    vi.stubEnv('FIBER_MERCHANT_DB_PATH', path.join(tempDir, 'merchant.db'));
    await initDatabase();
  });

  afterEach(() => {
    closeDb();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores new deliveries as due queued jobs with webhook secrets', () => {
    const merchant = createMerchant('Webhook Queue Merchant');
    const webhook = createWebhook({
      id: 'wh-queued',
      url: 'https://example.com/webhook',
      events: ['invoice.paid'],
      secret: 'whsec_test',
      merchantId: merchant.id,
    });

    const delivery = createDelivery({
      id: 'del-queued',
      webhookId: webhook.id,
      event: 'invoice.paid',
      url: webhook.url,
      payload: { id: 'inv-1', status: 'paid' },
    });

    const due = listDueWebhookDeliveryJobs(10);

    expect(delivery.success).toBe(0);
    expect(delivery.attempts).toBe(0);
    expect(delivery.next_attempt_at).toBeTruthy();
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      id: 'del-queued',
      webhook_id: 'wh-queued',
      secret: 'whsec_test',
    });
  });

  it('locks a queued delivery and hides future retries from due scans', () => {
    const merchant = createMerchant('Webhook Queue Merchant');
    const webhook = createWebhook({
      id: 'wh-retry',
      url: 'https://example.com/webhook',
      events: ['invoice.paid'],
      secret: 'whsec_test',
      merchantId: merchant.id,
    });
    createDelivery({
      id: 'del-retry',
      webhookId: webhook.id,
      event: 'invoice.paid',
      url: webhook.url,
      payload: { id: 'inv-1', status: 'paid' },
    });

    expect(lockWebhookDelivery('del-retry')).toBe(true);
    expect(lockWebhookDelivery('del-retry')).toBe(false);

    updateDelivery('del-retry', {
      statusCode: 500,
      success: false,
      attempts: 1,
      error: 'HTTP 500',
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(listDueWebhookDeliveryJobs(10)).toHaveLength(0);
  });

  it('resumes a failed delivery from SQLite after database restart', async () => {
    const merchant = createMerchant('Webhook Restart Merchant');
    const webhook = createWebhook({
      id: 'wh-resume',
      url: 'https://example.com/webhook',
      events: ['invoice.paid'],
      secret: 'whsec_test',
      merchantId: merchant.id,
    });
    createDelivery({
      id: 'del-resume',
      webhookId: webhook.id,
      event: 'invoice.paid',
      url: webhook.url,
      payload: { id: 'inv-1', status: 'paid' },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ status: 500 }));
    let summary = await processWebhookDeliveryQueue({ limit: 1 });
    expect(summary.rescheduled).toBe(1);

    closeDb();
    await initDatabase();
    updateDelivery('del-resume', {
      statusCode: 500,
      success: false,
      attempts: 1,
      error: 'HTTP 500',
      nextAttemptAt: new Date(Date.now() - 1_000).toISOString(),
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ status: 204 }));
    summary = await processWebhookDeliveryQueue({ limit: 1 });

    const delivery = getDelivery('del-resume');
    expect(summary.delivered).toBe(1);
    expect(delivery?.success).toBe(1);
    expect(delivery?.attempts).toBe(2);
    expect(delivery?.next_attempt_at).toBeNull();
  });
});
