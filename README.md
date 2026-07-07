# Fiber Merchant Kit

Payment processing infrastructure for the Fiber Network. A complete toolkit for merchants to accept Fiber payments, with a REST API, webhook engine, admin dashboard, and multi-language SDKs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.9-3776AB?logo=python)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)

---

## Table of Contents

- [What & Why](#what--why)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start (3 Minutes)](#quick-start-3-minutes)
- [Dashboard Preview](#dashboard-preview)
- [API Overview](#api-overview)
- [Webhooks](#webhooks)
- [SDK Usage](#sdk-usage)
- [Demo Mode vs Production](#demo-mode-vs-production)
- [Roadmap](#roadmap)
- [Built For](#built-for)

---

## What & Why

The **Fiber Network** provides fast, low-cost payment channels on Nervos CKB. Merchants who want to accept Fiber payments face a critical gap:

| Problem | How Fiber Merchant Kit Solves It |
|---|---|
| No merchant-friendly API -- raw FNN RPC requires deep payment channel knowledge | **REST API** -- create invoices, check payments, issue refunds with simple HTTP calls |
| No webhook system -- merchants must build their own polling infrastructure | **Webhook Engine** -- HMAC-signed events with automatic retries and delivery logs |
| No admin interface -- no way to see transaction history or balances | **Admin Dashboard** -- full UI for managing invoices, webhooks, channels |
| Only Rust RPC -- JS/Python developers have no native SDK | **TypeScript & Python SDKs** -- drop-in libraries with typed interfaces |

In short, this is the Stripe of Fiber Network payments -- everything a merchant needs to go from zero to accepting Fiber payments in minutes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Fiber Merchant Kit                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  TypeScript  │   │    Python    │   │     Admin Dashboard      │ │
│  │     SDK      │   │     SDK      │   │   (React + Tailwind)     │ │
│  │ @fiber-      │   │ fiber-       │   │   localhost:5173         │ │
│  │ merchant/sdk │   │ merchant     │   │                          │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────────┘ │
│         │                  │                       │                 │
│         └──────────────────┼───────────────────────┘                 │
│                            │ HTTP API (Bearer Auth)                  │
│                            v                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Merchant API Server                           │ │
│  │  Express + SQLite + Zod Validation + Auth Middleware            │ │
│  │  localhost:3001                                                 │ │
│  │                                                                │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │ Invoice     │  │ Webhook      │  │ Balance & Stats      │  │ │
│  │  │ Management  │  │ Engine (HMAC │  │ (Channel Monitoring) │  │ │
│  │  │ (CRUD)      │  │ + Retry)     │  │                      │  │ │
│  │  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │ │
│  └─────────┼───────────────┼──────────────────────┼──────────────┘ │
│            │               │                      │                 │
│            v               v                      v                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    SQLite Database                               │ │
│  │  merchants - invoices - webhooks - webhook_deliveries - txns   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│            │                           │                             │
│            v                           v                             │
│  ┌─────────────────────┐   ┌─────────────────────────────────────┐ │
│  │  Fiber Network Node │   │  Demo Storefront                    │ │
│  │  (FNN JSON-RPC)     │   │  (React, localhost:5174)            │ │
│  │                     │   │                                     │ │
│  │  invoice.new_invoice│   │  End-to-end checkout flow           │ │
│  │  invoice.get_invoice│   │  showing Fiber payment UX           │ │
│  │  channel.list_...   │   │                                     │ │
│  │  payment.send_...   │   │                                     │ │
│  └─────────────────────┘   └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **Proxy Architecture** | Browser never talks to FNN directly -- prevents credential exposure, enables webhooks |
| **SQLite (sql.js WASM)** | Zero-config, no external DB needed, file-based backups |
| **Auto-polling** | GET /invoices/:id polls FNN for status, auto-updates DB and fires webhooks |
| **Exponential Backoff Retry** | Webhooks: 1s to 2s to 4s to 8s to 16s, up to 5 attempts, at-least-once delivery |
| **Demo Mode** | Works without a real Fiber node -- simulated responses for instant testing |

---

## Project Structure

```
fiber-merchant-kit/
|
+-- packages/
|   +-- sdk-typescript/       # TypeScript SDK (@fiber-merchant/sdk)
|   |   +-- src/              # MerchantClient -- invoices, webhooks, balance, stats
|   |
|   +-- sdk-python/           # Python SDK (fiber-merchant)
|   |   +-- src/fiber_merchant/  # Python MerchantClient (httpx-based)
|   |
|   +-- api-server/           # REST API Server (Express + SQLite + Webhooks)
|   |   +-- src/
|   |   |   +-- routes/       # invoices, webhooks, merchant (balance/stats)
|   |   |   +-- db/           # SQLite schema, queries, database wrapper
|   |   |   +-- services/     # Fiber node RPC client, webhook delivery engine
|   |   |   +-- middleware/   # API key authentication
|   |   |   +-- lib/          # Utilities (camelCase converter, fiber client factory)
|   |   |   +-- __tests__/    # Unit tests (vitest)
|   |   +-- .env.example
|   |
|   +-- admin-dashboard/      # Merchant Admin Dashboard (React + Tailwind)
|   |   +-- src/
|   |   |   +-- pages/        # Dashboard, Invoices, Webhooks, Transactions, Balance
|   |   |   +-- components/   # Layout, UI primitives (Button, Card, DataTable, etc.)
|   |   |   +-- App.tsx       # Root with routing and auth state
|   |   +-- .env.example
|   |
|   +-- demo-store/           # Demo E-commerce Storefront (React + Tailwind)
|       +-- src/
|       |   +-- App.tsx       # Full checkout flow: cart to payment to confirmation
|       +-- .env.example
|
+-- docs/
|   +-- api-reference.md      # Full API reference with request/response examples
|   +-- architecture.md       # Detailed architecture and data flow
|   +-- getting-started.md    # Step-by-step setup guide
|
+-- start.sh                  # One-command startup (macOS/Linux)
+-- start.ps1                 # One-command startup (Windows)
+-- test-api.ps1              # Automated API test script
+-- API.md                    # Quick API reference
+-- package.json              # npm workspaces root
```

---

## Quick Start (3 Minutes)

### Prerequisites

- Node.js 18+ and npm 9+
- No Fiber node needed -- demo mode works out of the box

### Step 1: Install & Start Everything

```bash
# macOS / Linux
chmod +x start.sh
./start.sh

# Windows PowerShell
.\start.ps1
```

This installs dependencies and starts all three services:

| Service | URL | Purpose |
|---|---|---|
| API Server | http://localhost:3001 | Backend REST API |
| Admin Dashboard | http://localhost:5173 | Merchant management UI |
| Demo Store | http://localhost:5174 | E-commerce checkout demo |

### Step 2: Get Your API Key

Look in the server terminal output for:

```
Demo Merchant API Key: fm_sk_a1b2c3d4e5f6...
```

Save this key -- you need it to access the dashboard.

### Step 3: Open the Dashboard

1. Open http://localhost:5173
2. Paste your API key and click "Connect"
3. Explore invoices, webhooks, transactions, and channel balances

### Step 4: Try the Demo Store

1. Open http://localhost:5174
2. Add products to cart
3. Click "Pay with Fiber" -- watch the payment flow with simulated 30% success rate

> Tip: Try the demo store without an API key first to see the interface. Then add your API key to `packages/demo-store/.env` for full functionality.

---

## Dashboard Preview

### Home Page
Shows key metrics: total invoices, paid invoices, revenue volume, active channels, and a 14-day revenue bar chart.

### Invoices
Full list with status badges, filtering, and drill-down to individual invoice details with QR code data.

### Webhooks
Register webhook endpoints by event type, view delivery logs with status codes and retry attempts, test webhooks.

### Transactions
Incoming/outgoing payment history with status tracking.

### Balance
Channel-level balance visualization showing local/remote balances across payment channels.

---

## API Overview

All endpoints are prefixed with `/api/v1` and require `Authorization: Bearer fm_sk_...` header.

### Invoices

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/invoices` | Create a payment invoice |
| `GET` | `/invoices` | List invoices (with status filter and pagination) |
| `GET` | `/invoices/:id` | Get invoice + auto-poll Fiber node for status |
| `POST` | `/invoices/:id/cancel` | Cancel a pending invoice |
| `POST` | `/invoices/:id/refund` | Refund a paid invoice |
| `GET` | `/invoices/:id/qr` | Get QR code data |

### Webhooks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/webhooks` | Register a webhook endpoint |
| `GET` | `/webhooks` | List all webhooks |
| `GET/PATCH/DELETE` | `/webhooks/:id` | Manage a webhook |
| `GET` | `/webhooks/:id/deliveries` | View delivery logs |
| `POST` | `/webhooks/:id/test` | Send test event |

### Balance & Stats

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/balance/channels` | Channel-level balances |
| `GET` | `/balance/total` | Aggregate balance |
| `GET` | `/stats` | Dashboard statistics |
| `GET` | `/stats/revenue?days=30` | Revenue history |
| `GET` | `/health` | Health check |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/transactions` | List transactions |
| `GET` | `/transactions/:id` | Get transaction details |

Full API reference: [docs/api-reference.md](docs/api-reference.md)

---

## Webhooks

The webhook system provides real-time payment notifications with enterprise-grade reliability.

### Supported Events

| Event | Fired When |
|---|---|
| `invoice.created` | A new invoice is created |
| `invoice.received` | Payment is detected (unconfirmed) |
| `invoice.paid` | Payment is confirmed and settled |
| `invoice.expired` | Invoice expires without payment |
| `invoice.cancelled` | Invoice is manually cancelled |
| `invoice.refunded` | A paid invoice is refunded |

### Reliability

- **At-least-once delivery** -- webhooks will retry on failure
- **Exponential backoff** -- 1s, 2s, 4s, 8s, 16s (up to 5 attempts)
- **HMAC-SHA256 signing** -- verify payloads with `X-Fiber-Signature` header
- **Delivery logs** -- persistent records with status codes and error messages

### Verification (Python)

```python
import hmac, hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## SDK Usage

### TypeScript

```typescript
import { MerchantClient } from '@fiber-merchant/sdk';

const client = new MerchantClient({
  baseUrl: 'http://localhost:3001',
  apiKey: 'fm_sk_YOUR_API_KEY',
});

// Create an invoice
const invoice = await client.invoices.create({
  amount: '5000',
  currency: 'CKB',
  description: 'Order #1234',
  metadata: { customerId: 'cus_123' },
});

// Check payment status
const status = await client.invoices.get(invoice.id);
if (status.status === 'paid') {
  console.log('Payment received!');
}

// Issue a refund
await client.invoices.refund(invoice.id, 'Customer requested refund');
```

### Python

```python
from fiber_merchant import MerchantClient

client = MerchantClient(
    base_url="http://localhost:3001/api/v1",
    api_key="fm_sk_YOUR_API_KEY"
)

# Create invoice
invoice = client.invoices.create(
    amount="5000",
    currency="CKB",
    description="Order #1234"
)

# Poll for payment
while client.invoices.get(invoice.id).status != "paid":
    import time
    time.sleep(2)

print("Payment received!")
client.close()
```

---

## Demo Mode vs Production

| Feature | Demo Mode | Production |
|---|---|---|
| Fiber Node | Simulated (random 30% payment success) | Real FNN RPC connection |
| Invoices | Generated locally with fake payment hashes | Created via `invoice.new_invoice` RPC |
| Payments | Random 30% chance of "Paid" on each poll | Real payment detection via `invoice.get_invoice` |
| Channels | 2 demo channels (CKB + RUSD) | Real channel list from `channel.list_channels` |
| Database | SQLite (`data/merchant.db`) | SQLite (or PostgreSQL with adapter) |
| Setup | Zero config -- just run the server | Set `FIBER_NODE_RPC_URL` env var |

### Enable Production Mode

```bash
export FIBER_NODE_RPC_URL=http://your-fnn-node:8227
export FIBER_NODE_RPC_USER=ckb
export FIBER_NODE_RPC_PASSWORD=your_password
npm run dev --workspace=packages/api-server
```

---

## Roadmap

- [x] Invoice CRUD -- create, get, list, cancel, refund
- [x] Webhook Engine -- HMAC-signed, retry logic, delivery logs
- [x] Admin Dashboard -- full merchant management UI
- [x] Demo Storefront -- end-to-end checkout flow
- [x] TypeScript SDK -- all API methods, typed interfaces
- [x] Python SDK -- parallel implementation
- [ ] PostgreSQL adapter -- production-scale deployments
- [ ] Rate limiting -- per-API-key throttling
- [ ] Multi-user RBAC -- team accounts with permissions
- [ ] BOLT12 Offers -- static payment addresses
- [ ] Submarine Swaps -- on-chain to off-chain
- [ ] Analytics Dashboard -- revenue graphs, success rates

---

## Built For

| Audience | How They Benefit |
|---|---|
| E-commerce stores | Accept Fiber payments with 5 lines of code |
| SaaS platforms | Pay-per-use billing via webhooks |
| Wallet developers | Reference API pattern for Fiber integration |
| Node operators | Dashboard to monitor channels and liquidity |

---

## License

MIT

---

<div align="center">
  <p>
    <a href="docs/getting-started.md">Getting Started Guide</a> -
    <a href="docs/api-reference.md">API Reference</a> -
    <a href="docs/architecture.md">Architecture</a>
  </p>
</div>
