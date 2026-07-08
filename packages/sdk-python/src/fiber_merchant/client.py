"""
Fiber Merchant Client — Python SDK

Provides a clean, typed interface for the Fiber Merchant API.
"""

from __future__ import annotations

import hmac
import hashlib
import re
from dataclasses import dataclass, field, fields
from typing import Any, Optional
import httpx


# ── Data Types ─────────────────────────────────────────────────

def _camel_to_snake(name: str) -> str:
    """Convert API camelCase keys to Python snake_case names."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _normalize_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {_camel_to_snake(str(k)): _normalize_keys(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_keys(item) for item in value]
    return value


def _dataclass_from_dict(cls, data: dict) -> Any:
    normalized = _normalize_keys(data)
    allowed = {f.name for f in fields(cls)}
    return cls(**{k: v for k, v in normalized.items() if k in allowed})


def _normalize_base_url(base_url: str) -> str:
    cleaned = base_url.rstrip("/")
    return cleaned if cleaned.endswith("/api/v1") else f"{cleaned}/api/v1"


def verify_webhook_signature(payload: str | bytes, signature: str, secret: str) -> bool:
    """Verify the X-Fiber-Signature HMAC for a webhook payload."""
    body = payload.encode("utf-8") if isinstance(payload, str) else payload
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@dataclass
class Invoice:
    id: str
    payment_hash: str
    invoice_address: str
    amount: str
    currency: str
    description: Optional[str] = None
    metadata: Optional[dict[str, str]] = None
    status: str = "pending"
    expires_at: Optional[str] = None
    paid_at: Optional[str] = None
    refunded_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Invoice":
        return _dataclass_from_dict(cls, data)


@dataclass
class WebhookEndpoint:
    id: str
    url: str
    events: list[str]
    secret: str
    description: Optional[str] = None
    active: bool = True
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "WebhookEndpoint":
        return _dataclass_from_dict(cls, data)


@dataclass
class WebhookDelivery:
    id: str
    event: str
    url: str
    status: int
    success: bool
    attempts: int
    payload: Any = None
    webhook_id: Optional[str] = None
    error: Optional[str] = None
    next_attempt_at: Optional[str] = None
    delivered_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "WebhookDelivery":
        return _dataclass_from_dict(cls, data)


@dataclass
class Transaction:
    id: str
    payment_hash: str
    direction: str  # 'incoming' | 'outgoing'
    amount: str
    currency: str
    fee: str = "0"
    status: str = "Pending"
    invoice_id: Optional[str] = None
    counterparty: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict[str, str]] = None
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Transaction":
        return _dataclass_from_dict(cls, data)


@dataclass
class ChannelBalance:
    local_balance: str
    remote_balance: str
    capacity: str
    asset: str
    channel_id: str = ""
    state: str = ""
    peer_pubkey: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> "ChannelBalance":
        return _dataclass_from_dict(cls, data)


@dataclass
class MerchantStats:
    total_invoices: int = 0
    paid_invoices: int = 0
    total_volume: str = "0"
    success_rate: float = 0.0
    active_channels: int = 0
    channel_balances: dict = field(default_factory=lambda: {"local": "0", "remote": "0"})

    @classmethod
    def from_dict(cls, data: dict) -> "MerchantStats":
        return _dataclass_from_dict(cls, data)


# ── Client ─────────────────────────────────────────────────────

class MerchantClient:
    """Client for the Fiber Merchant API."""

    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = _normalize_base_url(base_url)
        self.api_key = api_key
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        self.invoices = _InvoiceResource(self._client)
        self.webhooks = _WebhookResource(self._client)
        self.transactions = _TransactionResource(self._client)
        self.balance = _BalanceResource(self._client)
        self.stats = _StatsResource(self._client)

    def health(self) -> dict:
        """Check if the API server is reachable."""
        resp = self._client.get("/health")
        resp.raise_for_status()
        return resp.json()

    def close(self):
        """Close the underlying HTTP client."""
        self._client.close()


# ── Resource Classes ───────────────────────────────────────────

class _InvoiceResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def create(self, amount: str, currency: str = "CKB",
               description: Optional[str] = None,
               metadata: Optional[dict] = None,
               expiry: Optional[int] = None,
               webhook_url: Optional[str] = None,
               allow_mpp: Optional[bool] = None,
               udt_type_script: Optional[dict] = None,
               idempotency_key: Optional[str] = None) -> Invoice:
        body = {"amount": amount, "currency": currency}
        if description:
            body["description"] = description
        if metadata:
            body["metadata"] = metadata
        if expiry:
            body["expiry"] = expiry
        if webhook_url:
            body["webhookUrl"] = webhook_url
        if allow_mpp is not None:
            body["allowMpp"] = allow_mpp
        if udt_type_script:
            body["udtTypeScript"] = udt_type_script
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        if headers:
            resp = self._client.post("/invoices", json=body, headers=headers)
        else:
            resp = self._client.post("/invoices", json=body)
        resp.raise_for_status()
        return Invoice.from_dict(resp.json())

    def get(self, invoice_id: str) -> Invoice:
        resp = self._client.get(f"/invoices/{invoice_id}")
        resp.raise_for_status()
        return Invoice.from_dict(resp.json())

    def list(self, status: Optional[str] = None,
             cursor: Optional[str] = None,
             limit: int = 50) -> list[Invoice]:
        params = {"limit": limit}
        if status:
            params["status"] = status
        if cursor:
            params["cursor"] = cursor
        resp = self._client.get("/invoices", params=params)
        resp.raise_for_status()
        data = resp.json()
        return [Invoice.from_dict(item) for item in data.get("items", [])]

    def cancel(self, invoice_id: str) -> Invoice:
        resp = self._client.post(f"/invoices/{invoice_id}/cancel")
        resp.raise_for_status()
        return Invoice.from_dict(resp.json())

    def refund(self, invoice_id: str, reason: Optional[str] = None) -> Invoice:
        body = {}
        if reason:
            body["reason"] = reason
        resp = self._client.post(f"/invoices/{invoice_id}/refund", json=body)
        resp.raise_for_status()
        return Invoice.from_dict(resp.json())

    def get_qr(self, invoice_id: str) -> dict:
        resp = self._client.get(f"/invoices/{invoice_id}/qr")
        resp.raise_for_status()
        return resp.json()


class _WebhookResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def register(self, url: str, events: list[str],
                 description: Optional[str] = None) -> WebhookEndpoint:
        body = {"url": url, "events": events}
        if description:
            body["description"] = description
        resp = self._client.post("/webhooks", json=body)
        resp.raise_for_status()
        data = resp.json()
        return WebhookEndpoint.from_dict(data)

    def list(self) -> list[WebhookEndpoint]:
        resp = self._client.get("/webhooks")
        resp.raise_for_status()
        data = resp.json()
        return [WebhookEndpoint.from_dict(item) for item in data]

    def get(self, webhook_id: str) -> WebhookEndpoint:
        resp = self._client.get(f"/webhooks/{webhook_id}")
        resp.raise_for_status()
        return WebhookEndpoint.from_dict(resp.json())

    def update(self, webhook_id: str,
               url: Optional[str] = None,
               events: Optional[list[str]] = None,
               description: Optional[str] = None,
               active: Optional[bool] = None) -> WebhookEndpoint:
        body: dict[str, Any] = {}
        if url is not None:
            body["url"] = url
        if events is not None:
            body["events"] = events
        if description is not None:
            body["description"] = description
        if active is not None:
            body["active"] = active
        resp = self._client.patch(f"/webhooks/{webhook_id}", json=body)
        resp.raise_for_status()
        return WebhookEndpoint.from_dict(resp.json())

    def delete(self, webhook_id: str):
        resp = self._client.delete(f"/webhooks/{webhook_id}")
        resp.raise_for_status()

    def get_deliveries(self, webhook_id: str) -> list[WebhookDelivery]:
        resp = self._client.get(f"/webhooks/{webhook_id}/deliveries")
        resp.raise_for_status()
        return [WebhookDelivery.from_dict(item) for item in resp.json()]

    def retry_delivery(self, webhook_id: str, delivery_id: str) -> dict:
        resp = self._client.post(f"/webhooks/{webhook_id}/deliveries/{delivery_id}/retry")
        resp.raise_for_status()
        return resp.json()

    def test(self, webhook_id: str) -> dict:
        resp = self._client.post(f"/webhooks/{webhook_id}/test")
        resp.raise_for_status()
        return resp.json()


class _TransactionResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def list(self, direction: Optional[str] = None,
             status: Optional[str] = None,
             cursor: Optional[str] = None,
             limit: int = 50) -> list[Transaction]:
        params = {"limit": limit}
        if direction:
            params["direction"] = direction
        if status:
            params["status"] = status
        if cursor:
            params["cursor"] = cursor
        resp = self._client.get("/transactions", params=params)
        resp.raise_for_status()
        data = resp.json()
        return [Transaction.from_dict(item) for item in data.get("items", [])]

    def get(self, transaction_id: str) -> Transaction:
        resp = self._client.get(f"/transactions/{transaction_id}")
        resp.raise_for_status()
        return Transaction.from_dict(resp.json())


class _BalanceResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def get_channels(self) -> list[ChannelBalance]:
        resp = self._client.get("/balance/channels")
        resp.raise_for_status()
        data = resp.json()
        return [ChannelBalance.from_dict(item) for item in data]

    def get_total(self) -> dict:
        resp = self._client.get("/balance/total")
        resp.raise_for_status()
        return resp.json()


class _StatsResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def get(self) -> MerchantStats:
        resp = self._client.get("/stats")
        resp.raise_for_status()
        data = resp.json()
        return MerchantStats.from_dict(data)

    def revenue_history(self, days: int = 30) -> list[dict]:
        resp = self._client.get("/stats/revenue", params={"days": days})
        resp.raise_for_status()
        return resp.json()
