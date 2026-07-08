# Fiber Merchant Kit — API Server

The backend server that connects to a Fiber Network Node and exposes a REST API for merchants to manage invoices, webhooks, transactions, and channel balances.

## Quick Start

```bash
# Install dependencies
npm install

# Start in demo mode (no Fiber node needed)
npm run dev
```

The server will start on `http://localhost:3001` and display your demo API key in the logs.

## Environment Variables

Copy `.env.example` to `.env` when using the platform start scripts. If you run this package directly with npm, export these variables in your shell or deployment environment before starting the server.

| Variable | Default | Description |
|---|---|---|
| PORT | 3001 | HTTP port |
| FIBER_NODE_RPC_URL | demo | Fiber node RPC endpoint. Set to your actual FNN RPC URL for production. Use "demo" for testing. |
| FIBER_NODE_RPC_AUTH_TOKEN | - | Preferred bearer token for protected Fiber RPC endpoints |
| FIBER_NODE_CURRENCY | Fibt | Fiber invoice network currency: Fibt=testnet, Fibb=mainnet, Fibd=dev |
| FIBER_NODE_RPC_USER | - | Optional basic auth username for private/local RPC |
| FIBER_NODE_RPC_PASSWORD | - | Optional basic auth password for private/local RPC |
| FIBER_SETTLEMENT_WORKER | live mode default | Set `true` or `false` to force the background invoice settlement worker on or off |
| FIBER_SETTLEMENT_WORKER_INTERVAL_MS | 30000 | Worker polling interval in milliseconds |
| FIBER_SETTLEMENT_WORKER_BATCH_SIZE | 25 | Maximum open invoices checked per worker tick |
| WEBHOOK_DELIVERY_WORKER | true | Set `false` to disable the durable webhook delivery queue worker |
| WEBHOOK_DELIVERY_WORKER_INTERVAL_MS | 5000 | Webhook queue polling interval in milliseconds |
| WEBHOOK_DELIVERY_WORKER_BATCH_SIZE | 25 | Maximum due webhook deliveries processed per worker tick |
| CORS_ORIGIN | * | Allowed CORS origin |
| FIBER_DB_ENGINE | sqlite | Database engine selector. `sqlite` is the verified local/runtime default; `postgres` requires `DATABASE_URL` and the production schema path. |
| FIBER_MERCHANT_DB_PATH | ./data/merchant.db | SQLite database path |
| DATABASE_URL | - | PostgreSQL connection URL when deploying a Postgres-backed adapter |
| FIBER_NODE_RPC_URLS | - | Optional comma-separated Fiber RPC failover URLs. Takes precedence over `FIBER_NODE_RPC_URL`. |

## Fiber Testnet Smoke

With a real testnet FNN RPC endpoint configured:

```bash
npm run testnet:smoke
```

This checks `node_info` and `list_channels` without side effects. Set `FIBER_TESTNET_CREATE_INVOICE=true` to also create a testnet invoice through `new_invoice`. Full instructions are in `../../docs/testnet-smoke.md`.

## API Endpoints

All authenticated endpoints require `Authorization: Bearer fm_sk_...` header.
Full human reference: `../../docs/api-reference.md`. Machine-readable OpenAPI contract: `../../docs/openapi.json`.

### Auth
- `GET /api/v1/auth/me` — Current merchant role, permissions, and active users
- `POST /api/v1/auth/api-key/rotate` — Rotate the current merchant API key

### Invoices
- `POST /api/v1/invoices` — Create invoice
- `GET /api/v1/invoices` — List invoices  
- `GET /api/v1/invoices/:id` — Get invoice + auto-poll Fiber node for status updates
- `POST /api/v1/invoices/:id/cancel` — Cancel pending invoice
- `POST /api/v1/invoices/:id/refund` — Refund paid invoice
- `GET /api/v1/invoices/:id/qr` — Get QR code data

### Webhooks
- `POST /api/v1/webhooks` — Register webhook
- `GET /api/v1/webhooks` — List webhooks
- `PATCH /api/v1/webhooks/:id` — Update webhook
- `DELETE /api/v1/webhooks/:id` — Delete webhook
- `GET /api/v1/webhooks/:id/deliveries` — Delivery logs
- `GET /api/v1/webhooks/delivery-worker/status` — Durable delivery queue worker status
- `POST /api/v1/webhooks/delivery-worker/run` — Run one due-delivery queue tick
- `POST /api/v1/webhooks/:id/test` — Send test event

### Balance & Stats
- `GET /api/v1/balance/channels` — Channel balances
- `GET /api/v1/balance/total` — Total balance
- `GET /api/v1/stats` — Dashboard statistics
- `GET /api/v1/stats/revenue?days=30` — Revenue history
- `GET /api/v1/fiber/status` — Fiber node, channel, and settlement worker status
- `POST /api/v1/fiber/settlement/run` — Trigger an immediate open-invoice settlement sweep
- `GET /api/v1/health` — Health check

### Transactions
- `GET /api/v1/transactions` — List transactions
- `GET /api/v1/transactions/:id` — Get transaction

## Webhook Payload

```json
{
  "id": "delivery-uuid",
  "type": "invoice.paid",
  "created": "2026-07-04T12:00:00Z",
  "data": {
    "id": "invoice-id",
    "amount": "5000",
    "currency": "CKB",
    "status": "paid",
    "paidAt": "2026-07-04T12:00:00Z"
  }
}
```

Webhook signature: `X-Fiber-Signature` header with HMAC-SHA256 of the body.
Failed deliveries are stored in a durable SQLite outbox with `nextAttemptAt` retry timing, so the worker can resume them after restart.
