# Judge Review Guide

This file is the fastest way to evaluate Fiber Merchant Kit as a hackathon submission.

## One Sentence

Fiber Merchant Kit is merchant payment infrastructure for the Fiber Network: it turns low-level Fiber node RPC into a Stripe-style API, SDKs, webhooks, dashboard, and checkout demo.

## What To Review First

| Time | Action | Evidence |
|---|---|---|
| 2 minutes | Read this file | Product scope and judging path |
| 5 minutes | Open [docs/architecture.md](docs/architecture.md) | System boundaries, data flows, tradeoffs |
| 10 minutes | Inspect the API and webhook core | `packages/api-server/src/routes/invoices.ts`, `packages/api-server/src/services/webhook-delivery.ts` |
| 15 minutes | Run the project | API, dashboard, and demo store working together |
| 20 minutes | Inspect SDKs and dashboard | Developer integration plus merchant operation workflow |
| API contract | Open [docs/openapi.json](docs/openapi.json) | OpenAPI 3.0 contract for all public and authenticated endpoints |
| Evidence | Open [docs/demo-evidence.md](docs/demo-evidence.md) | Paid demo checkout transaction ID and invoice proof |
| Optional | Read/run [docs/testnet-smoke.md](docs/testnet-smoke.md) | Confirms real Fiber testnet RPC readiness and records a funded live settlement |
| Production | Open [docs/deployment.md](docs/deployment.md) | Docker, failover, and PostgreSQL production path |

## Why This Project Exists

Fiber Network payments are powerful, but raw node RPC is not enough for merchant adoption. Merchants need:

- A stable API to create invoices and check payment status.
- Persistent transaction and invoice records.
- Webhooks for order fulfillment.
- Retry, delivery logs, and replay controls for operational reliability.
- A dashboard to see what is happening.
- SDKs for common app stacks.

This repo implements those pieces as one coherent kit.

## Architecture Snapshot

```mermaid
flowchart LR
  SDKs["TypeScript/Python SDKs"] --> API["Merchant API Server"]
  Dashboard["Admin Dashboard"] --> API
  Store["Demo Store"] --> API
  API --> DB[("SQLite")]
  API --> Fiber["Fiber Node RPC / Demo Mode"]
  API --> Hooks["Webhook Endpoints"]
```

The API server is the trust boundary. It owns Fiber RPC credentials, persistence, invoice state transitions, and webhook delivery. Clients only use authenticated HTTP.

Full technical architecture: [docs/architecture.md](docs/architecture.md)

## How To Run

```bash
npm install
npm run dev
```

Or:

```bash
# macOS / Linux
./start.sh

# Windows PowerShell
.\start.ps1
```

Services:

| Service | URL | What To Check |
|---|---|---|
| API Server | http://localhost:3001 | Prints demo API key, opens a server index, exposes `/api/v1` |
| Admin Dashboard | http://localhost:5173 | Paste API key and inspect merchant workflows |
| Demo Store | http://localhost:5174 | Add items and run checkout without a shopper-facing API key |

Demo mode does not require a real Fiber node.

For a real Fiber testnet check, provide `FIBER_NODE_RPC_URL` and run:

```bash
npm run testnet:smoke
```

The read-only smoke verifies `node_info` and `list_channels`. Set `FIBER_TESTNET_CREATE_INVOICE=true` only when you want the smoke to create a testnet invoice through `new_invoice`.

The same evidence file also includes a funded live testnet settlement completed on July 7, 2026: three committed funding transactions, two `ChannelReady` public channels for the successful route, and a 1 CKB `Fibt` payment with status `Success`.

## Suggested Demo Script

1. Start the repo and copy the printed `fm_sk_...` API key for the dashboard.
2. Open http://localhost:3001 and confirm the server index, API discovery link, and health link are available.
3. Open the admin dashboard.
4. Create an invoice.
5. Open invoice detail and watch status update through polling.
6. Open the Network page and inspect Fiber node, channel, and settlement worker status.
7. Click Run Settlement and confirm the activity summary updates.
8. Register a webhook endpoint.
9. Send a webhook test event, inspect delivery health, expand the payload, and retry a failed delivery if one is present.
10. Open the demo store and complete a checkout flow without entering a merchant key.
11. Return to dashboard and inspect invoices, transactions, and balances.

In demo mode, the store exposes a payment simulation action so judges can complete the checkout deterministically without running a real Fiber wallet.

## Implementation Evidence

| Capability | Files |
|---|---|
| API key auth | `packages/api-server/src/middleware/auth.ts` |
| Request validation | `packages/api-server/src/validation.ts` |
| Invoice lifecycle | `packages/api-server/src/services/invoice-settlement.ts`, `packages/api-server/src/routes/invoices.ts` |
| Background settlement worker | `packages/api-server/src/services/settlement-worker.ts` |
| Fiber network status API | `packages/api-server/src/services/fiber-status.ts`, `packages/api-server/src/routes/merchant.ts` |
| Idempotent DB transitions | `packages/api-server/src/db/index.ts` |
| Fiber RPC wrapper and demo mode | `packages/api-server/src/services/fiber-client.ts` |
| Fiber RPC failover and endpoint status | `packages/api-server/src/lib/fiber-client.ts`, `packages/api-server/src/services/fiber-status.ts` |
| Shopper-safe demo checkout | `packages/api-server/src/routes/demo-store.ts`, `packages/api-server/src/services/invoice-creation.ts`, `packages/demo-store/src/App.tsx` |
| Webhook outbox/retry/signing/logs/replay | `packages/api-server/src/services/webhook-delivery.ts`, `packages/api-server/src/db/index.ts`, `packages/admin-dashboard/src/pages/WebhooksPage.tsx` |
| Webhook API and delivery log response | `packages/api-server/src/routes/webhooks.ts` |
| Auth context, roles, and key rotation | `packages/api-server/src/middleware/auth.ts`, `packages/api-server/src/routes/merchant.ts` |
| Docker and PostgreSQL production path | `Dockerfile`, `docker-compose.yml`, `.env.production.example`, `docs/postgres-schema.sql`, GitHub Actions container build |
| OpenAPI contract | `docs/openapi.json` |
| Dashboard workflows | `packages/admin-dashboard/src/pages` |
| Demo checkout | `packages/demo-store/src/App.tsx` |
| TypeScript SDK | `packages/sdk-typescript/src/client.ts` |
| Python SDK | `packages/sdk-python/src/fiber_merchant/client.py` |

