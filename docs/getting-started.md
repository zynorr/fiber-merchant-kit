# Getting Started with Fiber Merchant Kit

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.9+ (for Python SDK)
- A Fiber Network Node (for production) -- or use demo mode

## Step 1: Start the API Server

```bash
# Clone and install
cd fiber-merchant-kit
npm install

# Start the server in demo mode
npm run dev --workspace=packages/api-server
```

For configuration, use the checked-in `.env.example` files as templates. The platform scripts copy package examples to `.env` files and load `packages/api-server/.env`; when running npm scripts directly, export API server variables in your shell.

You should see:

```
Demo Merchant API Key: fm_sk_a1b2c3d4e5f6...

+----------------------------------------------+
|       Fiber Merchant Kit -- API Server        |
|  Server:   http://localhost:3001              |
|  API:      http://localhost:3001/api/v1       |
|  Mode:     Demo                               |
+----------------------------------------------+
```

Open http://localhost:3001 to see the public server index with API discovery and health links. Save your API key.

## Step 2: Start the Admin Dashboard

Open a new terminal:

```bash
npm run dev --workspace=packages/admin-dashboard
```

Open http://localhost:5173 and enter your API key.

## Step 3: Start the Demo Store

```bash
npm run dev --workspace=packages/demo-store
```

Open http://localhost:5174 to see a working e-commerce store.

## Step 4: Integrate with Code

### TypeScript

```typescript
import { MerchantClient } from '@fiber-merchant/sdk';

const client = new MerchantClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.FIBER_MERCHANT_API_KEY!,
});

// Create invoice
const invoice = await client.invoices.create({
  amount: '50000',
  currency: 'CKB',
  description: 'API access token - 1 month',
});

// Render QR or deep link
console.log(`Pay here: ${invoice.invoiceAddress}`);
```

### Python

```python
from fiber_merchant import MerchantClient

client = MerchantClient(
    base_url="http://localhost:3001",
    api_key="fm_sk_..."
)

# Create invoice
invoice = client.invoices.create(
    amount="50000",
    currency="CKB",
    description="API access token - 1 month",
)
print(f"Pay at: {invoice.invoice_address}")

# Wait for payment
import time
while True:
    inv = client.invoices.get(invoice.id)
    if inv.status == "paid":
        print("Payment received! Activating subscription...")
        break
    elif inv.status in ("expired", "cancelled"):
        print("Payment failed")
        break
    time.sleep(2)
```

## Step 5: Handle Webhooks

Create an endpoint in your app to receive webhook notifications:

```typescript
// Express webhook handler
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

  // Handle the event
  if (event === 'invoice.paid') {
    console.log(`Payment received: ${payload.data.id}`);
    // Fulfill the order
  }

  res.status(200).send('OK');
});
```

## Local Demo Smoke Test

Run this when you want a deterministic end-to-end check without a real Fiber node:

```bash
npm run demo:smoke
```

The smoke test starts the API against a temporary SQLite database, registers a local webhook receiver, creates an invoice, simulates payment, verifies webhook signatures, checks transaction/stats updates, and runs the manual settlement endpoint.

## Production Setup

For production, set these environment variables:

```bash
FIBER_NODE_RPC_URL=http://localhost:8227  # Your FNN RPC endpoint
FIBER_NODE_RPC_AUTH_TOKEN=token            # Preferred Biscuit bearer token for protected RPC
FIBER_NODE_CURRENCY=Fibt                   # Fibt=testnet, Fibb=mainnet, Fibd=dev
CORS_ORIGIN=https://mymerchant.com         # Restrict CORS
PORT=3001                                  # Server port
```

### Running with a Real Fiber Node

1. Set up an FNN node following the [Fiber docs](https://www.fiber.world/docs/quick-start/run-a-node)
2. Configure `FIBER_NODE_RPC_URL` to point to your node
3. Run `npm run testnet:smoke` to verify `node_info` and `list_channels`
4. Restart the server

## Troubleshooting

**"Invalid API key"** -- Make sure the API key starts with `fm_sk_` and matches what was printed in the server logs on startup.

**"Cannot connect"** -- Verify the server is running on port 3001. Check for port conflicts.

**Payments not receiving** -- In demo mode, payments are simulated with ~30% probability on each status poll. In production, ensure your FNN node is connected to the Fiber testnet/mainnet and has open channels.
