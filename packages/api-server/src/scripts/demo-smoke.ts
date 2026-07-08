import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../app';
import { closeDb, initDatabase, seedDemoMerchant } from '../db';

interface ReceivedWebhook {
  event: string;
  signature: string;
  body: string;
  valid: boolean;
  parsed: {
    id?: string;
    type?: string;
    data?: Record<string, unknown>;
  };
}

interface WebhookRegistration {
  id: string;
  secret: string;
}

interface InvoiceResponse {
  id: string;
  status: string;
  amount: string;
  currency: string;
  invoiceAddress: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface TransactionResponse {
  id: string;
  invoiceId?: string;
  status: string;
  direction: string;
}

interface DeliveryResponse {
  event: string;
  success: boolean;
  status: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pass(message: string): void {
  console.log(`PASS ${message}`);
}

async function listen(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  return (server.address() as AddressInfo).port;
}

async function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function requestJson<T>(
  baseUrl: string,
  pathName: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) as T : undefined;
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathName} failed with HTTP ${response.status}: ${text}`);
  }
  return body as T;
}

async function requestText(baseUrl: string, pathName: string): Promise<string> {
  const response = await fetch(`${baseUrl}${pathName}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${pathName} failed with HTTP ${response.status}: ${text}`);
  }
  return text;
}

async function waitFor<T>(
  label: string,
  predicate: () => T | undefined | false | Promise<T | undefined | false>,
  timeoutMs = 5_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function createWebhookReceiver(secretRef: { current: string }) {
  const received: ReceivedWebhook[] = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const event = String(req.headers['x-fiber-event'] || '');
      const signature = String(req.headers['x-fiber-signature'] || '');
      const expected = crypto
        .createHmac('sha256', secretRef.current)
        .update(body)
        .digest('hex');
      const valid = signature.length === expected.length
        && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

      received.push({
        event,
        signature,
        body,
        valid,
        parsed: JSON.parse(body) as ReceivedWebhook['parsed'],
      });

      res.statusCode = 204;
      res.end();
    });
  });

  return { server, received };
}

async function main(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiber-merchant-smoke-'));
  const webhookSecret = { current: '' };
  const webhookReceiver = createWebhookReceiver(webhookSecret);

  process.env.NODE_ENV = 'development';
  process.env.FIBER_NODE_RPC_URL = 'demo';
  process.env.FIBER_MERCHANT_DB_PATH = path.join(tempDir, 'merchant.db');
  process.env.DISABLE_RATE_LIMIT = 'true';

  const apiServer = http.createServer(createApp());

  try {
    await initDatabase();
    const merchant = seedDemoMerchant();
    const apiPort = await listen(apiServer);
    const webhookPort = await listen(webhookReceiver.server);
    const baseUrl = `http://127.0.0.1:${apiPort}`;
    const authHeaders = { Authorization: `Bearer ${merchant.apiKey}` };

    const root = await requestText(baseUrl, '/');
    assert(root.includes('Fiber Merchant Kit'), 'root index should identify the project');
    pass('root server index is available');

    const discovery = await requestJson<{ mode: string; publicEndpoints: string[] }>(baseUrl, '/api/v1');
    assert(discovery.mode === 'demo', 'API discovery should report demo mode');
    assert(discovery.publicEndpoints.includes('GET /api/v1/health'), 'discovery should list health endpoint');
    pass('API discovery metadata is available');

    const health = await requestJson<{ status: string; fiberNode: { node_id?: string } }>(baseUrl, '/api/v1/health');
    assert(health.status === 'ok', 'health check should be ok in demo mode');
    assert(health.fiberNode.node_id === 'demo-node', 'health check should use demo Fiber node');
    pass('health check reaches demo Fiber client');

