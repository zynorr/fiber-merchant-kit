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

Save your API key.

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
import crypto from 'crypto';

const app = express();

app.post('/webhooks/fiber', express.json(), (req, res) => {
  const signature = req.headers['x-fiber-signature'] as string;
  const event = req.headers['x-fiber-event'] as string;
  const body = JSON.stringify(req.body);

  // Verify signature using your webhook secret
  const expected = crypto
    .createHmac('sha256', 'whsec_YOUR_SECRET')
    .update(body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).send('Invalid signature');
  }

  // Handle the event
  if (event === 'invoice.paid') {
    console.log(`Payment received: ${req.body.data.id}`);
    // Fulfill the order
  }

  res.status(200).send('OK');
});
```

## Production Setup

For production, set these environment variables:

```bash
FIBER_NODE_RPC_URL=http://localhost:8227  # Your FNN RPC endpoint
FIBER_NODE_RPC_USER=ckb                    # RPC auth user
FIBER_NODE_RPC_PASSWORD=securepassword     # RPC auth password
CORS_ORIGIN=https://mymerchant.com         # Restrict CORS
PORT=3001                                  # Server port
```

### Running with a Real Fiber Node

1. Set up an FNN node following the [Fiber docs](https://github.com/nervosnetwork/fiber)
2. Configure `FIBER_NODE_RPC_URL` to point to your node
3. Restart the server

## Troubleshooting

**"Invalid API key"** -- Make sure the API key starts with `fm_sk_` and matches what was printed in the server logs on startup.

**"Cannot connect"** -- Verify the server is running on port 3001. Check for port conflicts.

**Payments not receiving** -- In demo mode, payments are simulated with ~30% probability on each status poll. In production, ensure your FNN node is connected to the Fiber testnet/mainnet and has open channels.
