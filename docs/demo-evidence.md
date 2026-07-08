# Demo Checkout Evidence

This document records a live local demo checkout run for hackathon review.

## Final Hosted Smoke Before Submission

This run verifies the public Fly.io judge demo immediately before submission. It exercises the hosted API, merchant dashboard, FiberStore checkout, demo payment completion, authenticated dashboard reads, transactions, and stats.

| Field | Value |
|---|---|
| Date | July 8, 2026 |
| Time | `2026-07-08T19:59:05Z` to `2026-07-08T19:59:18Z` |
| Repository head at smoke time | `2d26678` |
| Public URL | `https://fiber-merchant-kit-zynorr.fly.dev` |
| Dashboard | `https://fiber-merchant-kit-zynorr.fly.dev/dashboard` |
| FiberStore | `https://fiber-merchant-kit-zynorr.fly.dev/store` |
| Mode | Demo Fiber client |

| Check | Result |
|---|---|
| Public API health | Passed (`status=ok`, `fiberNode=demo-node`, `channels=2`) |
| Server index links | Passed (`/dashboard` and `/store` present) |
| Public dashboard HTML | Passed |
| Public FiberStore HTML | Passed |
| Hosted dashboard demo key helper | Passed (`HEAD /api/v1/demo-store/demo-key` returned `204`; `GET` returned a valid masked `fm_sk_...` key) |
| Authenticated dashboard stats before checkout | Passed (`totalInvoices=0`, `paidInvoices=0`) |
| Keyless FiberStore checkout via public API | Passed |
| Demo payment simulation via public API | Passed |
| Public invoice polling | `paid` |
| Authenticated dashboard invoice lookup | `paid` |
| Transaction list | Incoming transaction promoted to `Succeeded` |
| Authenticated dashboard stats after checkout | Passed (`totalInvoices=1`, `paidInvoices=1`, `successRate=100`) |

| Field | Value |
|---|---|
| Invoice ID | `36320171-351a-4d20-9b9a-1402d70a3af7` |
| Invoice status | `paid` |
| Amount | `30000` |
| Currency | `CKB` |
| Payment hash | `4c74e6a43a884fcaf505e5622f116db61accec2660d18892b8bd139276786824` |
| Invoice address | `fibtNGM3NGU2YTQzYTg4NGZjYWY1MDVlNTYyMmYxMTZk` |
| Transaction ID | `2501f58f-2c8d-4f4d-ae8d-cafd6bf76c26` |
| Transaction status | `Succeeded` |
| Transaction direction | `incoming` |
| Transaction description | `Demo store order: Cyber Widget x1, Digital Art Pack x1` |

This confirms the hosted judge demo can be opened from a clean browser, the FiberStore shopper path creates an invoice without a merchant API key, the demo payment endpoint marks the invoice paid, and the merchant dashboard/API can observe the paid invoice plus promoted incoming transaction.

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

## Fly.io Hosted Demo Smoke

This run deployed the single-service Docker image to Fly.io, serving the API, merchant dashboard, and FiberStore from one public HTTPS origin.

| Field | Value |
|---|---|
| Date | July 8, 2026 |
| Tested app commit | `857991f` |
| Deployment type | Fly.io single-service Docker deployment |
| Public URL | `https://fiber-merchant-kit-zynorr.fly.dev` |
| Dashboard | `https://fiber-merchant-kit-zynorr.fly.dev/dashboard` |
| FiberStore | `https://fiber-merchant-kit-zynorr.fly.dev/store` |
| Mode | Demo Fiber client |

| Check | Result |
|---|---|
| Public API health | Passed (`GET /api/v1/health`, `status=ok`, `fiberNode=demo-node`) |
| Server index links | Passed (`/dashboard` and `/store`) |
| Public dashboard HTML | Passed |
| Hosted dashboard demo key helper | Passed (`HEAD /api/v1/demo-store/demo-key` returned `204`; `GET` returned a valid `fm_sk_...` demo key) |
| Dashboard helper bundle text | Passed (`Hosted judge demo` and `Use demo key` present in deployed dashboard JS) |
| Authenticated dashboard stats with helper key | Passed (`GET /api/v1/stats`) |
| Public FiberStore HTML | Passed |
| Keyless FiberStore checkout via public API | Passed |
| Demo payment simulation via public API | Passed |
| Public invoice polling | `paid` |
| Authenticated dashboard stats | `totalInvoices=1`, `paidInvoices=1` |

| Field | Value |
|---|---|
| Invoice ID | `603007a1-1039-4582-afab-78a19e18a216` |
| Invoice status | `paid` |
| Amount | `30000` |
| Currency | `CKB` |
| Payment hash | `4f8e03ba184eb6e559665b6af7668db7c1b1da1a21a4dba4e373bac3e512c9fd` |
| Transaction ID | `6d92f823-2162-4c9b-90e2-94e9a3c7e6f3` |
| Transaction status | `Succeeded` |
| Transaction direction | `incoming` |
| Transaction description | `Demo store order: Cyber Widget x1, Digital Art Pack x1` |

This proves the hosted Fly.io deployment can be evaluated from a clean browser with one public URL: judges can open the store, create a checkout invoice without a merchant key, complete the deterministic demo payment, and inspect the resulting paid invoice from the dashboard. The dashboard still authenticates through the normal merchant API routes; only this explicit demo deployment exposes a temporary helper key, and it is disabled when a live Fiber RPC URL is configured.