## What Is Particularly Worth Noticing

| Area | Why It Matters |
|---|---|
| Merchant-scoped queries | Prevents one API key from reading another merchant's invoices/webhooks |
| Idempotency keys | Duplicate checkout submissions replay the first invoice instead of creating double payment requests |
| Idempotent payment transition | Repeated invoice polling does not create duplicate successful transactions |
| Durable webhook outbox | Failed events keep `nextAttemptAt` retry state in SQLite instead of disappearing in process memory |
| Webhook queue operations | Dashboard and API expose worker status, queued/rescheduled state, and one-click queue runs |
| Webhook delivery shape | API returns clean camelCase delivery logs instead of raw DB rows |
| Fiber failover status | Multiple configured FNN endpoints are checked and reported without exposing credentials |
| RBAC foundation | API keys carry roles and can expose permission context for future merchant teams |
| Retry semantics | Non-2xx responses and network errors are both retried |
| Manual replay | Failed delivery payloads can be re-queued without mutating the original log |
| SDK base URL normalization | Users can pass either server root or `/api/v1` safely |
| Demo mode | Judges can evaluate product behavior without external blockchain setup |

## Test And Verification Commands

```bash
npm run demo:smoke
npm run test --workspaces --if-present
npm run lint --workspaces --if-present
npm run build --workspaces
docker compose --profile postgres config
docker build --target api -t fiber-merchant-kit-api:local .
```

During development, the project was verified with:

- API route, validation, utility, and environment tests.
- TypeScript SDK tests.
- TypeScript checks across API, SDK, dashboard, and demo store.
- Local demo smoke command, also run in GitHub Actions, covering public discovery, invoice creation, signed webhooks, demo payment simulation, transactions, stats, and settlement sweep.
- Python SDK smoke test in this environment.
- Real sql.js database smoke test for invoice transition behavior.
- Live demo checkout: invoice `ebbd43bf-6b04-4248-a670-b9476f0bd92d` paid and transaction `987865e5-6d8c-47df-9d8c-ea906598a3b8` promoted to `Succeeded`.
- Fiber testnet smoke against FNN `v0.8.1`: `node_info`, `list_channels`, optional `new_invoice`, graph sync, and Merchant API live-mode invoice creation passed.
- Live demo store against FNN testnet: keyless checkout invoice `db6529e2-efe0-4451-84d5-7a4746585688` created with payment hash `263221c4e16d2e005ed0b3a7dbabf38c85cf7f3df0f5b9856b203d633f64f52b` and remained `pending` as expected on an unfunded disposable node.
- Funded Fiber testnet settlement: payment hash `0xe28512a5139dcd8ce648d6ab8e2a6924f4ce1f64d1ce52a45212689dca859864` reached `Success` for a 1 CKB `Fibt` payment routed through public node1.
- GitHub Actions container validation: production Compose config with the PostgreSQL profile plus the API Docker image build.

## Senior Engineering Notes

This is not just a UI demo. The system is structured around payment infrastructure concerns:

- Trust boundary: Fiber credentials stay server-side.
- Reliability: webhooks retry, record delivery attempts, and support manual replay.
- Operability: webhook queues and Fiber endpoint health are visible from API/dashboard surfaces.
- Consistency: invoice status transitions are idempotent.
- Operability: dashboard exposes invoices, transactions, balances, network status, and webhook logs.
- Integration: SDKs are first-class, not an afterthought.
- Judge accessibility: demo mode removes external setup from the evaluation path.

## Production Path

The current architecture is intentionally hackathon-friendly and production-shaped.

| Current Choice | Production Evolution |
|---|---|
| sql.js SQLite | PostgreSQL schema and adapter deployment path |
| SQLite webhook outbox with in-process worker | External queue workers and scheduling for multi-instance deployments |
| Role-bearing API key auth | Merchant users, teams, richer RBAC, and audit logs |
| In-process settlement worker | Durable queue worker for multi-instance deployments |
| Demo mode | Real Fiber node deployment |
| Testnet smoke plus funded settlement evidence | Repeatable production monitoring against funded channels and multi-node failover |

## Useful Links

- [README](README.md)
- [Architecture](docs/architecture.md)
- [Getting Started](docs/getting-started.md)
- [Deployment Notes](docs/deployment.md)
- [Demo Evidence](docs/demo-evidence.md)
- [Fiber Testnet Smoke](docs/testnet-smoke.md)
- [API Reference](docs/api-reference.md)
- [OpenAPI Contract](docs/openapi.json)
- [Hackathon Submission](hackathon-submission.md)
