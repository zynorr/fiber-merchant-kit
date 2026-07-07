"""
Unit tests for Fiber Merchant Python SDK (fiber_merchant.client)

Mocks httpx.Client to avoid real HTTP calls.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock, patch

import httpx
import pytest

from fiber_merchant import MerchantClient
from fiber_merchant.client import (
    ChannelBalance,
    Invoice,
    MerchantStats,
    Transaction,
    WebhookEndpoint,
)


# ── Fixtures ───────────────────────────────────────────────────

@pytest.fixture
def mock_client():
    """Create a MerchantClient with a mocked httpx.Client."""
    with patch("fiber_merchant.client.httpx.Client") as mock_httpx_cls:
        mock_instance = MagicMock()
        mock_httpx_cls.return_value = mock_instance

        client = MerchantClient(
            base_url="http://localhost:3001",
            api_key="fm_sk_test1234567890abcdef",
        )

        yield client, mock_instance


@pytest.fixture
def mock_response():
    """Create a mock httpx.Response with the given data and status."""
    def _make(data: Any, status: int = 200):
        resp = MagicMock()
        resp.status_code = status
        resp.json.return_value = data
        resp.raise_for_status.return_value = None
        return resp
    return _make


# ── Constructor ────────────────────────────────────────────────

class TestMerchantClientConstructor:
    def test_creates_httpx_client_with_correct_base_url(self):
        with patch("fiber_merchant.client.httpx.Client") as mock_httpx_cls:
            MerchantClient(
                base_url="http://localhost:3001",
                api_key="fm_sk_key",
            )
            mock_httpx_cls.assert_called_once()
            args, kwargs = mock_httpx_cls.call_args
            assert kwargs["base_url"] == "http://localhost:3001"

    def test_strips_trailing_slash_from_base_url(self):
        with patch("fiber_merchant.client.httpx.Client"):
            client = MerchantClient(
                base_url="http://localhost:3001/",
                api_key="fm_sk_key",
            )
            assert client.base_url == "http://localhost:3001"

    def test_sets_authorization_header(self):
        with patch("fiber_merchant.client.httpx.Client") as mock_httpx_cls:
            MerchantClient(
                base_url="http://localhost:3001",
                api_key="fm_sk_test_key",
            )
            _, kwargs = mock_httpx_cls.call_args
            assert kwargs["headers"]["Authorization"] == "Bearer fm_sk_test_key"

    def test_exposes_all_resource_apis(self):
        with patch("fiber_merchant.client.httpx.Client"):
            client = MerchantClient(
                base_url="http://localhost:3001",
                api_key="fm_sk_key",
            )
            assert hasattr(client, "invoices")
            assert hasattr(client, "webhooks")
            assert hasattr(client, "transactions")
            assert hasattr(client, "balance")
            assert hasattr(client, "stats")

    def test_close_method(self):
        with patch("fiber_merchant.client.httpx.Client") as mock_httpx_cls:
            mock_instance = MagicMock()
            mock_httpx_cls.return_value = mock_instance

            client = MerchantClient(
                base_url="http://localhost:3001",
                api_key="fm_sk_key",
            )
            client.close()
            mock_instance.close.assert_called_once()


# ── Data Classes ───────────────────────────────────────────────

class TestInvoiceFromDict:
    def test_from_dict_creates_invoice(self):
        data = {
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "pending",
        }
        inv = Invoice.from_dict(data)
        assert inv.id == "inv-123"
        assert inv.amount == "5000"
        assert inv.status == "pending"

    def test_from_dict_ignores_unknown_fields(self):
        data = {
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "unknown_field": "should_be_ignored",
        }
        inv = Invoice.from_dict(data)
        assert not hasattr(inv, "unknown_field")


# ── Health ─────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_status(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response(
            {"status": "ok", "version": "1.0.0"}
        )

        result = client.health()

        mock_httpx.get.assert_called_once_with("/health")
        assert result["status"] == "ok"
        assert result["version"] == "1.0.0"


# ── Invoices ───────────────────────────────────────────────────

class TestInvoices:
    def test_create_sends_post(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "pending",
        })

        inv = client.invoices.create(amount="5000", currency="CKB", description="Test")

        mock_httpx.post.assert_called_once_with(
            "/invoices",
            json={"amount": "5000", "currency": "CKB", "description": "Test"},
        )
        assert inv.id == "inv-123"
        assert inv.status == "pending"

    def test_create_with_optional_fields(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "inv-456",
            "payment_hash": "0xdef",
            "invoice_address": "fibt1...",
            "amount": "1000",
            "currency": "RUSD",
            "status": "pending",
        })

        client.invoices.create(
            amount="1000",
            currency="RUSD",
            description="Optional fields test",
            metadata={"order_id": "ORD-001"},
            expiry=3600,
        )

        _, kwargs = mock_httpx.post.call_args
        assert kwargs["json"]["metadata"] == {"order_id": "ORD-001"}
        assert kwargs["json"]["expiry"] == 3600

    def test_get_returns_invoice(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "paid",
        })

        inv = client.invoices.get("inv-123")

        mock_httpx.get.assert_called_once_with("/invoices/inv-123")
        assert inv.status == "paid"

    def test_list_returns_invoices(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "items": [
                {"id": "inv-1", "payment_hash": "0xa", "invoice_address": "a", "amount": "100", "currency": "CKB", "status": "paid"},
                {"id": "inv-2", "payment_hash": "0xb", "invoice_address": "b", "amount": "200", "currency": "CKB", "status": "pending"},
            ],
            "total": 2,
        })

        invoices = client.invoices.list(status="paid", limit=10)

        mock_httpx.get.assert_called_once_with("/invoices", params={"status": "paid", "limit": 10})
        assert len(invoices) == 2
        assert invoices[0].id == "inv-1"
        assert invoices[1].status == "pending"

    def test_list_without_status(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({"items": [], "total": 0})

        client.invoices.list()

        mock_httpx.get.assert_called_once_with("/invoices", params={"limit": 50})

    def test_cancel_returns_invoice(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "cancelled",
        })

        inv = client.invoices.cancel("inv-123")

        mock_httpx.post.assert_called_once_with("/invoices/inv-123/cancel")
        assert inv.status == "cancelled"

    def test_refund_with_reason(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "refunded",
        })

        inv = client.invoices.refund("inv-123", reason="Customer request")

        mock_httpx.post.assert_called_once_with(
            "/invoices/inv-123/refund",
            json={"reason": "Customer request"},
        )
        assert inv.status == "refunded"

    def test_refund_without_reason(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "refunded",
        })

        client.invoices.refund("inv-123")

        mock_httpx.post.assert_called_once_with(
            "/invoices/inv-123/refund",
            json={},
        )

    def test_get_qr_returns_data(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "invoiceAddress": "fibt1...",
            "qrData": "fibt1...",
        })

        result = client.invoices.get_qr("inv-123")

        mock_httpx.get.assert_called_once_with("/invoices/inv-123/qr")
        assert result["invoiceAddress"] == "fibt1..."


# ── Webhooks ───────────────────────────────────────────────────

class TestWebhooks:
    def test_register_sends_post(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "wh-123",
            "url": "https://example.com/hook",
            "events": ["invoice.paid", "invoice.expired"],
            "secret": "whsec_abc",
            "active": True,
        })

        wh = client.webhooks.register(
            url="https://example.com/hook",
            events=["invoice.paid", "invoice.expired"],
            description="Test webhook",
        )

        mock_httpx.post.assert_called_once_with(
            "/webhooks",
            json={"url": "https://example.com/hook", "events": ["invoice.paid", "invoice.expired"], "description": "Test webhook"},
        )
        assert wh.id == "wh-123"
        assert wh.secret == "whsec_abc"

    def test_list_returns_webhooks(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response([
            {"id": "wh-1", "url": "https://example.com/1", "events": ["invoice.paid"], "secret": "s1", "active": True},
            {"id": "wh-2", "url": "https://example.com/2", "events": ["invoice.expired"], "secret": "s2", "active": True},
        ])

        webhooks = client.webhooks.list()

        mock_httpx.get.assert_called_once_with("/webhooks")
        assert len(webhooks) == 2
        assert webhooks[0].id == "wh-1"

    def test_delete_calls_delete(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.delete.return_value = mock_response(None, status=204)

        client.webhooks.delete("wh-123")

        mock_httpx.delete.assert_called_once_with("/webhooks/wh-123")

    def test_test_calls_post(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response(None, status=200)

        client.webhooks.test("wh-123")

        mock_httpx.post.assert_called_once_with("/webhooks/wh-123/test")


# ── Transactions ───────────────────────────────────────────────

class TestTransactions:
    def test_list_returns_transactions(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "items": [
                {"id": "tx-1", "payment_hash": "0xa", "direction": "incoming", "amount": "100", "currency": "CKB"},
                {"id": "tx-2", "payment_hash": "0xb", "direction": "outgoing", "amount": "50", "currency": "CKB"},
            ],
            "total": 2,
        })

        txs = client.transactions.list(direction="incoming", status="Succeeded")

        mock_httpx.get.assert_called_once_with(
            "/transactions",
            params={"direction": "incoming", "status": "Succeeded", "limit": 50},
        )
        assert len(txs) == 2
        assert txs[0].id == "tx-1"

    def test_list_without_filters(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({"items": [], "total": 0})

        client.transactions.list()

        mock_httpx.get.assert_called_once_with(
            "/transactions",
            params={"limit": 50},
        )


# ── Balance ────────────────────────────────────────────────────

class TestBalance:
    def test_get_channels_returns_list(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response([
            {"local_balance": "500000", "remote_balance": "500000", "capacity": "1000000", "asset": "CKB"},
        ])

        channels = client.balance.get_channels()

        mock_httpx.get.assert_called_once_with("/balance/channels")
        assert len(channels) == 1
        assert channels[0].asset == "CKB"
        assert channels[0].local_balance == "500000"

    def test_get_total_returns_summary(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "local": "500000",
            "remote": "500000",
            "total": "1000000",
        })

        total = client.balance.get_total()

        mock_httpx.get.assert_called_once_with("/balance/total")
        assert total["total"] == "1000000"


# ── Stats ──────────────────────────────────────────────────────

class TestStats:
    def test_get_returns_stats(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "total_invoices": 100,
            "paid_invoices": 75,
            "total_volume": "500000",
            "success_rate": 75.0,
            "active_channels": 2,
            "channel_balances": {"local": "500000", "remote": "500000"},
        })

        stats = client.stats.get()

        mock_httpx.get.assert_called_once_with("/stats")
        assert stats.total_invoices == 100
        assert stats.paid_invoices == 75
        assert stats.total_volume == "500000"

    def test_revenue_history_returns_list(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response([
            {"date": "2026-07-01", "volume": "1000", "count": 2},
            {"date": "2026-07-02", "volume": "2000", "count": 3},
        ])

        revenue = client.stats.revenue_history(days=7)

        mock_httpx.get.assert_called_once_with("/stats/revenue", params={"days": 7})
        assert len(revenue) == 2
        assert revenue[0]["date"] == "2026-07-01"

    def test_revenue_history_default_days(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response([])

        client.stats.revenue_history()

        mock_httpx.get.assert_called_once_with("/stats/revenue", params={"days": 30})


# ── Error Handling ─────────────────────────────────────────────

class TestErrorHandling:
    def test_raises_on_api_error(self, mock_client):
        client, mock_httpx = mock_client
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "400 Bad Request",
            request=MagicMock(),
            response=MagicMock(status_code=400),
        )
        mock_httpx.get.return_value = mock_response

        with pytest.raises(httpx.HTTPStatusError):
            client.invoices.get("invalid-id")

    def test_raises_on_network_error(self, mock_client):
        client, mock_httpx = mock_client
        mock_httpx.get.side_effect = httpx.ConnectError("Connection refused")

        with pytest.raises(httpx.ConnectError):
            client.health()
