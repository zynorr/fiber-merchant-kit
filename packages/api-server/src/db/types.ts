/**
 * Fiber Merchant Kit — Typed database row interfaces
 *
 * Each interface matches the snake_case columns of the corresponding SQLite table.
 * These are the raw shapes returned by better-sqlite3.
 */

export interface DbMerchant {
  id: string;
  api_key: string;
  label: string | null;
  role?: MerchantRole;
  active: number;
  created_at: string;
  last_used_at: string | null;
}

export type MerchantRole = 'owner' | 'admin' | 'developer' | 'viewer';

export interface DbMerchantUser {
  id: string;
  merchant_id: string;
  email: string;
  name: string | null;
  role: MerchantRole;
  active: number;
  created_at: string;
}

export interface DbInvoice {
  id: string;
  payment_hash: string;
  preimage: string | null;
  invoice_address: string;
  amount: string;
  currency: string;
  description: string | null;
  /** JSON-encoded string or parsed object after getInvoice processes it */
  metadata: string | Record<string, string> | null;
  status: string;
  expires_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  webhook_url: string | null;
  merchant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbWebhook {
  id: string;
  url: string;
  /** JSON-encoded array of event strings */
  events: string | string[];
  secret: string;
  description: string | null;
  active: number;
  merchant_id: string | null;
  created_at: string;
}

export interface DbWebhookDelivery {
  id: string;
  webhook_id: string | null;
  event: string;
  url: string;
  status_code: number | null;
  success: number;
  attempts: number | null;
  payload: string | null;
  error: string | null;
  next_attempt_at?: string | null;
  locked_at?: string | null;
  delivered_at: string;
}

export interface DbWebhookDeliveryJob extends DbWebhookDelivery {
  secret: string;
}

export interface DbTransaction {
  id: string;
  payment_hash: string;
  invoice_id: string | null;
  direction: string;
  amount: string;
  currency: string;
  fee: string;
  status: string;
  counterparty: string | null;
  description: string | null;
  metadata: string | null;
  created_at: string;
}

export interface DbIdempotencyKey {
  id: string;
  merchant_id: string;
  idempotency_key: string;
  request_hash: string;
  method: string;
  route: string;
  resource_type: string | null;
  resource_id: string | null;
  status_code: number | null;
  created_at: string;
  updated_at: string;
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  cursor?: string;
}

/** Merchant stats (computed from DB) */
export interface MerchantStats {
  totalInvoices: number;
  paidInvoices: number;
  totalVolume: string;
  successRate: number;
}

/** Revenue history row (from SQL aggregation) */
export interface RevenueRow {
  date: string;
  volume: number;
  count: number;
}
