"""
Fiber Merchant Client — Python SDK

Provides a clean, typed interface for the Fiber Merchant API.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
import httpx


# ── Data Types ─────────────────────────────────────────────────

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
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})


@dataclass
class WebhookEndpoint:
    id: str
    url: str
    events: list[str]
    secret: str
    description: Optional[str] = None
    active: bool = True
    created_at: Optional[str] = None


@dataclass
class Transaction:
    id: str
    payment_hash: str
    direction: str  # 'incoming' | 'outgoing'
    amount: str
    currency: str
    fee: str = "0"
    status: str = "Pending"
    description: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class ChannelBalance:
    local_balance: str
    remote_balance: str
    capacity: str
    asset: str
    channel_id: str = ""
    state: str = ""
    peer_pubkey: str = ""


@dataclass
class MerchantStats:
    total_invoices: int = 0
    paid_invoices: int = 0
    total_volume: str = "0"
    success_rate: float = 0.0
    active_channels: int = 0
    channel_balances: dict = field(default_factory=lambda: {"local": "0", "remote": "0"})


# ── Client ─────────────────────────────────────────────────────

class MerchantClient:
    """Client for the Fiber Merchant API."""

    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
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
               expiry: Optional[int] = None) -> Invoice:
        body = {"amount": amount, "currency": currency}
        if description:
            body["description"] = description
        if metadata:
            body["metadata"] = metadata
        if expiry:
            body["expiry"] = expiry
        resp = self._client.post("/invoices", json=body)
        resp.raise_for_status()
        return Invoice.from_dict(resp.json())

    def get(self, invoice_id: str) -> Invoice:
        resp = self._client.get(f"/invoices/{invoice_id}")
        resp.raise_for_status()
        return Invoice.from_dict(resp.json())

    def list(self, status: Optional[str] = None,
             limit: int = 50) -> list[Invoice]:
        params = {"limit": limit}
        if status:
            params["status"] = status
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
        return WebhookEndpoint(**data)

    def list(self) -> list[WebhookEndpoint]:
        resp = self._client.get("/webhooks")
        resp.raise_for_status()
        data = resp.json()
        return [WebhookEndpoint(**item) for item in data]

    def delete(self, webhook_id: str):
        resp = self._client.delete(f"/webhooks/{webhook_id}")
        resp.raise_for_status()

    def test(self, webhook_id: str):
        resp = self._client.post(f"/webhooks/{webhook_id}/test")
        resp.raise_for_status()


class _TransactionResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def list(self, direction: Optional[str] = None,
             status: Optional[str] = None,
             limit: int = 50) -> list[Transaction]:
        params = {"limit": limit}
        if direction:
            params["direction"] = direction
        if status:
            params["status"] = status
        resp = self._client.get("/transactions", params=params)
        resp.raise_for_status()
        data = resp.json()
        return [Transaction(**item) for item in data.get("items", [])]


class _BalanceResource:
    def __init__(self, client: httpx.Client):
        self._client = client

    def get_channels(self) -> list[ChannelBalance]:
        resp = self._client.get("/balance/channels")
        resp.raise_for_status()
        data = resp.json()
        return [ChannelBalance(**item) for item in data]

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
        return MerchantStats(**data)

    def revenue_history(self, days: int = 30) -> list[dict]:
        resp = self._client.get("/stats/revenue", params={"days": days})
        resp.raise_for_status()
        return resp.json()
