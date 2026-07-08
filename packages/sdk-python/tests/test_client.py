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
    WebhookDelivery,
    WebhookEndpoint,
    verify_webhook_signature,
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
            assert kwargs["base_url"] == "http://localhost:3001/api/v1"

    def test_strips_trailing_slash_from_base_url(self):
        with patch("fiber_merchant.client.httpx.Client"):
            client = MerchantClient(
                base_url="http://localhost:3001/",
                api_key="fm_sk_key",
            )
            assert client.base_url == "http://localhost:3001/api/v1"

    def test_does_not_duplicate_api_version_in_base_url(self):
        with patch("fiber_merchant.client.httpx.Client") as mock_httpx_cls:
            MerchantClient(
                base_url="http://localhost:3001/api/v1",
                api_key="fm_sk_key",
            )
            _, kwargs = mock_httpx_cls.call_args
            assert kwargs["base_url"] == "http://localhost:3001/api/v1"

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

    def test_from_dict_accepts_camel_case_api_fields(self):
        data = {
            "id": "inv-123",
            "paymentHash": "0xabc",
            "invoiceAddress": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "createdAt": "2026-07-04T12:00:00Z",
        }
        inv = Invoice.from_dict(data)
        assert inv.payment_hash == "0xabc"
        assert inv.invoice_address == "fibt1..."
        assert inv.created_at == "2026-07-04T12:00:00Z"


