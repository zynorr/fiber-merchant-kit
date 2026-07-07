# Fiber Merchant Kit

Complete payment processing infrastructure for the Fiber Network. Provides a REST API, webhook engine, admin dashboard, and multi-language SDKs for accepting Fiber payments.

---

## Table of Contents

- [Problem & Solution](#problem--solution)
- [Technical Architecture](#technical-architecture)
- [What's Working](#whats-working)
- [Getting Started](#getting-started)
- [SDK Examples](#sdk-examples)
- [Production Readiness](#production-readiness)
- [Roadmap](#roadmap)
- [Impact](#impact)

---

## Problem & Solution

### The Gap

The Fiber Network provides fast, low-cost payment channels on CKB -- a powerful Layer 2 solution. However, the ecosystem is missing a critical piece: merchant-friendly payment infrastructure.

Currently, anyone wanting to accept Fiber payments must:

1. **Master FNN RPC** -- understand channel management, preimage generation, invoice lifecycle
2. **Build polling infrastructure** -- manually check invoice statuses
3. **Create a webhook system** -- build delivery, retry, and verification from scratch
4. **Write an admin interface** -- no way to view transactions or balances
5. **Write their own SDK** -- only Rust RPC bindings exist

### Our Solution

Fiber Merchant Kit is a complete, production-ready payment processing toolkit that fills all five gaps. It provides:

| Gap | Solution |
|---|---|
| No merchant API | REST API with invoice CRUD, refunds, and channel management |
| No webhooks | HMAC-SHA256 signed webhooks with automatic retry and delivery logs |
| No admin UI | React dashboard with stats, invoices, webhooks, balance monitoring |
| Only Rust SDK | TypeScript SDK (`@fiber-merchant/sdk`) + Python SDK (`fiber-merchant`) |
| Hard to demo | Demo mode -- works without a Fiber node, ready in 3 minutes |

---

## Technical Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Fiber Merchant Kit                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  TypeScript  │   │    Python    │   │     Admin Dashboard      │ │
│  │     SDK      │   │     SDK      │   │   (React + Tailwind)     │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────────┘ │
│         └──────────────────┼───────────────────────┘                 │
│                            v HTTP API (Bearer Auth)                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Merchant API Server                           │ │
│  │  Express + SQLite (WASM) + Zod + Auth Middleware               │ │
│  │                                                                │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │ Invoice     │  │ Webhook      │  │ Balance & Stats      │  │ │
│  │  │ Management  │  │ Engine (HMAC │  │ (Channel Monitoring) │  │ │
│  │  │ (CRUD)      │  │ + Retry)     │  │                      │  │ │
│  │  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │ │
│  └─────────┼───────────────┼──────────────────────┼──────────────┘ │
│            v               v                      v                 │
│         SQLite Database (merchants, invoices, webhooks, txns)       │
│                                                                     │
│            │                           │                             │
│            v                           v                             │
│  ┌─────────────────────┐   ┌─────────────────────────────────────┐ │
│  │  Fiber Network Node │   │  Demo Storefront                    │ │
│  │  (FNN JSON-RPC)     │   │  (React, localhost:5174)            │ │
│  └─────────────────────┘   └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

**1. Proxy Architecture (Security & Reliability)**

The browser never communicates directly with the Fiber Node RPC. Instead, the Merchant API Server acts as a proxy, which:
- Prevents exposure of RPC credentials to client-side code
- Enables webhook delivery (a browser cannot send server-to-server webhooks)
- Provides persistent storage via SQLite
- Adds API key authentication as a security layer

**2. SQLite via sql.js (Zero-Config Persistence)**

We use sql.js -- a pure WebAssembly build of SQLite -- so the server has zero external database dependencies. No PostgreSQL, no Docker, no configuration. The database is a simple file (`data/merchant.db`) that auto-saves on writes.

**3. Auto-Polling with Webhook Trigger**

When a client calls `GET /invoices/:id`, the server automatically polls the Fiber node for the latest status. If payment is detected, it:
1. Updates the local database (pending to paid)
2. Creates a transaction record
3. Fires webhooks to all registered endpoints matching `invoice.paid`

This means merchants get real-time payment notifications without running background jobs.

**4. Webhook Engine with Exponential Backoff**

Webhooks use at-least-once delivery semantics:
- HMAC-SHA256 signing for payload verification (`X-Fiber-Signature` header)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Up to 5 retry attempts
- Persistent delivery logs with status codes and error messages

**5. Demo Mode**

When `FIBER_NODE_RPC_URL` is not set, the server runs in demo mode -- all Fiber RPC calls are simulated:
- Invoices are generated with fake payment hashes and preimages
- Payment status polls have a ~30% chance of returning "Paid"
- Channel balances show 2 demo channels (CKB + RUSD)
- Refunds always succeed

This means anyone can evaluate the entire system without running a Fiber node.

---

## What's Working

### Fully Functional

| Feature | Status | Details |
|---|---|---|
| Invoice CRUD | Done | Create, get, list (with pagination), cancel, refund |
| FNN RPC Integration | Done | `invoice.new_invoice`, `invoice.get_invoice`, `channel.list_channels`, `payment.send_payment` |
| Webhook Registration | Done | Register by event type, update, delete |
| Webhook Delivery | Done | HMAC-SHA256 signing, exponential backoff retry, delivery logs |
| API Key Auth | Done | Bearer token with `fm_sk_` prefix |
| Zod Validation | Done | Type-safe request validation for all endpoints |
| Admin Dashboard | Done | React + Tailwind: stats, invoices, webhooks, transactions, balance |
| Demo Storefront | Done | Full e-commerce checkout flow with cart, payment, confirmation |
| TypeScript SDK | Done | `@fiber-merchant/sdk` -- all API methods with typed interfaces |
| Python SDK | Done | `fiber-merchant` -- parallel implementation with httpx |
| SQLite Persistence | Done | Auto-save, debounced writes, graceful shutdown |
| Demo Mode | Done | Runs without Fiber node -- simulated responses |
| Revenue Stats | Done | Dashboard stats + revenue history with daily aggregation |
| Health Check | Done | `/api/v1/health` with Fiber node connectivity status |
| Graceful Shutdown | Done | SIGTERM/SIGINT handlers save DB and close connections |

### Code Quality

| Metric | Status |
|---|---|
| TypeScript strict mode | All packages use `strict: true` |
| Unit tests | Utility tests (camelCase) + validation tests (Zod schemas) |
| Error handling | Consistent try/catch with Zod error formatting |
| Security headers | Helmet.js middleware |
| CORS | Configurable origin |
| Request logging | Morgan middleware |

### What's Simulated (Demo Mode)

- FNN RPC calls (generate fake responses instead)
- QR code visualization (returns raw Bech32m data -- real QR requires a library)

### What's Needed for Production

- PostgreSQL adapter for horizontal scaling
- Rate limiting per API key
- Multi-user merchant accounts with RBAC
- TLS termination

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+

### Run (3 Minutes)

```bash
# 1. Clone and enter the project
cd fiber-merchant-kit

# 2. Install dependencies
npm install

# 3. Start everything (server + dashboard + store)
npm run dev
```

Or use the start script:

```bash
# macOS/Linux
./start.sh

# Windows
.\start.ps1
```

### What You'll See

| URL | What It Is |
|---|---|
| http://localhost:3001 | API Server -- shows your API key in the terminal |
| http://localhost:5173 | Admin Dashboard -- enter your API key to explore |
| http://localhost:5174 | Demo Store -- full e-commerce checkout |

### Walkthrough

1. Server starts -- terminal shows `Demo Merchant API Key: fm_sk_...`
2. Open dashboard -- paste API key -- see stats, invoices, webhook management
3. Create an invoice -- it appears in the dashboard with "pending" status
4. Refresh -- ~30% chance it flips to "paid" (demo simulation)
5. Open demo store -- add products -- click "Pay with Fiber"
6. Watch the flow -- cart, invoice creation, payment polling, success or error

### Test Script

```powershell
# Windows
.\test-api.ps1 -ApiKey fm_sk_YOUR_KEY
```

---

## SDK Examples

### TypeScript -- Create & Verify a Payment

```typescript
import { MerchantClient } from '@fiber-merchant/sdk';

const client = new MerchantClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.FIBER_MERCHANT_API_KEY!,
});

// Create an invoice for a subscription
const invoice = await client.invoices.create({
  amount: '50000',    // 50000 shannon = 0.0005 CKB
  currency: 'CKB',
  description: 'Premium API Access -- 1 Month',
  webhookUrl: 'https://myapp.com/webhooks/fiber',
  metadata: { userId: 'user_abc123', plan: 'premium' },
});

console.log(`Invoice created: ${invoice.id}`);
console.log(`Share this address: ${invoice.invoiceAddress}`);

// Poll for payment completion
async function waitForPayment(invoiceId: string) {
  while (true) {
    const inv = await client.invoices.get(invoiceId);
    if (inv.status === 'paid') return true;
    if (inv.status === 'expired' || inv.status === 'cancelled') return false;
    await new Promise(r => setTimeout(r, 2000));
  }
}

const paid = await waitForPayment(invoice.id);
if (paid) console.log('Payment received -- activating subscription!');
```

### Python -- Webhook Verification

```python
from fiber_merchant import MerchantClient
import hmac, hashlib

# Verify a webhook payload
def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

# Create a client and list invoices
client = MerchantClient(
    base_url="http://localhost:3001/api/v1",
    api_key="fm_sk_..."
)
invoices = client.invoices.list(status="paid")
for inv in invoices:
    print(f"Invoice {inv.id}: {inv.amount} CKB")
client.close()
```

---

## Production Readiness

### Deployment Steps

1. Set environment variables:
   ```bash
   export FIBER_NODE_RPC_URL=http://your-fnn-node:8227
   export FIBER_NODE_RPC_USER=ckb
   export FIBER_NODE_RPC_PASSWORD=securepassword
   export CORS_ORIGIN=https://your-dashboard.com
   ```

2. Build for production:
   ```bash
   npm run build
   npm start
   ```

3. Add TLS termination (reverse proxy with Nginx/Caddy)

4. Set up monitoring (health check endpoint at `/api/v1/health`)

### Scalability Considerations

- **SQLite** is sufficient for a merchant processing thousands of payments. For higher volume, swap in a PostgreSQL adapter.
- The **stateless API design** allows horizontal scaling behind a load balancer (with shared database).
- **Webhook delivery** is fire-and-forget with retries -- it will not block request processing.

---

## Roadmap

| Feature | Priority | Description |
|---|---|---|
| PostgreSQL adapter | High | Production-scale deployments |
| Rate limiting | High | Per-API-key request throttling |
| Multi-user RBAC | Medium | Team accounts with role-based access |
| BOLT12 Offers | Medium | Static payment addresses (no invoice generation) |
| Submarine swaps | Medium | Accept on-chain CKB, swap into channels |
| Analytics dashboard | Nice-to-have | Revenue graphs, success rates, customer analytics |
| Multi-asset | Nice-to-have | Full RUSD and RGB++ asset support |
| Hosted version | Nice-to-have | Managed Fiber Merchant Kit as a service |

---

## Impact

### Who This Helps

| Audience | Value |
|---|---|
| E-commerce stores | Accept Fiber payments with 5 lines of code via the SDK |
| SaaS platforms | Implement pay-per-use billing with webhook-based payment notification |
| Wallet developers | Reference implementation of Fiber payment integration patterns |
| Node operators | Admin dashboard for monitoring channel liquidity and payment activity |
| Fiber ecosystem | Critical missing piece of merchant infrastructure -- enables real-world adoption |

### Why It Matters

For Fiber Network to achieve mainstream adoption, merchants need tools that just work. The Fiber Merchant Kit provides:

- **Instant gratification** -- 3 minutes from clone to working demo
- **Familiar patterns** -- Stripe-style API that any developer can use immediately
- **Complete solution** -- API + webhooks + dashboard + SDKs, not just one piece
- **Extensible design** -- Each component is modular and independently usable

---

<div align="center">
  <p>
    <strong>Fiber Merchant Kit</strong> -
    <a href="README.md">README</a> -
    <a href="docs/getting-started.md">Getting Started</a> -
    <a href="docs/api-reference.md">API Reference</a>
  </p>
</div>
