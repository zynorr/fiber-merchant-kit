/**
 * Fiber Node RPC Client
 *
 * Wraps the FNN (Fiber Network Node) JSON-RPC interface.
 * In production, this connects to the merchant's Fiber node.
 * For demo/testing, it provides simulated responses.
 */

import { randomBytes, createHash } from 'crypto';

export interface FiberNodeConfig {
  rpcUrl: string;
  rpcUser?: string;
  rpcPassword?: string;
}

export interface InvoiceResult {
  invoiceAddress: string;
  paymentHash: string;
  preimage: string;
}

export interface PaymentResult {
  success: boolean;
  paymentHash: string;
  status: string;
  fee?: string;
  error?: string;
}

export interface ChannelInfo {
  localBalance: string;
  remoteBalance: string;
  capacity: string;
  asset: string;
  channelId: string;
  state: string;
  peerPubkey: string;
}

/**
 * FiberNodeClient connects to a Fiber Network Node via JSON-RPC
 * Uses the standard FNN RPC methods documented in the Fiber repo
 */
export class FiberNodeClient {
  private config: FiberNodeConfig;
  private isDemo: boolean;

  constructor(config: FiberNodeConfig) {
    this.config = config;
    this.isDemo = !config.rpcUrl || config.rpcUrl === 'demo';
  }

  /**
   * Create a new invoice on the Fiber node
   * Calls: invoice.new_invoice RPC method
   */
  async createInvoice(params: {
    amount: string;
    currency: string;
    description?: string;
    expiry?: number;
    udtTypeScript?: { codeHash: string; hashType: string; args: string };
    allowMpp?: boolean;
  }): Promise<InvoiceResult> {
    if (this.isDemo) {
      return this._demoCreateInvoice(params);
    }
    return this._rpcCall('invoice.new_invoice', {
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      expiry: params.expiry || 3600,
      udt_type_script: params.udtTypeScript,
      allow_mpp: params.allowMpp ?? true,
    });
  }

  /**
   * Get invoice status from the Fiber node
   * Calls: invoice.get_invoice RPC method
   */
  async getInvoiceStatus(paymentHash: string): Promise<{ status: string; invoiceAddress?: string }> {
    if (this.isDemo) {
      return this._demoGetInvoiceStatus(paymentHash);
    }
    return this._rpcCall('invoice.get_invoice', { payment_hash: paymentHash });
  }

  /**
   * Get channel list from the Fiber node
   * Calls: channel.list_channels RPC method
   */
  async listChannels(): Promise<ChannelInfo[]> {
    if (this.isDemo) {
      return this._demoChannels();
    }
    const result = await this._rpcCall<{ channels: unknown[] }>('channel.list_channels', {});
    return ((result.channels || []) as Record<string, unknown>[]).map((ch) => ({
      localBalance: String(ch.local_balance || '0'),
      remoteBalance: String(ch.remote_balance || '0'),
      capacity: String((Number(ch.local_balance || 0) + Number(ch.remote_balance || 0))),
      asset: String(ch.funding_udt_type_script ? 'RUSD' : 'CKB'),
      channelId: String(ch.channel_id || ''),
      state: String(ch.state || ''),
      peerPubkey: String(ch.peer_pubkey || ''),
    }));
  }

  /**
   * Send a payment (for refunds)
   * Calls: payment.send_payment RPC method
   */
  async sendPayment(params: {
    invoice: string;
    amount?: string;
    maxFee?: string;
    timeout?: number;
  }): Promise<PaymentResult> {
    if (this.isDemo) {
      return this._demoSendPayment(params);
    }
    return this._rpcCall('payment.send_payment', {
      invoice: params.invoice,
      amount: params.amount,
      max_fee_amount: params.maxFee,
      timeout: params.timeout || 60,
    });
  }

  /**
   * List payments from the Fiber node
   * Calls: payment.list_payments RPC method
   */
  async listPayments(params?: { status?: string; limit?: number }): Promise<unknown[]> {
    if (this.isDemo) {
      return [];
    }
    const result = await this._rpcCall<{ payments: unknown[] }>('payment.list_payments', {
      status: params?.status,
      limit: params?.limit || 50,
    });
    return result.payments || [];
  }

  /**
   * Get node info
   * Calls: info.node_info RPC method
   */
  async getNodeInfo(): Promise<Record<string, unknown>> {
    if (this.isDemo) {
      return { node_id: 'demo-node', version: '0.1.0', peers: 0, channels: 2 };
    }
    return this._rpcCall('info.node_info', {});
  }

  // ── Private RPC call helper ─────────────────────────────────

  private async _rpcCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const body = {
      id: Date.now(),
      jsonrpc: '2.0',
      method,
      params: [params],
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.rpcUser && this.config.rpcPassword) {
      const auth = Buffer.from(`${this.config.rpcUser}:${this.config.rpcPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await fetch(this.config.rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Fiber RPC error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(`Fiber RPC error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    return json.result as T;
  }

  // ── Demo mode helpers ───────────────────────────────────────

  private _demoCreateInvoice(params: { amount: string; currency: string; description?: string }): InvoiceResult {
    const preimage = randomBytes(32).toString('hex');
    const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
    const invoiceAddress = `fibt${Buffer.from(paymentHash).toString('base64').slice(0, 40)}`;

    return { invoiceAddress, paymentHash, preimage };
  }

  private _demoGetInvoiceStatus(paymentHash: string): { status: string; invoiceAddress?: string } {
    // Demo: 30% chance the invoice is paid (simulates incoming payment)
    const isPaid = Math.random() < 0.3;
    return {
      status: isPaid ? 'Paid' : 'Open',
      invoiceAddress: `fibt${Buffer.from(paymentHash).slice(0, 20).toString('base64')}`,
    };
  }

  private _demoChannels(): ChannelInfo[] {
    return [
      {
        localBalance: '500000',
        remoteBalance: '500000',
        capacity: '1000000',
        asset: 'CKB',
        channelId: 'demo-ch-1',
        state: 'Ready',
        peerPubkey: '02abc123def456...',
      },
      {
        localBalance: '200000',
        remoteBalance: '800000',
        capacity: '1000000',
        asset: 'RUSD',
        channelId: 'demo-ch-2',
        state: 'Ready',
        peerPubkey: '03xyz789...',
      },
    ];
  }

  private _demoSendPayment(_params: { invoice: string; amount?: string }): PaymentResult {
    return {
      success: true,
      paymentHash: randomBytes(32).toString('hex'),
      status: 'Succeeded',
      fee: '1000',
    };
  }
}
