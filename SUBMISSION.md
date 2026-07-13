# Fiber Merchant Kit - CKBoost Submission Answers

This file is a paste-ready answer sheet for the Fiber Network Infrastructure Hackathon submission form.

## Quest 2: Share Project Details

### 1. Submission Category

Category 3: Merchant, Liquidity, LSP, and Multi-Asset Infrastructure

### 2. Project Overview

Fiber Merchant Kit is reusable merchant payment infrastructure for Fiber Network. It provides a Stripe-style Merchant API, TypeScript and Python SDKs, signed webhooks with retry/replay logs, an operations dashboard, and a keyless checkout proof flow for accepting and tracking Fiber payments.

The target audience is developers, merchants, wallets, marketplaces, SaaS platforms, games, and payment services that want to integrate Fiber payments without rebuilding invoice lifecycle handling, webhook fulfillment, settlement tracking, dashboard tooling, or direct Fiber node RPC integration from scratch.

### 3. What Problem Does It Solve?

Fiber Network provides fast off-chain payments on CKB, but developers still need reusable infrastructure to integrate it into real merchant and application flows.

Fiber Merchant Kit solves this by providing a merchant payment infrastructure layer around Fiber:

- a stable REST API over Fiber node RPC
- TypeScript and Python SDKs
- invoice lifecycle tracking
- signed webhooks with retry and replay
- transaction and settlement records
- merchant operations dashboard
- testnet smoke tooling for real FNN RPC checks

The project relates directly to Fiber infrastructure because it abstracts low-level FNN RPC into reusable payment primitives that future merchants, wallets, marketplaces, SaaS apps, games, and payment services can build on.

### 4. System Design

Fiber Merchant Kit is designed as reusable infrastructure around Fiber Network payments. The central component is the Merchant API server, which acts as the trust boundary between applications, merchants, SDKs, dashboards, and Fiber node RPC.

Important flows:

1. **Developer SDK integration flow**  
   Developers integrate Fiber payments through the TypeScript or Python SDK instead of calling FNN RPC directly. The SDK talks to the Merchant API to create invoices, fetch invoice status, list transactions, register webhooks, and inspect merchant payment data.

2. **Invoice lifecycle flow**  
   A backend service creates a Fiber invoice through the Merchant API. The API stores invoice metadata, tracks payment state, refreshes settlement status, and keeps lifecycle transitions idempotent so repeated checks do not create duplicate successful transactions.

3. **Fiber RPC abstraction flow**  
   The Merchant API wraps Fiber Network Node JSON-RPC calls for invoice creation, invoice status checks, channel listing, and payment/refund operations. This gives future Fiber developers a stable merchant-facing API instead of exposing raw node RPC to every app.

4. **Webhook fulfillment flow**  
   When invoice events occur, the webhook system sends HMAC-signed events such as `invoice.created` and `invoice.paid`. Failed deliveries are stored, retried, logged, and can be manually replayed, giving merchants reusable fulfillment infrastructure.

5. **Operations and diagnostics flow**  
   Operators use the dashboard and API endpoints to inspect invoices, transactions, balances, webhook delivery logs, Fiber node status, and settlement worker activity. This helps teams debug payment operations and understand Fiber readiness.

6. **Testnet verification flow**  
   Developers can point the infrastructure at a real FNN testnet node using `FIBER_NODE_RPC_URL` and run `npm run testnet:smoke` to verify node connectivity, channel listing, and optional invoice creation. The repo also includes recorded funded testnet settlement evidence.

7. **Demo validation flow**  
   The demo checkout exists only to validate the infrastructure end to end. It proves that the Merchant API, invoice lifecycle, payment status, transaction creation, and dashboard tooling work together, but the core submission is the reusable Fiber payment tooling.

### 5. Setup Environment

Local development environment:

- GitHub repo: `https://github.com/zynorr/fiber-merchant-kit`
- OS used for final testing: Windows with PowerShell
- Node.js used for final testing: `v24.18.0`
- npm used for final testing: `11.16.0`
- Runtime target: Node.js 18+ supported
- Package manager: npm workspaces
- Database: SQLite via `sql.js` for local/demo mode
- Hosted demo: `https://fiber-merchant-kit-zynorr.fly.dev`

