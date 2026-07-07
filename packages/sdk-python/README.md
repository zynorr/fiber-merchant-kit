# Fiber Merchant -- Python SDK

Python client for the Fiber Merchant API -- accept Fiber Network payments in Python applications.

## Installation

```bash
pip install fiber-merchant
```

## Quick Start

```python
from fiber_merchant import MerchantClient

client = MerchantClient(
    base_url="http://localhost:3001",
    api_key="fm_sk_YOUR_API_KEY"
)

invoice = client.invoices.create(
    amount="5000",
    currency="CKB",
    description="Order #1234"
)

print(f"Invoice: {invoice.id}")
print(f"Pay at: {invoice.invoice_address}")

latest = client.invoices.get(invoice.id)
print(f"Status: {latest.status}")

client.close()
```

## Webhook Verification

```python
from fiber_merchant import verify_webhook_signature

is_valid = verify_webhook_signature(
    payload=request.body,
    signature=request.headers["X-Fiber-Signature"],
    secret="whsec_..."
)
```

## License

MIT
