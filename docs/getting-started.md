# Getting Started with Fiber Merchant Kit

Use this guide when you want to run the project, test the demo checkout, and understand when to use demo mode versus a real Fiber Network Node.

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.9+ only if you want to try the Python SDK
- A real Fiber Network Node only for the optional live testnet path

## Fastest Local Path

From the repository root:

```bash
npm install
npm run dev
```

The root dev script starts the API server, admin dashboard, and demo store together. If you prefer the platform helpers:

```bash
# macOS / Linux
./start.sh

# Windows PowerShell
.\start.ps1
```

You can also start services one at a time while debugging:

```bash
npm run dev --workspace=packages/api-server
npm run dev --workspace=packages/admin-dashboard
npm run dev --workspace=packages/demo-store
```

Environment templates are checked in at `.env.example` and under each package. The platform scripts copy package examples to `.env` files and load `packages/api-server/.env`; direct npm users can export the same values in their shell.

## Where To Open

| Service | URL | What To Check |
|---|---|---|
| API Server | http://localhost:3001 | Public server index, API discovery, health, and printed demo key |
| Admin Dashboard | http://localhost:5173 | Merchant invoices, transactions, balances, webhooks, network status, and stats |
| Demo Store | http://localhost:5174 | Shopper checkout flow that does not ask for a merchant API key |

The API server logs print something like:

```text
Demo Merchant API Key: fm_sk_a1b2c3d4e5f6...
```

Copy that key for the dashboard and SDK examples.

## Dashboard Key vs Store Checkout

| Surface | Needs `fm_sk_...`? | Reason |
|---|---:|---|
| Admin Dashboard | Yes | It is the merchant back office and uses authenticated API routes |
| SDKs | Yes | They represent a merchant backend integration |
| Demo Store / FiberStore checkout | No | Checkout uses a public server-side route that creates invoices without exposing the merchant key to shoppers |

If the dashboard shows `401 Unauthorized` or "Invalid API key", copy the newest `fm_sk_...` value from the API server logs. In demo mode, restarting the API can mint a new key.

## Test The Local Demo End To End

1. Open http://localhost:3001 and confirm the API index, discovery link, and health link load.
2. Open http://localhost:5173 and paste the latest `fm_sk_...` key.
3. Create an invoice from the dashboard.
4. Open the invoice detail page and poll/refresh status.
5. Open the Network page and inspect Fiber endpoint status, channel status, and settlement worker status.
6. Register a webhook endpoint, send a test event, inspect delivery logs, and retry a failed delivery if one is present.
7. Open http://localhost:5174, add products, and check out without entering a merchant key.
8. In demo mode, use the payment simulation action to complete checkout.
9. Return to the dashboard and confirm the invoice, transaction, stats, and balance views updated.

Demo mode is deterministic and does not require a real Fiber node. It is meant to prove the merchant workflow quickly.

## Verification Commands

| Command | What It Verifies |
|---|---|
| `npm run demo:smoke` | Local API, invoice lifecycle, signed webhooks, simulated payment, stats, and settlement sweep |
| `npm run test --workspaces --if-present` | Unit and route tests across workspaces |
| `npm run lint --workspaces --if-present` | TypeScript/lint checks configured by the workspaces |
| `npm run build --workspaces` | Production builds for API, SDK, dashboard, and demo store |
| `npm run testnet:smoke` | Real FNN RPC smoke path when live testnet env vars are configured |

## Integrate From Code

### TypeScript

```typescript
import { MerchantClient } from '@fiber-merchant/sdk';

const client = new MerchantClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.FIBER_MERCHANT_API_KEY!,
});

const invoice = await client.invoices.create({
  amount: '50000',
  currency: 'CKB',
  description: 'API access token - 1 month',
});

console.log(`Pay here: ${invoice.invoiceAddress}`);
```

### Python

```python
from fiber_merchant import MerchantClient

client = MerchantClient(
    base_url="http://localhost:3001",
    api_key="fm_sk_..."
)

invoice = client.invoices.create(
    amount="50000",
    currency="CKB",
    description="API access token - 1 month",
)

print(f"Pay at: {invoice.invoice_address}")
```

## Handle Webhooks

Create an endpoint in your app to receive signed webhook notifications:

```typescript
import express from 'express';
import { verifyWebhookSignature } from '@fiber-merchant/sdk';

const app = express();

app.post('/webhooks/fiber', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-fiber-signature'] as string;
  const event = req.headers['x-fiber-event'] as string;
  const body = req.body.toString('utf8');

  if (!(await verifyWebhookSignature(body, signature, 'whsec_YOUR_SECRET'))) {
    return res.status(401).send('Invalid signature');
  }

  const payload = JSON.parse(body);

  if (event === 'invoice.paid') {
    console.log(`Payment received: ${payload.data.id}`);
  }

  res.status(200).send('OK');
});
```

## Real FNN Testnet Path

Demo mode is enough to evaluate the product workflow. Use the live path when you want to prove the API can talk to a real Fiber node.

```bash
FIBER_NODE_RPC_URL=http://localhost:8227
FIBER_NODE_CURRENCY=Fibt
npm run testnet:smoke
```

Optional auth variables:

```bash
FIBER_NODE_RPC_AUTH_TOKEN=token
# or
FIBER_NODE_RPC_USER=user
FIBER_NODE_RPC_PASSWORD=password
```

The default smoke checks `node_info` and `list_channels`. Set `FIBER_TESTNET_CREATE_INVOICE=true` only when you want the script to create a real testnet invoice through `new_invoice`.

Important distinction:

| Action | Result |
|---|---|
| Create a live FNN invoice | Proves the Merchant API can create a real Fiber testnet payment request |
| Pay from a separate funded node/channel | Required for the invoice to settle and become `paid` |
| Use an unfunded disposable node | Invoice can remain `pending`, which is expected |

See [testnet-smoke.md](testnet-smoke.md) for the full live testnet runbook and recorded funded settlement evidence.

## Production Setup

For production or hosted testnet deployment, start with:

```bash
FIBER_NODE_RPC_URL=http://localhost:8227
FIBER_NODE_RPC_AUTH_TOKEN=token
FIBER_NODE_CURRENCY=Fibt
CORS_ORIGIN=https://mymerchant.com
PORT=3001
```

Use [deployment.md](deployment.md) for Docker, production env, Fiber RPC failover, and PostgreSQL notes.

## Troubleshooting

**Invalid API key** - Make sure the key starts with `fm_sk_` and matches the latest value printed by the API server. Restarting the API in demo mode can create a new key.

**Dashboard failed to load stats** - The dashboard is authenticated. Paste the current demo API key, save it, then retry.

**Demo store asks for no key** - This is expected. The shopper checkout route is public and server-side; it does not expose the merchant API key.

**Cannot connect** - Verify the API server is running on port `3001` and that dashboard/store dev servers are on `5173` and `5174`.

**Payments stay pending** - In demo mode, use the payment simulation action. In live FNN mode, pay from a separate funded payer node/channel and keep the settlement worker running.