Stack:

- Backend: Node.js, Express, TypeScript, Zod validation
- Persistence: SQLite / `sql.js`, with PostgreSQL schema documented for production
- Frontend dashboard: React, Vite, TypeScript, Tailwind CSS
- Demo checkout surface: React, Vite, TypeScript
- SDKs: TypeScript SDK and Python SDK
- Webhooks: HMAC-signed delivery with retries, logs, and replay
- Fiber integration: FNN JSON-RPC wrapper, demo Fiber client, testnet smoke support
- Testing/verification: Vitest, TypeScript checks, demo smoke test, `npm run judge:verify`
- Deployment: Docker, Docker Compose, Fly.io hosted demo

### 6. Tooling

Fiber Merchant Kit uses and provides the following Fiber-related tooling:

- **FNN JSON-RPC integration**: the API server includes a Fiber client wrapper for current Fiber Network Node RPC methods, including invoice creation, invoice status checks, channel listing, and payment/refund calls.
- **Fiber testnet smoke script**: `npm run testnet:smoke` verifies a configured FNN testnet RPC endpoint through `node_info`, `list_channels`, and optional invoice creation.
- **Demo Fiber client**: when no Fiber RPC URL is configured, the project runs in demo mode so judges and developers can test the merchant payment flow without a funded node.
- **Merchant API SDKs**: the repo provides reusable TypeScript and Python SDKs for integrating with the Merchant API instead of calling low-level Fiber RPC directly.
- **OpenAPI contract**: `docs/openapi.json` documents the REST API surface for invoice, webhook, transaction, stats, and Fiber status endpoints.
- **Docker/Fly deployment tooling**: Dockerfile, Docker Compose, Fly.io config, and production env examples are included for hosted or self-hosted deployments.
- **Verification tooling**: `npm run judge:verify` runs the local demo smoke, tests, TypeScript checks, and builds.

### 7. Current Functionality

Fiber Merchant Kit provides reusable merchant payment tooling for Fiber Network. The main focus is not the demo store itself, but the infrastructure layer that future merchants, wallets, apps, and payment services can build on.

1. **Merchant API layer**  
   The project exposes a Stripe-style REST API for Fiber payments. Developers can create invoices, fetch invoice status, list invoices, cancel invoices, issue refunds, view transactions, inspect balances, and query merchant stats. This abstracts low-level Fiber node RPC behind a stable API surface.

2. **Fiber RPC integration layer**  
   The backend includes a Fiber Network Node JSON-RPC wrapper for invoice creation, invoice status checks, channel listing, payment sending, and refund-related payment flows. This lets applications integrate through the Merchant API instead of directly handling FNN RPC details.

3. **SDK tooling**  
   The project ships TypeScript and Python SDKs for backend developers. These SDKs make it easier to integrate Fiber payments into merchant apps, wallets, marketplaces, SaaS platforms, games, and other services without rebuilding API calls manually.

4. **Webhook infrastructure**  
   Fiber Merchant Kit includes HMAC-signed webhooks for payment lifecycle events such as invoice creation and payment completion. Failed webhook deliveries are persisted, retried, logged, and can be manually replayed. This gives merchants reusable fulfillment infrastructure instead of requiring each team to build its own webhook engine.

5. **Invoice lifecycle and settlement tracking**  
   The system persists invoice state and supports lifecycle transitions such as `pending`, `paid`, `cancelled`, `expired`, and `refunded`. Settlement refresh logic is idempotent, so repeated polling or worker checks do not create duplicate successful transactions.

6. **Merchant operations tooling**  
   The dashboard is an operations surface for the infrastructure. It lets teams inspect invoices, transactions, balances, webhook delivery logs, Fiber node status, and settlement worker activity. This is useful for debugging, reconciliation, and payment operations.

7. **Testnet and verification tooling**  
   The repo includes `npm run testnet:smoke` for checking real FNN testnet RPC readiness. It also includes `npm run judge:verify`, which runs the local demo smoke, API tests, SDK tests, TypeScript checks, and builds. The documentation records real FNN testnet smoke and funded settlement evidence.

