# Fiber Merchant API — Reference

Base URL: `http://localhost:3001/api/v1`
Authentication: `Authorization: Bearer fm_sk_...`

## Invoices

### Create Invoice

`POST /invoices`

Creates a new payment invoice. Returns the invoice details including a Bech32m-encoded invoice address that can be rendered as a QR code.

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

**Important:** Save the `secret` value. It's shown only once and used to verify webhook signatures.

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
    "payload": {
      "id": "invoice-uuid",
      "status": "paid"
    },
    "error": null,
    "deliveredAt": "2026-07-04T12:05:00Z"
  }
]
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

## Transactions

### List Transactions

`GET /transactions?direction=incoming&limit=50`

### Get Transaction

`GET /transactions/:id`

## Health

### Health Check

`GET /health`
