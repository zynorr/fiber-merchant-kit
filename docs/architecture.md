# Fiber Merchant Kit -- Architecture

## Overview

The Fiber Merchant Kit bridges the gap between low-level Fiber Network Node (FNN) RPC calls and the high-level APIs that merchants and developers need to accept payments.

## Design Goals

1. **Developer-friendly** -- Abstract channel management, preimage generation, and invoice lifecycle
2. **Merchant-centric** -- Webhooks, refunds, transaction history, and accounting exports
3. **Multi-language** -- TypeScript and Python SDKs with consistent API patterns
4. **Security-first** -- API key authentication, HMAC-signed webhooks, no direct node exposure
5. **Fiber-native** -- Works with FNN RPC to create invoices, poll status, and manage channels

## Data Flow

### Creating an Invoice

```
Merchant App -> SDK -> Merchant API -> FNN Node
    |                          |
    |                          +-- new_invoice RPC
    |                          +-- Returns: invoiceAddress, paymentHash, preimage
    |                          |
    |                          +-- Store in SQLite
    |
    +-- Returns: Invoice object with ID, address, status
```

### Receiving a Payment (Polling)

```
Merchant App -> SDK -> Merchant API -> FNN Node
                              |
                              +-- get_invoice RPC (polled)
                              +-- If status = "Paid":
                              |   +-- Update SQLite -> "paid"
                              |   +-- Create Transaction record
                              |   +-- Fire webhook: invoice.paid
                              |   +-- Return updated Invoice
                              |
                              +-- Return Invoice with current status
```

### Webhook Delivery

```
FNN Node detects payment
    |
    v
Merchant API polls and detects "Paid"
    |
    +-- Looks up registered webhooks matching "invoice.paid" event
    +-- For each matching webhook:
    |   +-- POST payload to webhook URL
    |   +-- Include X-Fiber-Signature (HMAC-SHA256)
    |   +-- Log delivery result
    |   +-- If failed: retry with exponential backoff (up to 5 attempts)
    |
    +-- Merchant receives webhook notification
```

## Key Design Decisions

### Why a Proxy Architecture?

The browser never communicates directly with the Fiber Node RPC. Instead, the Merchant API Server acts as a proxy:
- Prevents exposure of RPC credentials
- Allows webhook delivery (browser cannot send webhooks)
- Provides persistent storage (SQLite) for invoices and transactions
- Enables API key authentication

### Why SQLite?

- Zero configuration -- no external database needed
- File-based -- easy to back up
- Sufficient for a merchant processing thousands of payments
- Can be swapped for PostgreSQL in production

### Webhook Reliability

- At-least-once delivery semantics
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Persistent delivery logs for debugging
- Event-level subscription (merchants choose which events to receive)

## Future Enhancements

- PostgreSQL database adapter
- Rate limiting per API key
- Multi-user merchant accounts
- Analytics dashboard with charts
- BOLT12 Offer support for static payment addresses
- Submarine swaps (on-chain to off-chain)