8. **Deployment and production path**  
   The project includes Docker, Docker Compose, Fly.io deployment config, production environment examples, Fiber RPC failover configuration, and a PostgreSQL schema path. This makes the infrastructure reusable beyond the hackathon demo.

9. **Demo surfaces**  
   FiberStore and the hosted demo are included only to prove the tooling end to end. They show that the infrastructure can support shopper-safe checkout, but the core submission is the Merchant API, SDKs, webhook system, Fiber RPC wrapper, dashboard tooling, and testnet verification path.

Important links:

- GitHub repo: `https://github.com/zynorr/fiber-merchant-kit`
- Hosted demo: `https://fiber-merchant-kit-zynorr.fly.dev`
- Judge guide: `https://github.com/zynorr/fiber-merchant-kit/blob/main/JUDGES.md`
- Video walkthrough: `https://github.com/zynorr/fiber-merchant-kit/blob/main/docs/judge-video.md`
- Demo evidence: `https://github.com/zynorr/fiber-merchant-kit/blob/main/docs/demo-evidence.md`
- Testnet evidence: `https://github.com/zynorr/fiber-merchant-kit/blob/main/docs/testnet-smoke.md`

### 8. Future Functionality

Future functionality beyond the hackathon:

1. **Production database adapter**  
   Add a full PostgreSQL adapter and migration system so merchants can run Fiber Merchant Kit in horizontally scalable production environments.

2. **Multi-asset invoice support**  
   Expand invoice and settlement flows for stablecoins, RGB++ assets, and asset-specific balances, not only CKB-denominated payments.

3. **Liquidity and payment readiness checks**  
   Add "can this payment settle?" tooling that checks channel capacity, inbound/outbound liquidity, asset type, fees, and route confidence before attempting payment.

4. **Advanced Fiber routing diagnostics**  
   Translate low-level Fiber payment failures into actionable merchant/operator messages, including liquidity mismatch, route failure, peer connectivity, fee issues, or asset mismatch.

5. **Accounting and reconciliation exports**  
   Add CSV/JSON exports, settlement reports, refund records, and accounting integrations for merchant finance workflows.

6. **Hosted payment pages**  
   Provide reusable hosted checkout/payment pages that merchants can link to directly while still keeping Fiber credentials server-side.

7. **LSP and liquidity service primitives**  
   Explore liquidity quote APIs, channel funding helpers, liquidity provider discovery, and merchant onboarding flows for receiving capacity.

8. **Webhook marketplace and integrations**  
   Add ready-made integrations for common merchant systems such as commerce platforms, SaaS billing tools, notification systems, and order fulfillment backends.

9. **Stronger production security**  
   Add rate limiting, API key scopes, audit logs, key rotation workflows, multi-user merchant accounts, and role-based access control.

10. **Developer CLI and local test harness**  
    Build a CLI for spinning up local Fiber payment scenarios, replaying invoice states, testing webhook receivers, and validating merchant integrations before production.

11. **Monitoring and alerting**  
    Add alerts for unhealthy Fiber nodes, failed webhook queues, weak liquidity, stuck invoices, settlement delays, and channel readiness issues.

## Quest 3: Project Submission

### 1. Github Link

`https://github.com/zynorr/fiber-merchant-kit`

The repository is fully open source under the MIT license.

### 2. Video Link


`https://github.com/zynorr/fiber-merchant-kit/blob/main/docs/assets/fiber-merchant-kit-project-run-3-minute.mp4`


### 3. Hosted Setup

`https://fiber-merchant-kit-zynorr.fly.dev`

Useful hosted paths:

- Dashboard: `https://fiber-merchant-kit-zynorr.fly.dev/dashboard`
- Demo checkout surface: `https://fiber-merchant-kit-zynorr.fly.dev/store`
- Health check: `https://fiber-merchant-kit-zynorr.fly.dev/api/v1/health`

### 4. Screenshots

Suggested screenshots to submit:

- Dashboard overview
- Invoice list or paid invoice detail
- Webhook delivery logs
- Fiber/network status page
- Checkout invoice/payment proof
- Terminal showing `npm run judge:verify`

Existing screenshot source assets are generated under `dist/judge-demo-video/captures` during the video capture workflow.

