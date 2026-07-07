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
  event: WebhookEvent;
  url: string;
  status: number;
  success: boolean;
  attempts: number;
  payload: unknown;
  error?: string;
  deliveredAt: string;
}

/** Response returned after queueing a webhook test event */
export interface WebhookTestResponse {
  message: string;
  webhookId: string;
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
