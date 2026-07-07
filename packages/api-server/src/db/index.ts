/**
 * Database client for Fiber Merchant Kit
 * Uses sql.js (pure WASM SQLite — no native compilation needed)
 *
 * Note: Database saves to disk automatically after every write via PreparedStmt.run().
 */

import crypto from 'crypto';
import path from 'path';
import { DbWrapper } from './database';
import { SCHEMA_SQL } from './schema';
import type {
  DbMerchant,
  DbInvoice,
  DbWebhook,
  DbWebhookDelivery,
  DbTransaction,
  PaginatedResult,
  MerchantStats,
  RevenueRow,
} from './types';

let db: DbWrapper;

/** Initialise the database (must be called once before any query) */
export async function initDatabase(): Promise<void> {
  const dbPath = process.env.FIBER_MERCHANT_DB_PATH || path.join(process.cwd(), 'data', 'merchant.db');
  db = new DbWrapper(dbPath);
  await db.init();
  db.exec(SCHEMA_SQL);
}

export function getDb(): DbWrapper {
  if (!db) throw new Error('Database not initialised. Call initDatabase() first.');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}

// ── Merchant queries ──────────────────────────────────────────

export function findMerchantByApiKey(apiKey: string): DbMerchant | undefined {
  const d = getDb();
  const row = d.prepare(
    'SELECT * FROM merchants WHERE api_key = ? AND active = 1',
  ).get<DbMerchant>(apiKey);
  if (row) {
    d.prepare('UPDATE merchants SET last_used_at = datetime("now") WHERE api_key = ?').run(apiKey);
  }
  return row;
}

export function createMerchant(label?: string): DbMerchant {
  const d = getDb();
  const id = crypto.randomUUID();
  const apiKey = `fm_sk_${Buffer.from(crypto.randomBytes(32)).toString('hex')}`;
  d.prepare('INSERT INTO merchants (id, api_key, label) VALUES (?, ?, ?)').run(id, apiKey, label || null);
  return d.prepare('SELECT * FROM merchants WHERE id = ?').get<DbMerchant>(id)!;
}

// ── Invoice queries ───────────────────────────────────────────

