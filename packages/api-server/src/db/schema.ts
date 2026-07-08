/**
 * SQLite Schema for Fiber Merchant Kit
 *
 * Tables:
 * - merchants: API key authentication and merchant profile
 * - invoices: Payment invoice records
 * - webhooks: Registered webhook endpoints
 * - webhook_deliveries: Webhook delivery logs
 * - transactions: Payment transaction history
 * - idempotency_keys: Replay protection for duplicate mutation requests
 */

export const SCHEMA_SQL = `
  -- Merchants
  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    api_key TEXT UNIQUE NOT NULL,
    label TEXT,
    role TEXT NOT NULL DEFAULT 'owner',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT
  );

  -- Merchant user identities for production RBAC expansion.
  CREATE TABLE IF NOT EXISTS merchant_users (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (merchant_id, email),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  -- Invoices (payment requests)
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    payment_hash TEXT UNIQUE NOT NULL,
    preimage TEXT,
    invoice_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CKB',
    description TEXT,
    metadata TEXT, -- JSON string
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    paid_at TEXT,
    refunded_at TEXT,
    webhook_url TEXT,
    merchant_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  -- Webhook endpoints
  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT NOT NULL, -- JSON array
    secret TEXT NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1,
    merchant_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  -- Webhook delivery logs
  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT,
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    payload TEXT, -- JSON
    error TEXT,
    next_attempt_at TEXT DEFAULT (datetime('now')),
    locked_at TEXT,
    delivered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
  );

  -- Transactions (payment history)
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    payment_hash TEXT NOT NULL,
    invoice_id TEXT,
    direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CKB',
    fee TEXT DEFAULT '0',
    status TEXT NOT NULL,
    counterparty TEXT,
    description TEXT,
    metadata TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );

  -- Idempotency records for mutation endpoints
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    method TEXT NOT NULL,
    route TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    status_code INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE (merchant_id, idempotency_key, method, route),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant_id);
  CREATE INDEX IF NOT EXISTS idx_merchant_users_merchant ON merchant_users(merchant_id);
  CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(merchant_id, idempotency_key, method, route);
`;
