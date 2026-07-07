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

| Variable | Default | Description |
|---|---|---|
| PORT | 3001 | HTTP port |
| FIBER_NODE_RPC_URL | demo | Fiber node RPC endpoint. Set to your actual FNN RPC URL for production. Use "demo" for testing. |
| FIBER_NODE_RPC_USER | — | RPC auth username |
| FIBER_NODE_RPC_PASSWORD | — | RPC auth password |
| CORS_ORIGIN | * | Allowed CORS origin |
| FIBER_MERCHANT_DB_PATH | ./data/merchant.db | SQLite database path |

## API Endpoints

All authenticated endpoints require `Authorization: Bearer fm_sk_...` header.

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
- `POST /api/v1/webhooks/:id/test` — Send test event

### Balance & Stats
- `GET /api/v1/balance/channels` — Channel balances
- `GET /api/v1/balance/total` — Total balance
- `GET /api/v1/stats` — Dashboard statistics
- `GET /api/v1/stats/revenue?days=30` — Revenue history
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
