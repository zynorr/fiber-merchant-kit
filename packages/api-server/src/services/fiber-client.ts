/**
 * Fiber Node RPC Client
 *
 * Wraps the FNN (Fiber Network Node) JSON-RPC interface.
 * In production/testnet, this connects to the merchant's Fiber node.
 * For demo/testing, it provides simulated responses.
 */

import { randomBytes, createHash } from 'crypto';

type JsonRecord = Record<string, unknown>;

export interface FiberNodeConfig {
  rpcUrl: string;
  rpcUser?: string;
  rpcPassword?: string;
  rpcAuthToken?: string;
  rpcCurrency?: string;
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

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string } | string | null;
}

const FIBER_CURRENCIES = new Set(['Fibt', 'Fibb', 'Fibd']);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function pickString(source: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  }
  return undefined;
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
}

function ensureHexPrefix(value: string): string {
  return value.startsWith('0x') || value.startsWith('0X') ? value : `0x${value}`;
}

function hashPreimage(preimageHex: string): string {
  return createHash('sha256').update(Buffer.from(stripHexPrefix(preimageHex), 'hex')).digest('hex');
}

function toRpcU128(value: string | number): string {
  const raw = String(value).trim();
  if (/^0x[0-9a-f]+$/i.test(raw)) return raw.toLowerCase();
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Fiber RPC amount must be a decimal integer or hex quantity, received "${raw}"`);
  }
  return `0x${BigInt(raw).toString(16)}`;
}

function normalizeFiberCurrency(requested: string, configured?: string): string {
  if (configured && FIBER_CURRENCIES.has(configured)) return configured;
  if (FIBER_CURRENCIES.has(requested)) return requested;
  return 'Fibt';
}

function stateToString(value: unknown): string {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return pickString(record, 'state_name', 'stateName', 'type', 'name') || JSON.stringify(value || '');
}

function sumDecimalStrings(a: string, b: string): string {
  try {
    return (BigInt(a || '0') + BigInt(b || '0')).toString();
  } catch {
    return String(Number(a || 0) + Number(b || 0));
  }
}

function normalizeInvoiceStatus(status?: string): string {
  if (!status) return 'Open';
  const lowered = status.toLowerCase();
  if (lowered === 'paid' || lowered === 'succeeded' || lowered === 'success') return 'Paid';
  if (lowered === 'received') return 'Received';
  if (lowered === 'expired') return 'Expired';
  if (lowered === 'cancelled' || lowered === 'canceled') return 'Cancelled';
  return status;
}

/**
 * FiberNodeClient connects to a Fiber Network Node via JSON-RPC.
 */
export class FiberNodeClient {
  private config: FiberNodeConfig;
  private isDemo: boolean;

  constructor(config: FiberNodeConfig) {
    this.config = config;
    this.isDemo = !config.rpcUrl || config.rpcUrl === 'demo';
  }

  /**
   * Create a new invoice on the Fiber node.
   * Calls the current FNN `new_invoice` RPC method.
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

    const preimage = randomBytes(32).toString('hex');
    const paymentHash = hashPreimage(preimage);
    const rawResult = await this._rpcCall<unknown>('new_invoice', {
      amount: toRpcU128(params.amount),
      currency: normalizeFiberCurrency(params.currency, this.config.rpcCurrency),
      description: params.description,
      expiry: toRpcU128(params.expiry || 3600),
      payment_preimage: ensureHexPrefix(preimage),
      hash_algorithm: 'sha256',
      udt_type_script: params.udtTypeScript,
      allow_mpp: params.allowMpp ?? true,
    });

    const result = asRecord(rawResult);
    const nestedInvoiceValue = result.invoice;
    const invoice = asRecord(nestedInvoiceValue);
    const invoiceAddress = (typeof rawResult === 'string' ? rawResult : undefined)
      || (typeof nestedInvoiceValue === 'string' ? nestedInvoiceValue : undefined)
      || pickString(
      result,
      'invoice_address',
      'invoiceAddress',
      'address',
      'invoice',
    ) || pickString(invoice, 'invoice_address', 'invoiceAddress', 'address');

    if (!invoiceAddress) {
      throw new Error('Fiber RPC new_invoice response did not include an invoice address');
    }

    return {
      invoiceAddress,
      paymentHash: stripHexPrefix(pickString(result, 'payment_hash', 'paymentHash') || paymentHash),
      preimage,
    };
  }

  /**
   * Get invoice status from the Fiber node.
   * Calls the current FNN `get_invoice` RPC method.
   */
  async getInvoiceStatus(paymentHash: string): Promise<{ status: string; invoiceAddress?: string }> {
    if (this.isDemo) {
      return this._demoGetInvoiceStatus(paymentHash);
    }

    const result = await this._rpcCall<JsonRecord>('get_invoice', {
      payment_hash: ensureHexPrefix(paymentHash),
    });
    const invoice = asRecord(result.invoice);
    return {
      status: normalizeInvoiceStatus(
        pickString(result, 'status', 'state') || pickString(invoice, 'status', 'state'),
      ),
      invoiceAddress: pickString(
        result,
        'invoice_address',
        'invoiceAddress',
        'address',
      ) || pickString(invoice, 'invoice_address', 'invoiceAddress', 'address'),
    };
  }

  /**
   * Get channel list from the Fiber node.
   * Calls the current FNN `list_channels` RPC method.
   */
  async listChannels(): Promise<ChannelInfo[]> {
    if (this.isDemo) {
      return this._demoChannels();
    }

    const result = await this._rpcCall<JsonRecord | unknown[]>('list_channels', {});
    const rawChannels = Array.isArray(result)
      ? result
      : (asRecord(result).channels || []);

    return (rawChannels as unknown[]).map((raw) => {
      const ch = asRecord(raw);
      const localBalance = pickString(ch, 'local_balance', 'localBalance') || '0';
      const remoteBalance = pickString(ch, 'remote_balance', 'remoteBalance') || '0';
      const asset = ch.funding_udt_type_script || ch.fundingUdtTypeScript ? 'RUSD' : 'CKB';
      return {
        localBalance,
        remoteBalance,
        capacity: pickString(ch, 'capacity') || sumDecimalStrings(localBalance, remoteBalance),
        asset,
        channelId: pickString(ch, 'channel_id', 'channelId', 'id') || '',
        state: stateToString(ch.state),
        peerPubkey: pickString(ch, 'peer_pubkey', 'peerPubkey', 'pubkey') || '',
      };
    });
  }

  /**
   * Send a payment (used by refunds).
   * Calls the current FNN `send_payment` RPC method.
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

    const result = await this._rpcCall<JsonRecord>('send_payment', {
      invoice: params.invoice,
      amount: params.amount ? toRpcU128(params.amount) : undefined,
      max_fee_amount: params.maxFee ? toRpcU128(params.maxFee) : undefined,
      timeout: toRpcU128(params.timeout || 60),
    });

    const status = pickString(result, 'status', 'state') || 'Pending';
    return {
      success: !['failed', 'failure', 'error'].includes(status.toLowerCase()),
      paymentHash: stripHexPrefix(pickString(result, 'payment_hash', 'paymentHash') || ''),
      status,
      fee: pickString(result, 'fee', 'fee_amount', 'feeAmount'),
      error: pickString(result, 'error', 'message'),
    };
  }

  /**
   * List payments from the Fiber node.
   * Calls the current FNN `list_payments` RPC method.
   */
  async listPayments(params?: { status?: string; limit?: number }): Promise<unknown[]> {
    if (this.isDemo) {
      return [];
    }
    const result = await this._rpcCall<JsonRecord | unknown[]>('list_payments', {
      status: params?.status,
      limit: params?.limit,
    });
    return Array.isArray(result) ? result : ((asRecord(result).payments || []) as unknown[]);
  }

  /**
   * Get node info.
   * Calls the current FNN `node_info` RPC method.
   */
  async getNodeInfo(): Promise<Record<string, unknown>> {
    if (this.isDemo) {
      return { node_id: 'demo-node', version: '0.1.0', peers: 0, channels: 2 };
    }
    return this._rpcCall('node_info');
  }

  private async _rpcCall<T>(method: string, params?: JsonRecord): Promise<T> {
    const body = {
      id: Date.now(),
      jsonrpc: '2.0',
      method,
      params: params === undefined ? [] : [params],
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.rpcAuthToken) {
      headers.Authorization = `Bearer ${this.config.rpcAuthToken}`;
    } else if (this.config.rpcUser && this.config.rpcPassword) {
      const auth = Buffer.from(`${this.config.rpcUser}:${this.config.rpcPassword}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(this.config.rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Fiber RPC error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as RpcResponse<T>;
    if (json.error) {
      const message = typeof json.error === 'string'
        ? json.error
        : json.error.message || JSON.stringify(json.error);
      throw new Error(`Fiber RPC error: ${message}`);
    }

    return json.result as T;
  }

  private _demoCreateInvoice(params: { amount: string; currency: string; description?: string }): InvoiceResult {
    const preimage = randomBytes(32).toString('hex');
    const paymentHash = hashPreimage(preimage);
    const invoiceAddress = `fibt${Buffer.from(paymentHash).toString('base64').slice(0, 40)}`;

    return { invoiceAddress, paymentHash, preimage };
  }

  private _demoGetInvoiceStatus(paymentHash: string): { status: string; invoiceAddress?: string } {
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
