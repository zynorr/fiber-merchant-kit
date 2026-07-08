/**
 * Fiber Merchant Kit — Type definitions
 */

/** Supported currency types */
export type Currency = 'CKB' | 'RUSD' | string;

/** Invoice status returned by the Fiber node */
export type FiberInvoiceStatus =
  | 'Open'
  | 'Received'
  | 'Paid'
  | 'Cancelled'
  | 'Expired';

/** Payment status returned by the Fiber node */
export type FiberPaymentStatus =
  | 'Pending'
  | 'Succeeded'
  | 'Failed'
  | 'Timeout'
  | 'Abandoned';

/** Invoice status in merchant system */
export type MerchantInvoiceStatus =
  | 'pending'      // Invoice created, waiting for payment
  | 'received'     // Payment detected but not yet settled
  | 'paid'         // Payment confirmed
  | 'expired'      // Invoice expired without payment
  | 'cancelled'    // Invoice manually cancelled
  | 'refunded';    // Payment was refunded

/** Webhook event types */
export type WebhookEvent =
  | 'invoice.created'
  | 'invoice.received'
  | 'invoice.paid'
  | 'invoice.expired'
  | 'invoice.cancelled'
  | 'invoice.refunded'
  | 'payment.failed'
  | 'channel.updated';

/** Create invoice request */
export interface CreateInvoiceRequest {
  amount: string | number;
  currency?: Currency;
  description?: string;
  metadata?: Record<string, string>;
  expiry?: number; // seconds
  webhookUrl?: string;
  allowMpp?: boolean;
  udtTypeScript?: {
    codeHash: string;
    hashType: string;
    args: string;
  };
}

/** Per-request options for invoice creation */
export interface CreateInvoiceOptions {
  /** Prevent duplicate checkout submissions from creating multiple invoices */
  idempotencyKey?: string;
}

/** Invoice object in merchant system */
export interface Invoice {
  id: string;
  paymentHash: string;
  invoiceAddress: string;
  amount: string;
  currency: Currency;
  description?: string;
  metadata?: Record<string, string>;
  status: MerchantInvoiceStatus;
  expiresAt: string;
  paidAt?: string;
  refundedAt?: string;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Webhook registration request */
export interface RegisterWebhookRequest {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  description?: string;
  active?: boolean;
}

/** Webhook endpoint */
export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

/** Webhook delivery log */
export interface WebhookDelivery {
  id: string;
  webhookId?: string;
  event: WebhookEvent;
  url: string;
  status: number;
  success: boolean;
  attempts: number;
  payload: unknown;
  error?: string;
  nextAttemptAt?: string;
  deliveredAt: string;
}

/** Response returned after queueing a webhook test event */
export interface WebhookTestResponse {
  message: string;
  webhookId: string;
}

/** Response returned after queueing a webhook delivery retry */
export interface WebhookRetryResponse {
  message: string;
  delivery: WebhookDelivery;
}

/** Transaction record */
export interface Transaction {
  id: string;
  paymentHash: string;
  invoiceId?: string;
  direction: 'incoming' | 'outgoing';
  amount: string;
  currency: Currency;
  fee: string;
  status: FiberPaymentStatus;
  counterparty?: string;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

/** Channel balance info */
export interface ChannelBalance {
  localBalance: string;
  remoteBalance: string;
  capacity: string;
  asset: Currency;
  channelId: string;
  state: string;
  peerPubkey: string;
}

/** Background invoice settlement worker status */
export interface SettlementWorkerStatus {
  enabled: boolean;
  active: boolean;
  running: boolean;
  mode: 'demo' | 'live';
  intervalMs: number;
  batchSize: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastSummary?: OpenInvoiceSettlementSummary;
}

/** Summary from one open-invoice settlement sweep */
export interface OpenInvoiceSettlementSummary {
  checked: number;
  paid: number;
  received: number;
  expired: number;
  unchanged: number;
  errors: number;
}

/** Response returned when manually triggering settlement reconciliation */
export interface SettlementRunResult {
  trigger: 'timer' | 'manual';
  running: boolean;
  skipped: boolean;
  startedAt: string;
  finishedAt?: string;
  summary?: OpenInvoiceSettlementSummary;
  error?: string;
}

/** Normalized Fiber node info for dashboard and diagnostics */
export interface FiberNodeStatus {
  nodeId: string;
  alias?: string;
  version?: string;
  chainHash?: string;
  peersCount: number;
  channelsCount: number;
  pendingChannelsCount: number;
}

/** Channel summary returned by the Fiber status endpoint */
export interface FiberChannelSummary {
  total: number;
  ready: number;
  pending: number;
  failed: number;
  localBalance: string;
  remoteBalance: string;
  totalCapacity: string;
  items: ChannelBalance[];
}

/** Live/demo Fiber node health and settlement status */
export interface FiberStatus {
  mode: 'demo' | 'live';
  reachable: boolean;
  rpcUrlConfigured: boolean;
  currency: string;
  checkedAt: string;
  worker: SettlementWorkerStatus;
  node: FiberNodeStatus | null;
  channels: FiberChannelSummary;
  error?: string;
}

/** Merchant API key */
export interface ApiKey {
  id: string;
  key: string;
  label: string;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  cursor?: string;
}

/** Merchant stats */
export interface MerchantStats {
  totalInvoices: number;
  paidInvoices: number;
  totalVolume: string;
  successRate: number;
  activeChannels: number;
  channelBalances: {
    local: string;
    remote: string;
  };
}

/** SDK client options */
export interface MerchantClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}
