# Fiber Merchant API — Reference

Base URL: `http://localhost:3001/api/v1`
Authentication: `Authorization: Bearer fm_sk_...`
Machine-readable contract: [openapi.json](openapi.json)

## Auth Context

### Current Merchant

`GET /auth/me`

Returns the authenticated merchant API key context, role, permissions, and active merchant users.

### Rotate API Key

`POST /auth/api-key/rotate`

Rotates the current merchant API key. Requires an `owner` or `admin` role. The returned key replaces the previous bearer token.

## Public Discovery

These endpoints are unauthenticated and safe to open during local review.

### Server Index

`GET /`

Browser-friendly server index at `http://localhost:3001` with links to API discovery, health, dashboard, demo store, and judge review docs.

### API Discovery

`GET /api/v1`

Returns machine-readable metadata for the running kit.

**Response:**
```json
{
  "name": "Fiber Merchant Kit",
  "version": "1.0.0",
  "mode": "demo",
  "services": {
    "api": "http://localhost:3001/api/v1",
    "health": "http://localhost:3001/api/v1/health",
    "adminDashboard": "http://localhost:5173",
    "demoStore": "http://localhost:5174"
  },
  "publicEndpoints": [
    "GET /",
    "GET /api/v1",
    "GET /api/v1/health",
    "GET /api/v1/demo-store/demo-key",
    "POST /api/v1/demo-store/checkout",
    "GET /api/v1/demo-store/invoices/:id"
  ],
  "authenticatedResources": ["invoices", "webhooks", "transactions"]
}
```

### Health Check

`GET /health`

Returns `ok` when the configured Fiber node or demo client responds, and `degraded` when the Fiber node is unreachable.

## Demo Store Checkout

These endpoints are unauthenticated and exist for the bundled FiberStore demo. They create invoices through the server-side demo merchant so shopper browsers never receive a merchant API key.

### Hosted Demo Dashboard Key

`GET /demo-store/demo-key`

Hosted demo mode only. Returns the temporary demo merchant key used by the bundled dashboard's `Use demo key` helper. The endpoint returns `404` unless `EXPOSE_DEMO_KEY=true`, `NODE_ENV` is not `production`, and no live Fiber RPC URL is configured.

**Response:**
```json
{
  "apiKey": "fm_sk_demo_...",
  "mode": "demo",
  "warning": "Demo dashboard key only. Do not expose real merchant API keys in browsers."
}
```

### Create Demo Checkout

`POST /demo-store/checkout`

Creates a Fiber invoice for the submitted demo product IDs. The server owns the catalog and calculates the total; the browser does not submit a trusted amount.

**Request:**
```json
{
  "items": [
    { "productId": 1, "quantity": 2 }
  ]
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "paymentHash": "abc123...",
  "invoiceAddress": "fibt1...",
  "amount": "10000",
  "currency": "CKB",
  "status": "pending",
  "order": {
    "items": [
      { "id": 1, "name": "Cyber Widget", "quantity": 2, "unitAmount": 5000, "amount": 10000 }
    ],
    "totalAmount": "10000",
    "currency": "CKB"
  }
}
```

### Get Demo Checkout Invoice

`GET /demo-store/invoices/:id`

Returns and refreshes one demo-store invoice by ID.

### Simulate Demo Checkout Payment

`POST /demo-store/invoices/:id/simulate-payment`

Demo mode only. Lets FiberStore complete a deterministic local checkout without exposing the merchant API key.

## Invoices

### Create Invoice

`POST /invoices`

Creates a new payment invoice. Returns the invoice details including a Bech32m-encoded invoice address that can be rendered as a QR code.

Optional header: `Idempotency-Key: order-123`. Reusing the same key with the same request body replays the original invoice and sets `Idempotency-Replayed: true`; reusing the key with a different body returns `409`.

