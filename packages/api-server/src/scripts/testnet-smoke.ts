import { FiberNodeClient } from '../services/fiber-client';

function safeRpcUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = url.username ? 'redacted' : '';
    url.password = url.password ? 'redacted' : '';
    return url.toString();
  } catch {
    return '<invalid-url>';
  }
}

function requireFiberRpcUrl(): string {
  const rpcUrl = process.env.FIBER_NODE_RPC_URL;
  if (!rpcUrl || rpcUrl === 'demo') {
    throw new Error(
      'Set FIBER_NODE_RPC_URL to a real Fiber testnet FNN RPC endpoint before running the smoke test.',
    );
  }
  return rpcUrl;
}

async function main() {
  const rpcUrl = requireFiberRpcUrl();
  const client = new FiberNodeClient({
    rpcUrl,
    rpcUser: process.env.FIBER_NODE_RPC_USER,
    rpcPassword: process.env.FIBER_NODE_RPC_PASSWORD,
    rpcAuthToken: process.env.FIBER_NODE_RPC_AUTH_TOKEN,
    rpcCurrency: process.env.FIBER_NODE_CURRENCY || 'Fibt',
  });

  console.log('Fiber testnet smoke');
  console.log(`RPC: ${safeRpcUrl(rpcUrl)}`);

  const nodeInfo = await client.getNodeInfo();
  console.log('node_info: ok');
  console.log(JSON.stringify({
    nodeId: nodeInfo.node_id || nodeInfo.nodeId,
    version: nodeInfo.version,
    peerCount: nodeInfo.peer_count || nodeInfo.peerCount || nodeInfo.peers,
  }, null, 2));

  const channels = await client.listChannels();
  console.log(`list_channels: ok (${channels.length} channel${channels.length === 1 ? '' : 's'})`);

  if (process.env.FIBER_TESTNET_CREATE_INVOICE === 'true') {
    const amount = process.env.FIBER_TESTNET_AMOUNT || '1000';
    const invoice = await client.createInvoice({
      amount,
      currency: 'CKB',
      description: `Fiber Merchant Kit testnet smoke ${new Date().toISOString()}`,
      expiry: Number(process.env.FIBER_TESTNET_EXPIRY || '3600'),
    });
    console.log('new_invoice: ok');
    console.log(JSON.stringify({
      amount,
      invoiceAddress: invoice.invoiceAddress,
      paymentHash: invoice.paymentHash,
    }, null, 2));
  } else {
    console.log('new_invoice: skipped (set FIBER_TESTNET_CREATE_INVOICE=true to create one)');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fiber testnet smoke failed: ${message}`);
  process.exitCode = 1;
});
