/**
 * MerchantClient — Main SDK class for the Fiber Merchant Kit
 *
 * The MerchantClient connects to the Fiber Merchant API Server
 * which abstracts away the complexity of direct Fiber node RPC calls,
 * preimage management, webhook delivery, and database storage.
 *
 * @example
 * ```typescript
 * import { MerchantClient } from '@fiber-merchant/sdk';
 *
 * const client = new MerchantClient({
 *   baseUrl: 'https://api.mymerchant.com',
 *   apiKey: 'fm_sk_...'
 * });
 *
 * // Create an invoice
 * const invoice = await client.invoices.create({
 *   amount: '1000',
 *   currency: 'CKB',
 *   description: 'Order #1234'
 * });
 *
 * // Check payment status
 * const status = await client.invoices.get(invoice.id);
 * ```
 */

import { ofetch, type $Fetch } from 'ofetch';
import type {
  MerchantClientOptions,
  Invoice,
  CreateInvoiceRequest,
  CreateInvoiceOptions,
  WebhookEndpoint,
  RegisterWebhookRequest,
  WebhookDelivery,
  WebhookRetryResponse,
  WebhookTestResponse,
  Transaction,
  ChannelBalance,
  FiberStatus,
  SettlementRunResult,
  MerchantStats,
  ApiKey,
  PaginatedResponse,
} from './types';

export class MerchantClient {
  private readonly fetch: $Fetch;
  public readonly invoices: InvoiceResource;
  public readonly webhooks: WebhookResource;
  public readonly transactions: TransactionResource;
  public readonly balance: BalanceResource;
  public readonly fiber: FiberResource;
  public readonly stats: StatsResource;

  constructor(options: MerchantClientOptions) {
    const { baseUrl, apiKey, timeout = 30_000 } = options;
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

    this.fetch = ofetch.create({
      baseURL: normalizedBaseUrl.endsWith('/api/v1')
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/api/v1`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout,
    });

    this.invoices = new InvoiceResource(this.fetch);
    this.webhooks = new WebhookResource(this.fetch);
    this.transactions = new TransactionResource(this.fetch);
    this.balance = new BalanceResource(this.fetch);
    this.fiber = new FiberResource(this.fetch);
    this.stats = new StatsResource(this.fetch);
  }

  /** Health check — verify the API server is reachable */
  async health(): Promise<{ status: string; version: string }> {
    return this.fetch('/health');
  }
}

class InvoiceResource {
  constructor(private fetch: $Fetch) {}

  /** Create a new invoice for receiving a payment */
  async create(data: CreateInvoiceRequest, options: CreateInvoiceOptions = {}): Promise<Invoice> {
    const headers = options.idempotencyKey
      ? { 'Idempotency-Key': options.idempotencyKey }
      : undefined;

    return this.fetch('/invoices', {
      method: 'POST',
      body: data,
      ...(headers ? { headers } : {}),
    });
  }

  /** Get invoice details and status by ID */
  async get(id: string): Promise<Invoice> {
    return this.fetch(`/invoices/${id}`);
  }

  /** List invoices with optional filters */
  async list(params?: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Invoice>> {
    return this.fetch('/invoices', { params });
  }

  /** Cancel an open invoice */
  async cancel(id: string): Promise<Invoice> {
    return this.fetch(`/invoices/${id}/cancel`, { method: 'POST' });
  }

  /** Issue a refund for a paid invoice — sends payment back to the original payer */
  async refund(id: string, reason?: string): Promise<Invoice> {
    return this.fetch(`/invoices/${id}/refund`, {
      method: 'POST',
      body: { reason },
    });
  }

  /** Get the QR code data for an invoice (Bech32m encoded string) */
  async getQrCode(id: string): Promise<{ invoiceAddress: string; qrData: string }> {
    return this.fetch(`/invoices/${id}/qr`);
  }
}

class WebhookResource {
  constructor(private fetch: $Fetch) {}

  /** Register a new webhook endpoint */
  async register(data: RegisterWebhookRequest): Promise<WebhookEndpoint> {
    return this.fetch('/webhooks', {
      method: 'POST',
      body: data,
    });
  }

  /** List all registered webhooks */
  async list(): Promise<WebhookEndpoint[]> {
    return this.fetch('/webhooks');
  }

  /** Get a specific webhook */
  async get(id: string): Promise<WebhookEndpoint> {
    return this.fetch(`/webhooks/${id}`);
  }

  /** Update a webhook */
  async update(id: string, data: Partial<RegisterWebhookRequest>): Promise<WebhookEndpoint> {
    return this.fetch(`/webhooks/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /** Delete a webhook */
  async delete(id: string): Promise<void> {
    return this.fetch(`/webhooks/${id}`, { method: 'DELETE' });
  }

  /** Get delivery logs for a webhook */
  async getDeliveries(id: string): Promise<WebhookDelivery[]> {
    return this.fetch(`/webhooks/${id}/deliveries`);
  }

  /** Retry a previous webhook delivery by creating a new delivery attempt */
  async retryDelivery(id: string, deliveryId: string): Promise<WebhookRetryResponse> {
    return this.fetch(`/webhooks/${id}/deliveries/${deliveryId}/retry`, { method: 'POST' });
  }

  /** Test a webhook by sending a test event */
  async test(id: string): Promise<WebhookTestResponse> {
    return this.fetch(`/webhooks/${id}/test`, { method: 'POST' });
  }
}

class TransactionResource {
  constructor(private fetch: $Fetch) {}

  /** List transactions with optional filters */
  async list(params?: {
    status?: string;
    direction?: 'incoming' | 'outgoing';
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<Transaction>> {
    return this.fetch('/transactions', { params });
  }

  /** Get a specific transaction */
  async get(id: string): Promise<Transaction> {
    return this.fetch(`/transactions/${id}`);
  }
}

class BalanceResource {
  constructor(private fetch: $Fetch) {}

  /** Get all channel balances */
  async getChannels(): Promise<ChannelBalance[]> {
    return this.fetch('/balance/channels');
  }

  /** Get total balance across all channels */
  async getTotal(): Promise<{ local: string; remote: string; total: string }> {
    return this.fetch('/balance/total');
  }
}

class FiberResource {
  constructor(private fetch: $Fetch) {}

  /** Get live/demo Fiber node, channel, and settlement worker status */
  async getStatus(): Promise<FiberStatus> {
    return this.fetch('/fiber/status');
  }

  /** Trigger an immediate open-invoice settlement sweep */
  async runSettlement(): Promise<SettlementRunResult> {
    return this.fetch('/fiber/settlement/run', { method: 'POST' });
  }
}

class StatsResource {
  constructor(private fetch: $Fetch) {}

  /** Get merchant dashboard statistics */
  async get(): Promise<MerchantStats> {
    return this.fetch('/stats');
  }

  /** Get revenue over time (daily buckets) */
  async revenueHistory(days?: number): Promise<{ date: string; volume: string; count: number }[]> {
    return this.fetch('/stats/revenue', { params: { days } });
  }
}