**Request:**
```json
{
  "amount": "5000",
  "currency": "CKB",
  "description": "Order #1234",
  "metadata": {
    "customer_id": "cus_123",
    "order_id": "ORD-001"
  },
  "expiry": 3600,
  "allowMpp": true
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "paymentHash": "abc123...",
  "invoiceAddress": "fibt1...",
  "amount": "5000",
  "currency": "CKB",
  "description": "Order #1234",
  "metadata": {"customer_id": "cus_123"},
  "status": "pending",
  "expiresAt": "2026-07-04T13:00:00Z",
  "createdAt": "2026-07-04T12:00:00Z"
}
```

### Get Invoice

`GET /invoices/:id`

Retrieves invoice details. Automatically polls the Fiber node for status updates on pending invoices.

**Response:**
```json
{
  "id": "550e8400-...",
  "paymentHash": "abc123...",
  "invoiceAddress": "fibt1...",
  "amount": "5000",
  "currency": "CKB",
  "status": "paid",
  "paidAt": "2026-07-04T12:05:00Z",
  "createdAt": "2026-07-04T12:00:00Z"
}
```

### List Invoices

`GET /invoices?status=paid&limit=50&cursor=...`

**Response:**
```json
{
  "items": [
    {
      "id": "...",
      "paymentHash": "...",
      "amount": "5000",
      "currency": "CKB",
      "status": "paid",
      "createdAt": "2026-07-04T12:00:00Z"
    }
  ],
  "total": 42,
  "cursor": "eyJpZCI6IjU1MGU4NDAwLi4uIiwiY3JlYXRlZEF0IjoiMjAyNi0wNy0wNFQxMjowMDowMFoifQ"
}
```

The cursor is opaque. Pass it back exactly as returned to fetch the next page.

### Cancel Invoice

`POST /invoices/:id/cancel`

Only pending invoices can be cancelled.

### Simulate Payment

`POST /invoices/:id/simulate-payment`

Demo mode only. Marks a pending or received invoice as paid, promotes the incoming transaction, and emits the normal `invoice.paid` webhook. Production mode returns `404`.

### Refund Invoice

`POST /invoices/:id/refund`

Only paid invoices can be refunded. Initiates a payment back to the original payer via the Fiber node.

**Request:**
```json
{
  "reason": "Customer requested refund"
}
```

### Get QR Code

`GET /invoices/:id/qr`

**Response:**
```json
{
  "invoiceAddress": "fibt1...",
  "qrData": "fibt1..."
}
```

## Webhooks

### Register Webhook

`POST /webhooks`

**Request:**
```json
{
  "url": "https://api.mystore.com/webhooks/fiber",
  "events": ["invoice.paid", "invoice.expired"],
  "description": "Production webhook"
}
```

**Response (201):**
```json
{
  "id": "webhook-uuid",
  "url": "https://api.mystore.com/webhooks/fiber",
  "events": ["invoice.paid", "invoice.expired"],
  "secret": "whsec_abc123...",
  "active": true,
  "createdAt": "2026-07-04T12:00:00Z"
}
```

**Important:** Save the `secret` value. It's shown only once and used to verify webhook signatures. TypeScript apps can call `verifyWebhookSignature(rawBody, signature, secret)` from `@fiber-merchant/sdk`; pass the exact raw request body bytes/string.

### List Webhooks

`GET /webhooks`

### Update Webhook

`PATCH /webhooks/:id`

### Delete Webhook

`DELETE /webhooks/:id`

### Get Delivery Logs

`GET /webhooks/:id/deliveries`

**Response:**
```json
[
  {
    "id": "delivery-uuid",
    "webhookId": "webhook-uuid",
    "event": "invoice.paid",
    "url": "https://api.mystore.com/webhooks/fiber",
    "status": 200,
    "success": true,
    "attempts": 1,
    "nextAttemptAt": null,
    "payload": {
      "id": "invoice-uuid",
      "status": "paid"
    },
    "error": null,
    "deliveredAt": "2026-07-04T12:05:00Z"
  }
]
```

### Retry Delivery

`POST /webhooks/:id/deliveries/:deliveryId/retry`

