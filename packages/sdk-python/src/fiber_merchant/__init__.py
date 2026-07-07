"""
Fiber Merchant Kit — Python SDK

A "Stripe-style" payment processing SDK for the Fiber Network.
Handles invoice creation, payment verification, webhook delivery,
refunds, channel balance management, and transaction history.

Usage:
    from fiber_merchant import MerchantClient

    client = MerchantClient(
        base_url="http://localhost:3001/api/v1",
        api_key="fm_sk_..."
    )

    # Create an invoice
    invoice = client.invoices.create(
        amount="5000",
        currency="CKB",
        description="Order #1234"
    )

    # Check payment status
    status = client.invoices.get(invoice.id)
    print(f"Status: {status.status}")
"""

from .client import MerchantClient

__all__ = ["MerchantClient"]
__version__ = "1.0.0"