class TestWebhookSignature:
    def test_verify_webhook_signature(self):
        payload = '{"id":"evt_1"}'
        secret = "whsec_test"
        signature = "030fa3b2413d1993c551364bd53bb9b3edb5c0c34d55dba6ada6041245632811"

        assert verify_webhook_signature(payload, signature, secret)
        assert not verify_webhook_signature(payload, "bad-signature", secret)


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

    def test_me_returns_auth_context(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "merchantId": "merchant-1",
            "role": "owner",
            "permissions": ["read", "manage_keys"],
            "users": [],
        })

        result = client.me()

        mock_httpx.get.assert_called_once_with("/auth/me")
        assert result["role"] == "owner"

    def test_rotate_api_key(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "merchantId": "merchant-1",
            "apiKey": "fm_sk_rotated",
            "role": "owner",
            "rotatedAt": "2026-07-08T12:00:00Z",
        })

        result = client.rotate_api_key()

        mock_httpx.post.assert_called_once_with("/auth/api-key/rotate")
        assert result["apiKey"] == "fm_sk_rotated"


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
            webhook_url="https://example.com/invoice-hook",
            allow_mpp=True,
        )

        _, kwargs = mock_httpx.post.call_args
        assert kwargs["json"]["metadata"] == {"order_id": "ORD-001"}
        assert kwargs["json"]["expiry"] == 3600
        assert kwargs["json"]["webhookUrl"] == "https://example.com/invoice-hook"
        assert kwargs["json"]["allowMpp"] is True

    def test_create_with_idempotency_key(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "id": "inv-123",
            "payment_hash": "0xabc",
            "invoice_address": "fibt1...",
            "amount": "5000",
            "currency": "CKB",
            "status": "pending",
        })

        client.invoices.create(
            amount="5000",
            currency="CKB",
            idempotency_key="order-123",
        )

        mock_httpx.post.assert_called_once_with(
            "/invoices",
            json={"amount": "5000", "currency": "CKB"},
            headers={"Idempotency-Key": "order-123"},
        )

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

        invoices = client.invoices.list(status="paid", limit=10, cursor="next")

        mock_httpx.get.assert_called_once_with("/invoices", params={"limit": 10, "status": "paid", "cursor": "next"})
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

    def test_get_returns_webhook(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "id": "wh-123",
            "url": "https://example.com/hook",
            "events": ["invoice.paid"],
            "secret": "whsec_abc",
            "active": True,
        })

        webhook = client.webhooks.get("wh-123")

        mock_httpx.get.assert_called_once_with("/webhooks/wh-123")
        assert webhook.id == "wh-123"

    def test_update_returns_webhook(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.patch.return_value = mock_response({
            "id": "wh-123",
            "url": "https://example.com/hook",
            "events": ["invoice.paid"],
            "secret": "whsec_abc",
            "active": False,
        })

        webhook = client.webhooks.update("wh-123", active=False, description="Paused")

        mock_httpx.patch.assert_called_once_with(
            "/webhooks/wh-123",
            json={"description": "Paused", "active": False},
        )
        assert webhook.active is False

    def test_delete_calls_delete(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.delete.return_value = mock_response(None, status=204)

        client.webhooks.delete("wh-123")

        mock_httpx.delete.assert_called_once_with("/webhooks/wh-123")

    def test_get_deliveries_returns_delivery_logs(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response([
            {
                "id": "del-1",
                "webhookId": "wh-123",
                "event": "invoice.paid",
                "url": "https://example.com/hook",
                "status": 200,
                "success": True,
                "attempts": 1,
                "payload": {"id": "inv-1"},
                "deliveredAt": "2026-07-04T12:00:00Z",
            },
        ])

        deliveries = client.webhooks.get_deliveries("wh-123")

        mock_httpx.get.assert_called_once_with("/webhooks/wh-123/deliveries")
        assert isinstance(deliveries[0], WebhookDelivery)
        assert deliveries[0].webhook_id == "wh-123"
        assert deliveries[0].success is True

    def test_retry_delivery_calls_post(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "message": "Delivery retry queued",
            "delivery": {
                "id": "del-retry",
                "webhookId": "wh-123",
                "event": "invoice.paid",
                "url": "https://example.com/hook",
                "status": 0,
                "success": False,
                "attempts": 0,
                "payload": {"id": "inv-1"},
                "deliveredAt": "2026-07-04T12:05:00Z",
            },
        })

        result = client.webhooks.retry_delivery("wh-123", "del-1")

        mock_httpx.post.assert_called_once_with("/webhooks/wh-123/deliveries/del-1/retry")
        assert result["delivery"]["id"] == "del-retry"

    def test_test_calls_post(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({"message": "Test event sent", "webhookId": "wh-123"}, status=200)

        result = client.webhooks.test("wh-123")

        mock_httpx.post.assert_called_once_with("/webhooks/wh-123/test")
        assert result["webhookId"] == "wh-123"

    def test_get_delivery_worker_status(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "enabled": True,
            "active": True,
            "running": False,
            "intervalMs": 5000,
            "batchSize": 25,
            "maxRetries": 5,
        })

        result = client.webhooks.get_delivery_worker_status()

        mock_httpx.get.assert_called_once_with("/webhooks/delivery-worker/status")
        assert result["maxRetries"] == 5

    def test_run_delivery_worker(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.post.return_value = mock_response({
            "trigger": "manual",
            "summary": {
                "checked": 1,
                "delivered": 1,
                "rescheduled": 0,
                "failed": 0,
                "skipped": 0,
                "errors": 0,
            },
        })

        result = client.webhooks.run_delivery_worker(limit=1)

        mock_httpx.post.assert_called_once_with(
            "/webhooks/delivery-worker/run",
            json={"limit": 1},
        )
        assert result["summary"]["delivered"] == 1


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

        txs = client.transactions.list(direction="incoming", status="Succeeded", cursor="next")

        mock_httpx.get.assert_called_once_with(
            "/transactions",
            params={"limit": 50, "direction": "incoming", "status": "Succeeded", "cursor": "next"},
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

    def test_get_returns_transaction(self, mock_client, mock_response):
        client, mock_httpx = mock_client
        mock_httpx.get.return_value = mock_response({
            "id": "tx-1",
            "paymentHash": "0xa",
            "invoiceId": "inv-1",
            "direction": "incoming",
            "amount": "100",
            "currency": "CKB",
            "fee": "0",
            "status": "Succeeded",
        })

        tx = client.transactions.get("tx-1")

        mock_httpx.get.assert_called_once_with("/transactions/tx-1")
        assert tx.invoice_id == "inv-1"
        assert tx.status == "Succeeded"


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
            "totalInvoices": 100,
            "paidInvoices": 75,
            "totalVolume": "500000",
            "successRate": 75.0,
            "activeChannels": 2,
            "channelBalances": {"local": "500000", "remote": "500000"},
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