Queues a fresh delivery attempt using the stored event payload. The original delivery log remains unchanged; the retry is written as a new delivery record so operators can compare attempts.

**Response (202):**
```json
{
  "message": "Delivery retry queued",
  "delivery": {
    "id": "delivery-retry-uuid",
    "webhookId": "webhook-uuid",
    "event": "invoice.paid",
    "url": "https://api.mystore.com/webhooks/fiber",
    "status": 0,
    "success": false,
    "attempts": 0,
    "nextAttemptAt": "2026-07-04T12:07:00Z",
    "payload": {
      "id": "invoice-uuid",
      "status": "paid"
    },
    "error": null,
    "deliveredAt": "2026-07-04T12:07:00Z"
  }
}
```

### Webhook Delivery Worker Status

`GET /webhooks/delivery-worker/status`

Returns the durable webhook outbox worker configuration and last run summary.

### Run Webhook Delivery Worker

`POST /webhooks/delivery-worker/run`

Runs one due-delivery queue tick immediately.

**Request:**
```json
{
  "limit": 25
}
```

**Response:**
```json
{
  "trigger": "manual",
  "startedAt": "2026-07-08T12:00:00Z",
  "finishedAt": "2026-07-08T12:00:01Z",
  "summary": {
    "checked": 2,
    "delivered": 1,
    "rescheduled": 1,
    "failed": 0,
    "skipped": 0,
    "errors": 0
  }
}
```

### Test Webhook

`POST /webhooks/:id/test`

**Response:**
```json
{
  "message": "Test event sent",
  "webhookId": "webhook-uuid"
}
```

## Balance

### Channel Balances

`GET /balance/channels`

**Response:**
```json
[
  {
    "localBalance": "500000",
    "remoteBalance": "500000",
    "capacity": "1000000",
    "asset": "CKB",
    "channelId": "ch-1",
    "state": "Ready",
    "peerPubkey": "02abc..."
  }
]
```

### Total Balance

`GET /balance/total`

**Response:**
```json
{
  "local": "500000",
  "remote": "500000",
  "total": "1000000"
}
```

## Stats

### Dashboard Stats

`GET /stats`

### Revenue History

`GET /stats/revenue?days=30`

## Fiber Status

### Network Status

`GET /fiber/status`

Returns a normalized view of the connected Fiber node, channels, and background invoice settlement worker. The endpoint never exposes Fiber RPC credentials.
When `FIBER_NODE_RPC_URLS` is configured, the response includes sanitized per-endpoint reachability.

**Response:**
```json
{
  "mode": "live",
  "reachable": true,
  "rpcUrlConfigured": true,
  "currency": "Fibt",
  "checkedAt": "2026-07-08T12:00:00Z",
  "worker": {
    "enabled": true,
    "active": true,
    "running": false,
    "mode": "live",
    "intervalMs": 30000,
    "batchSize": 25
  },
  "node": {
    "nodeId": "02abc...",
    "version": "0.8.1",
    "peersCount": 2,
    "channelsCount": 1,
    "pendingChannelsCount": 0
  },
  "channels": {
    "total": 1,
    "ready": 1,
    "pending": 0,
    "failed": 0,
    "localBalance": "700000",
    "remoteBalance": "300000",
    "totalCapacity": "1000000",
    "items": []
  }
}
```

### Run Settlement

`POST /fiber/settlement/run`

Runs the same open-invoice reconciliation used by the background settlement worker and returns a summary of state transitions.

**Response:**
```json
{
  "trigger": "manual",
  "running": false,
  "skipped": false,
  "startedAt": "2026-07-08T12:00:00Z",
  "finishedAt": "2026-07-08T12:00:01Z",
  "summary": {
    "checked": 2,
    "paid": 1,
    "received": 0,
    "expired": 0,
    "unchanged": 1,
    "errors": 0
  }
}
```

## Transactions

### List Transactions

`GET /transactions?direction=incoming&limit=50`

### Get Transaction

`GET /transactions/:id`
