# Demo Checkout Evidence

This document records a live local demo checkout run for hackathon review.

## Run Context

| Field | Value |
|---|---|
| Date | July 7, 2026 |
| API | `http://localhost:3001` |
| Dashboard | `http://localhost:5173` |
| Demo Store | `http://localhost:5174` |
| Mode | Demo Fiber client |
| Store action | Added `Cyber Widget` and paid through the demo payment action |

## Verified Flow

| Step | Result |
|---|---|
| Store API key loaded | Passed |
| Store cart checkout | Passed |
| Invoice creation | Passed |
| Demo payment simulation | Passed |
| Invoice status after payment | `paid` |
| Transaction creation | Passed |

## Evidence Transaction

| Field | Value |
|---|---|
| Invoice ID | `ebbd43bf-6b04-4248-a670-b9476f0bd92d` |
| Invoice status | `paid` |
| Amount | `5000` |
| Currency | `CKB` |
| Payment hash | `47e8454134a8090976d6784a721d7c474cfd8ef29f7d6c773e24e26e76c7c37e` |
| Invoice address | `fibtNDdlODQ1NDEzNGE4MDkwOTc2ZDY3ODRhNzIxZDdj` |
| Transaction ID | `987865e5-6d8c-47df-9d8c-ea906598a3b8` |
| Transaction status | `Succeeded` |
| Transaction direction | `incoming` |
| Transaction description | `Demo store order: Cyber Widget x1` |

This proves the local storefront can create a Merchant API invoice, complete a demo payment, mark the invoice paid, and promote the incoming payment transaction to `Succeeded`.

## Temporary Public Tunnel Smoke

This run exposed the API, dashboard, and FiberStore through Cloudflare Quick Tunnel URLs to verify the split-hosting demo from public HTTPS origins. These URLs are temporary and remain valid only while the local tunnel processes are running.

| Field | Value |
|---|---|
| Date | July 8, 2026 |
| Tested app commit | `03b4c68` |
| Deployment type | Temporary Cloudflare Quick Tunnel |
| API | `https://numeric-vocational-ada-amount.trycloudflare.com` |
| Dashboard | `https://reviewed-fabrics-jews-witness.trycloudflare.com` |
| FiberStore | `https://wives-vintage-scholars-tsunami.trycloudflare.com` |
| Mode | Demo Fiber client |

| Check | Result |
|---|---|
| Public API health | Passed (`GET /api/v1/health`) |
| Public dashboard HTML | Passed |
| Public FiberStore HTML | Passed |
| Keyless FiberStore checkout via public API | Passed |
| Demo payment simulation via public API | Passed |
| Dashboard invoice lookup | `paid` |
| Dashboard stats | `totalInvoices=1`, `paidInvoices=1`, `successRate=100` |
| Transaction list | Incoming transaction promoted to `Succeeded` |

| Field | Value |
|---|---|
| Invoice ID | `d6725191-9c1d-49bb-969d-284a4b47398f` |
| Invoice status | `paid` |
| Amount | `30000` |
| Currency | `CKB` |
| Payment hash | `36bceac8729d923bed3b6c720ae6ce42a8921a455cc4bcf0ed3e9f838fb5ef4a` |
| Invoice address | `fibtMzZiY2VhYzg3MjlkOTIzYmVkM2I2YzcyMGFlNmNl` |
| Transaction ID | `e08554e6-3b71-491d-ac10-3d455754d6ca` |
| Transaction status | `Succeeded` |
| Transaction direction | `incoming` |
| Transaction description | `Demo store order: Cyber Widget x1, Digital Art Pack x1` |

This proves the deployed-style split surfaces can be reached from public HTTPS URLs, the store can create a shopper-safe checkout without a merchant API key, and the dashboard/API can observe the paid invoice and successful incoming transaction.
