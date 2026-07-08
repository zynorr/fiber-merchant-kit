import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginIdempotencyRequest,
  closeDb,
  completeIdempotencyRequest,
  createMerchant,
  deleteIdempotencyRequest,
  getIdempotencyRecord,
  initDatabase,
} from '../db';

describe('idempotency persistence', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiber-idempotency-test-'));
    vi.stubEnv('FIBER_MERCHANT_DB_PATH', path.join(tempDir, 'merchant.db'));
    await initDatabase();
  });

  afterEach(() => {
    closeDb();
    vi.unstubAllEnvs();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates one record per merchant, key, method, and route', () => {
    const merchant = createMerchant('Idempotency Test Merchant');
    const first = beginIdempotencyRequest({
      merchantId: merchant.id,
      key: 'order-123',
      requestHash: 'hash-a',
      method: 'POST',
      route: '/api/v1/invoices',
    });

    const second = beginIdempotencyRequest({
      merchantId: merchant.id,
      key: 'order-123',
      requestHash: 'hash-a',
      method: 'POST',
      route: '/api/v1/invoices',
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.resource_id).toBeNull();
  });

  it('stores the completed resource for later replay', () => {
    const merchant = createMerchant('Idempotency Test Merchant');
    const started = beginIdempotencyRequest({
      merchantId: merchant.id,
      key: 'order-456',
      requestHash: 'hash-b',
      method: 'POST',
      route: '/api/v1/invoices',
    });

    completeIdempotencyRequest(started.record.id, {
      resourceType: 'invoice',
      resourceId: 'inv-456',
      statusCode: 201,
    });

    const completed = getIdempotencyRecord({
      merchantId: merchant.id,
      key: 'order-456',
      method: 'POST',
      route: '/api/v1/invoices',
    });

    expect(completed?.request_hash).toBe('hash-b');
    expect(completed?.resource_type).toBe('invoice');
    expect(completed?.resource_id).toBe('inv-456');
    expect(completed?.status_code).toBe(201);
  });

  it('can remove an incomplete record after a failed request', () => {
    const merchant = createMerchant('Idempotency Test Merchant');
    const started = beginIdempotencyRequest({
      merchantId: merchant.id,
      key: 'order-789',
      requestHash: 'hash-c',
      method: 'POST',
      route: '/api/v1/invoices',
    });

    deleteIdempotencyRequest(started.record.id);
    const retry = beginIdempotencyRequest({
      merchantId: merchant.id,
      key: 'order-789',
      requestHash: 'hash-c',
      method: 'POST',
      route: '/api/v1/invoices',
    });

    expect(retry.created).toBe(true);
    expect(retry.record.id).not.toBe(started.record.id);
  });
});