export function createInvoice(data: {
  id: string;
  paymentHash: string;
  preimage: string;
  invoiceAddress: string;
  amount: string;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  expiresAt: string;
  webhookUrl?: string;
  merchantId?: string;
}): DbInvoice {
  const d = getDb();
  d.prepare(`
    INSERT INTO invoices (id, payment_hash, preimage, invoice_address, amount, currency, description, metadata, expires_at, webhook_url, merchant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.paymentHash,
    data.preimage,
    data.invoiceAddress,
    data.amount,
    data.currency,
    data.description || null,
    data.metadata ? JSON.stringify(data.metadata) : null,
    data.expiresAt,
    data.webhookUrl || null,
    data.merchantId || null,
  );
  return getInvoice(data.id)!;
}

export function getInvoice(id: string): DbInvoice | undefined {
  const d = getDb();
  const row = d.prepare('SELECT * FROM invoices WHERE id = ?').get<DbInvoice>(id);
  if (row && typeof row.metadata === 'string') {
    try {
      (row as unknown as Record<string, unknown>).metadata = JSON.parse(row.metadata);
    } catch { /* ignore */ }
  }
  return row;
}

export function getInvoiceByPaymentHash(paymentHash: string): DbInvoice | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM invoices WHERE payment_hash = ?').get<DbInvoice>(paymentHash);
}

export function listInvoices(params: {
  status?: string;
  limit?: number;
  cursor?: string;
  merchantId?: string;
}): PaginatedResult<DbInvoice> {
  const d = getDb();
  const limit = params.limit || 50;
  const whereConditions: string[] = [];
  const binds: unknown[] = [];

  if (params.status) { whereConditions.push('status = ?'); binds.push(params.status); }
  if (params.merchantId) { whereConditions.push('merchant_id = ?'); binds.push(params.merchantId); }

  const where = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const total = d.prepare(`SELECT COUNT(*) as count FROM invoices ${where}`).get<{ count: number }>(...binds)!.count;

  if (params.cursor) {
    whereConditions.push('id < ?');
    binds.push(params.cursor);
  }

  const cursorWhere = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const rows = d.prepare(
    `SELECT * FROM invoices ${cursorWhere} ORDER BY created_at DESC LIMIT ?`,
  ).all<DbInvoice>(...binds, limit);

  for (const row of rows) {
    if (typeof row.metadata === 'string') {
      try {
        (row as unknown as Record<string, unknown>).metadata = JSON.parse(row.metadata);
      } catch { /* ignore */ }
    }
  }

  const cursor = rows.length === limit ? (rows[rows.length - 1].id as string) : undefined;
  return { items: rows, total, cursor };
}

export function updateInvoiceStatus(id: string, status: string): void {
  const d = getDb();
  const updates: string[] = ['status = ?', 'updated_at = datetime("now")'];
  const binds: unknown[] = [status];
  if (status === 'paid') updates.push('paid_at = datetime("now")');
  if (status === 'refunded') updates.push('refunded_at = datetime("now")');
  d.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...binds, id);
}

// ── Webhook queries ───────────────────────────────────────────

export function createWebhook(data: {
  id: string;
  url: string;
  events: string[];
  secret: string;
  description?: string;
  merchantId?: string;
}): DbWebhook {
  const d = getDb();
  d.prepare(`
    INSERT INTO webhooks (id, url, events, secret, description, merchant_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.id, data.url, JSON.stringify(data.events), data.secret, data.description || null, data.merchantId || null);
  return getWebhook(data.id)!;
}

export function getWebhook(id: string): DbWebhook | undefined {
  const d = getDb();
  const row = d.prepare('SELECT * FROM webhooks WHERE id = ?').get<DbWebhook>(id);
  if (row && typeof row.events === 'string') {
    try { (row as unknown as Record<string, unknown>).events = JSON.parse(row.events); } catch { /* ignore */ }
  }
  return row;
}

export function listWebhooks(merchantId?: string): DbWebhook[] {
  const d = getDb();
  const rows = merchantId
    ? d.prepare('SELECT * FROM webhooks WHERE merchant_id = ? AND active = 1').all<DbWebhook>(merchantId)
    : d.prepare('SELECT * FROM webhooks WHERE active = 1').all<DbWebhook>();
  return rows.map((row) => {
    if (typeof row.events === 'string') {
      try { (row as unknown as Record<string, unknown>).events = JSON.parse(row.events); } catch { /* ignore */ }
    }
    return row;
  });
}

export function updateWebhook(id: string, data: Partial<{ url: string; events: string[]; description: string; active: boolean }>): DbWebhook | undefined {
  const d = getDb();
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (data.url) { sets.push('url = ?'); binds.push(data.url); }
  if (data.events) { sets.push('events = ?'); binds.push(JSON.stringify(data.events)); }
  if (data.description !== undefined) { sets.push('description = ?'); binds.push(data.description); }
  if (data.active !== undefined) { sets.push('active = ?'); binds.push(data.active ? 1 : 0); }
  if (sets.length > 0) {
    binds.push(id);
    d.prepare(`UPDATE webhooks SET ${sets.join(', ')} WHERE id = ?`).run(...binds);
  }
  return getWebhook(id);
}

export function deleteWebhook(id: string): void {
  getDb().prepare('DELETE FROM webhooks WHERE id = ?').run(id);
}

// ── Webhook delivery queries ──────────────────────────────────

export function createDelivery(data: {
  id: string;
  webhookId: string;
  event: string;
  url: string;
  payload: unknown;
}): void {
  getDb().prepare(`
    INSERT INTO webhook_deliveries (id, webhook_id, event, url, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.id, data.webhookId, data.event, data.url, JSON.stringify(data.payload));
}

export function updateDelivery(id: string, data: { statusCode: number; success: boolean; attempts?: number; error?: string }): void {
  getDb().prepare(`
    UPDATE webhook_deliveries SET status_code = ?, success = ?, attempts = ?, error = ? WHERE id = ?
  `).run(data.statusCode, data.success ? 1 : 0, data.attempts || 1, data.error || null, id);
}

export function getDeliveries(webhookId: string): DbWebhookDelivery[] {
  return getDb().prepare(
    'SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY delivered_at DESC LIMIT 50',
  ).all<DbWebhookDelivery>(webhookId);
}

// ── Transaction queries ────────────────────────────────────────

export function createTransaction(data: {
  id: string;
  paymentHash: string;
  invoiceId?: string;
  direction: string;
  amount: string;
  currency: string;
  fee?: string;
  status: string;
  counterparty?: string;
  description?: string;
  metadata?: Record<string, string>;
}): DbTransaction {
  const d = getDb();
  d.prepare(`
    INSERT INTO transactions (id, payment_hash, invoice_id, direction, amount, currency, fee, status, counterparty, description, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.paymentHash, data.invoiceId || null,
    data.direction, data.amount, data.currency, data.fee || '0',
    data.status, data.counterparty || null, data.description || null,
    data.metadata ? JSON.stringify(data.metadata) : null,
  );
  return d.prepare('SELECT * FROM transactions WHERE id = ?').get<DbTransaction>(data.id)!;
}

export function listTransactions(params: {
  status?: string;
  direction?: string;
  limit?: number;
  cursor?: string;
  merchantId?: string;
}): PaginatedResult<DbTransaction> {
  const d = getDb();
  const limit = params.limit || 50;
  const whereConditions: string[] = [];
  const binds: unknown[] = [];

  if (params.status) { whereConditions.push('status = ?'); binds.push(params.status); }
  if (params.direction) { whereConditions.push('direction = ?'); binds.push(params.direction); }
  if (params.merchantId) {
    whereConditions.push('invoice_id IN (SELECT id FROM invoices WHERE merchant_id = ?)');
    binds.push(params.merchantId);
  }

  const where = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const total = d.prepare(`SELECT COUNT(*) as count FROM transactions ${where}`).get<{ count: number }>(...binds)!.count;

  if (params.cursor) {
    whereConditions.push('id < ?');
    binds.push(params.cursor);
  }

  const cursorWhere = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const rows = d.prepare(
    `SELECT * FROM transactions ${cursorWhere} ORDER BY created_at DESC LIMIT ?`,
  ).all<DbTransaction>(...binds, limit);

  const cursor = rows.length === limit ? (rows[rows.length - 1].id as string) : undefined;
  return { items: rows, total, cursor };
}

export function getTransaction(id: string): DbTransaction | undefined {
  return getDb().prepare('SELECT * FROM transactions WHERE id = ?').get<DbTransaction>(id);
}

// ── Stats queries ─────────────────────────────────────────────

export function getMerchantStats(merchantId?: string): MerchantStats {
  const d = getDb();
  const mf = merchantId ? 'WHERE merchant_id = ?' : '';
  const mb = merchantId ? [merchantId] : [];

  const total = d.prepare(`SELECT COUNT(*) as c FROM invoices ${mf}`).get<{ c: number }>(...mb)!.c;
  const paid  = d.prepare(`SELECT COUNT(*) as c FROM invoices ${mf} ${mf ? 'AND' : 'WHERE'} status = 'paid'`).get<{ c: number }>(...mb)!.c;
  const vol   = d.prepare(`SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) as v FROM invoices ${mf} ${mf ? 'AND' : 'WHERE'} status = 'paid'`).get<{ v: number }>(...mb)!.v;
  const successRate = total > 0 ? Math.round((paid / total) * 100) : 0;
  return { totalInvoices: total, paidInvoices: paid, totalVolume: String(vol), successRate };
}

export function getRevenueHistory(days: number = 30, merchantId?: string): RevenueRow[] {
  const d = getDb();
  const merchantFilter = merchantId ? 'AND merchant_id = ?' : '';
  const binds: unknown[] = [`-${days} days`];
  if (merchantId) binds.push(merchantId);
  return d.prepare(`
    SELECT date(paid_at) as date, COALESCE(SUM(CAST(amount AS INTEGER)), 0) as volume, COUNT(*) as count
    FROM invoices
    WHERE status = 'paid' AND paid_at >= datetime('now', ?) ${merchantFilter}
    GROUP BY date(paid_at)
    ORDER BY date ASC
  `).all<RevenueRow>(...binds);
}

// ── Channel balance queries (dummy for demo) ──────────────────

export function getChannelBalances(): { localBalance: string; remoteBalance: string; capacity: string; asset: string }[] {
  return [
    { localBalance: '500000', remoteBalance: '500000', capacity: '1000000', asset: 'CKB' },
    { localBalance: '200000', remoteBalance: '800000', capacity: '1000000', asset: 'RUSD' },
  ];
}

/** Initialise default merchant for demo */
export function seedDemoMerchant(): { id: string; apiKey: string } {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM merchants LIMIT 1').get<DbMerchant>();
  if (existing) return { id: existing.id, apiKey: existing.api_key };

  const result = createMerchant('Demo Merchant');
  return { id: result.id, apiKey: result.api_key };
}
