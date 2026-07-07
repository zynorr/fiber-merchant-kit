# Fiber Merchant API -- Quick Reference

Full documentation: [docs/api-reference.md](docs/api-reference.md)

Base URL: `http://localhost:3001/api/v1`
Authentication: `Authorization: Bearer fm_sk_...`

---

## Invoices

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/invoices` | Create invoice -- `{ amount, currency?, description?, metadata?, expiry? }` |
| `GET` | `/invoices` | List invoices -- `?status=paid&limit=50&cursor=...` |
| `GET` | `/invoices/:id` | Get invoice + auto-poll for payment status |
| `POST` | `/invoices/:id/cancel` | Cancel pending invoice |
| `POST` | `/invoices/:id/simulate-payment` | Demo mode only -- mark invoice paid for local walkthroughs |
| `POST` | `/invoices/:id/refund` | Refund paid invoice -- `{ reason? }` |
| `GET` | `/invoices/:id/qr` | Get QR code data |

## Webhooks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/webhooks` | Register -- `{ url, events: ["invoice.paid",...], description? }` |
| `GET` | `/webhooks` | List all webhooks |
| `GET` | `/webhooks/:id` | Get webhook details |
| `PATCH` | `/webhooks/:id` | Update webhook |
| `DELETE` | `/webhooks/:id` | Delete webhook |
| `GET` | `/webhooks/:id/deliveries` | Delivery logs |
| `POST` | `/webhooks/:id/deliveries/:deliveryId/retry` | Queue a fresh retry for an existing delivery |
| `POST` | `/webhooks/:id/test` | Send test event |

## Balance & Stats

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/balance/channels` | Channel balances |
| `GET` | `/balance/total` | Total local/remote balance |
| `GET` | `/stats` | Dashboard stats |
| `GET` | `/stats/revenue?days=30` | Revenue history |
| `GET` | `/health` | Health check |

## Transactions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/transactions` | List -- `?direction=incoming&status=Succeeded&limit=50` |
| `GET` | `/transactions/:id` | Get transaction |

---

## Quick Test

```bash
# Health check (no auth needed)
curl http://localhost:3001/api/v1/health

# Create invoice
curl -X POST http://localhost:3001/api/v1/invoices \
  -H "Authorization: Bearer fm_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount":"5000","currency":"CKB","description":"Test"}'

# List invoices
curl http://localhost:3001/api/v1/invoices \
  -H "Authorization: Bearer fm_sk_YOUR_KEY"
```