    const webhook = await requestJson<WebhookRegistration>(baseUrl, '/api/v1/webhooks', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        url: `http://127.0.0.1:${webhookPort}/webhook`,
        events: ['invoice.created', 'invoice.paid'],
        description: 'Local demo smoke receiver',
      }),
    });
    webhookSecret.current = webhook.secret;
    assert(webhook.id && webhook.secret, 'webhook registration should return id and secret');
    pass('webhook endpoint registered');

    const invoice = await requestJson<InvoiceResponse>(baseUrl, '/api/v1/invoices', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount: '12345',
        currency: 'CKB',
        description: 'Demo smoke checkout',
        metadata: { source: 'demo-smoke' },
      }),
    });
    assert(invoice.status === 'pending', 'created invoice should start pending');
    assert(invoice.invoiceAddress, 'created invoice should include payment address');
    pass(`invoice created (${invoice.id})`);

    await waitFor('invoice.created webhook', () =>
      webhookReceiver.received.find((delivery) =>
        delivery.event === 'invoice.created'
          && delivery.valid
          && delivery.parsed.data?.id === invoice.id,
      ),
    );
    pass('invoice.created webhook delivered with valid signature');

    const paidInvoice = await requestJson<InvoiceResponse>(baseUrl, `/api/v1/invoices/${invoice.id}/simulate-payment`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(paidInvoice.status === 'paid', 'simulated payment should mark invoice paid');
    pass('demo payment simulation marked invoice paid');

    await waitFor('invoice.paid webhook', () =>
      webhookReceiver.received.find((delivery) =>
        delivery.event === 'invoice.paid'
          && delivery.valid
          && delivery.parsed.data?.id === invoice.id,
      ),
    );
    pass('invoice.paid webhook delivered with valid signature');

    const transactions = await requestJson<PaginatedResponse<TransactionResponse>>(
      baseUrl,
      '/api/v1/transactions?direction=incoming',
      { headers: authHeaders },
    );
    const paidTransaction = transactions.items.find((item) =>
      item.invoiceId === invoice.id && item.status === 'Succeeded',
    );
    assert(paidTransaction, 'paid invoice should have a succeeded incoming transaction');
    pass(`succeeded transaction recorded (${paidTransaction.id})`);

    const stats = await requestJson<{ paidInvoices: number; totalVolume: string }>(
      baseUrl,
      '/api/v1/stats',
      { headers: authHeaders },
    );
    assert(stats.paidInvoices >= 1, 'stats should include the paid invoice');
    assert(Number(stats.totalVolume) >= Number(invoice.amount), 'stats should include paid volume');
    pass('dashboard stats reflect paid invoice');

    const deliveries = await waitFor('successful webhook delivery logs', async () => {
      const rows = await requestJson<DeliveryResponse[]>(
        baseUrl,
        `/api/v1/webhooks/${webhook.id}/deliveries`,
        { headers: authHeaders },
      );
      const successfulEvents = new Set(rows.filter((row) => row.success).map((row) => row.event));
      return successfulEvents.has('invoice.created') && successfulEvents.has('invoice.paid')
        ? rows
        : undefined;
    });
    assert(deliveries.length >= 2, 'delivery logs should include both webhook events');
    pass('webhook delivery logs recorded successful deliveries');

    const settlement = await requestJson<{ skipped: boolean; summary?: { checked: number } }>(
      baseUrl,
      '/api/v1/fiber/settlement/run',
      { method: 'POST', headers: authHeaders },
    );
    assert(settlement.skipped === false, 'manual settlement sweep should run');
    assert(settlement.summary, 'manual settlement sweep should return a summary');
    pass('manual settlement sweep endpoint runs');

    console.log('\nDemo smoke passed');
    console.log(JSON.stringify({
      invoiceId: invoice.id,
      transactionId: paidTransaction.id,
      webhookId: webhook.id,
      receivedWebhooks: webhookReceiver.received.length,
    }, null, 2));
  } finally {
    await closeServer(apiServer);
    await closeServer(webhookReceiver.server);
    closeDb();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`FAIL ${message}`);
  process.exit(1);
});
