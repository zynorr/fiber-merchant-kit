# Fiber Merchant — Python SDK

Python client for the Fiber Merchant API — accept Fiber Network payments in your Python applications.

## Installation

```bash
pip install fiber-merchant
```

## Quick Start

```python
from fiber_merchant import MerchantClient

client = MerchantClient(
    base_url="http://localhost:3001/api/v1",
    api_key="fm_sk_YOUR_API_KEY"
)

# Create an invoice
invoice = client.invoices.create(
    amount="5000",
    currency="CKB",
    description="Order #1234"
)
print(f"Invoice: {invoice.id}")
print(f"Pay at: {invoice.invoice_address}")

# Check status
status = client.invoices.get(invoice.id)
print(f"Status: {status.status}")

client.close()
```

## Webhook Verification

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## License

MIT
