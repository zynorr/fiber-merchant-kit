import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiberNodeClient } from '../services/fiber-client';

type FetchCall = Parameters<typeof fetch>;

function mockRpcResult(result: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({ jsonrpc: '2.0', id: 1, result }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof mockRpcResult>) {
  const request = fetchMock.mock.calls[0] as FetchCall;
  return JSON.parse(request[1]!.body as string) as Record<string, unknown>;
}

function requestHeaders(fetchMock: ReturnType<typeof mockRpcResult>) {
  const request = fetchMock.mock.calls[0] as FetchCall;
  return request[1]!.headers as Record<string, string>;
}

describe('FiberNodeClient live RPC adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls node_info with bearer auth and empty params', async () => {
    const fetchMock = mockRpcResult({ node_id: 'node-1', version: '0.6.0' });
    const client = new FiberNodeClient({
      rpcUrl: 'http://localhost:8227',
      rpcAuthToken: 'biscuit-token',
    });

    const result = await client.getNodeInfo();

    expect(result.node_id).toBe('node-1');
    expect(requestHeaders(fetchMock).Authorization).toBe('Bearer biscuit-token');
    expect(requestBody(fetchMock)).toMatchObject({
      jsonrpc: '2.0',
      method: 'node_info',
      params: [],
    });
  });

  it('falls back to basic auth when no bearer token is configured', async () => {
    const fetchMock = mockRpcResult({ node_id: 'node-1' });
    const client = new FiberNodeClient({
      rpcUrl: 'http://localhost:8227',
      rpcUser: 'ckb',
      rpcPassword: 'secret',
    });

    await client.getNodeInfo();

    expect(requestHeaders(fetchMock).Authorization).toBe(
      `Basic ${Buffer.from('ckb:secret').toString('base64')}`,
    );
  });

  it('creates invoices with current new_invoice method shape', async () => {
    const fetchMock = mockRpcResult({ invoice_address: 'fibt1invoice...' });
    const client = new FiberNodeClient({
      rpcUrl: 'http://localhost:8227',
      rpcAuthToken: 'biscuit-token',
    });

    const result = await client.createInvoice({
      amount: '5000',
      currency: 'CKB',
      description: 'Order #123',
      expiry: 3600,
    });

    const body = requestBody(fetchMock);
    const params = (body.params as Record<string, unknown>[])[0];

    expect(result.invoiceAddress).toBe('fibt1invoice...');
    expect(result.paymentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.preimage).toMatch(/^[a-f0-9]{64}$/);
    expect(body.method).toBe('new_invoice');
    expect(params.amount).toBe('0x1388');
    expect(params.currency).toBe('Fibt');
    expect(params.expiry).toBe('0xe10');
    expect(params.payment_preimage).toMatch(/^0x[a-f0-9]{64}$/);
    expect(params.hash_algorithm).toBe('sha256');
  });

  it('lists channels with current list_channels method and snake_case mapping', async () => {
    const fetchMock = mockRpcResult({
      channels: [
        {
          channel_id: 'channel-1',
          local_balance: '7000',
          remote_balance: '3000',
          state: { state_name: 'ChannelReady' },
          pubkey: '02abc',
        },
      ],
    });
    const client = new FiberNodeClient({ rpcUrl: 'http://localhost:8227' });

    const channels = await client.listChannels();

    expect(requestBody(fetchMock).method).toBe('list_channels');
    expect(requestBody(fetchMock).params).toEqual([{}]);
    expect(channels).toEqual([
      {
        localBalance: '7000',
        remoteBalance: '3000',
        capacity: '10000',
        asset: 'CKB',
        channelId: 'channel-1',
        state: 'ChannelReady',
        peerPubkey: '02abc',
      },
    ]);
  });

  it('normalizes send_payment response for refunds', async () => {
    const fetchMock = mockRpcResult({
      payment_hash: '0xabc123',
      status: 'Succeeded',
      fee_amount: '42',
    });
    const client = new FiberNodeClient({ rpcUrl: 'http://localhost:8227' });

    const result = await client.sendPayment({ invoice: 'fibt1invoice...', amount: '1000' });

    const params = (requestBody(fetchMock).params as Record<string, unknown>[])[0];
    expect(requestBody(fetchMock).method).toBe('send_payment');
    expect(params.amount).toBe('0x3e8');
    expect(result).toEqual({
      success: true,
      paymentHash: 'abc123',
      status: 'Succeeded',
      fee: '42',
      error: undefined,
    });
  });
});
