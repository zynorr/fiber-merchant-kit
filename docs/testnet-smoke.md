# Fiber Testnet Smoke Test

Use this when you want to prove Fiber Merchant Kit can talk to a real Fiber Network Node (FNN) on testnet.

The normal demo flow does not require a node. This smoke path is separate so judges can review the product quickly, then run a real testnet check when an FNN endpoint is available.

## What It Verifies

The smoke command talks directly to the configured FNN JSON-RPC endpoint and checks:

| Check | Fiber RPC Method | Side Effect |
|---|---|---|
| Node reachable | `node_info` | None |
| Channels readable | `list_channels` | None |
| Invoice creation, optional | `new_invoice` | Creates a testnet invoice |

It does not send funds or attempt settlement. The optional invoice step only creates an invoice address/payment request.

## Requirements

1. Start or obtain a Fiber testnet node.
2. Make sure the node RPC endpoint is reachable from the API server environment.
3. If the endpoint is protected, set the Biscuit bearer token. Basic auth is still supported for private/local setups.

Official Fiber docs:

- [Run a Fiber node](https://www.fiber.world/docs/quick-start/run-a-node)
- [Node info RPC](https://www.fiber.world/docs/api-reference/node/info)
- [Basic transfer quick start](https://www.fiber.world/docs/quick-start/basic-transfer)

## Environment

```bash
FIBER_NODE_RPC_URL=http://127.0.0.1:8227
FIBER_NODE_RPC_AUTH_TOKEN=your_biscuit_token
FIBER_NODE_CURRENCY=Fibt
```

Optional basic-auth fallback for a private/local RPC endpoint:

```bash
FIBER_NODE_RPC_USER=ckb
FIBER_NODE_RPC_PASSWORD=your_password
```

Do not commit RPC tokens or node credentials.

## Run The Read-Only Smoke

```bash
npm run testnet:smoke
```

Expected successful output:

```text
Fiber testnet smoke
RPC: http://127.0.0.1:8227/
node_info: ok
list_channels: ok (N channels)
new_invoice: skipped (set FIBER_TESTNET_CREATE_INVOICE=true to create one)
```

## Run The Optional Invoice Smoke

```bash
FIBER_TESTNET_CREATE_INVOICE=true FIBER_TESTNET_AMOUNT=1000 npm run testnet:smoke
```

This creates a small testnet invoice through `new_invoice` and prints the invoice address plus payment hash. It does not mark the Merchant Kit invoice database as paid because this script is intentionally a low-level RPC readiness check.

## Current Local Result

On July 7, 2026, this repo was smoke-tested against a disposable local FNN `v0.8.1` node using the official bundled testnet config.

Result:

| Check | Result |
|---|---|
| Missing config guard | Passed, exits clearly when `FIBER_NODE_RPC_URL` is not set |
| `node_info` | Passed |
| `list_channels` | Passed, returned 0 channels on the fresh node |
| Optional `new_invoice` | Passed, created a testnet invoice for amount `1000` |

This proves the Merchant Kit live RPC adapter can talk to a real FNN testnet node and create invoices. It does not prove payment settlement, because the disposable node had no funded channels. A full settlement test still requires two funded testnet nodes or an existing funded channel.

## Extended Live API Result

On the same date, the API server was started in live mode against the local FNN testnet node:

```bash
PORT=3091
FIBER_NODE_RPC_URL=http://127.0.0.1:8227
FIBER_NODE_CURRENCY=Fibt
FIBER_MERCHANT_DB_PATH=<temp-db>
```

Observed result:

| Check | Result |
|---|---|
| FNN peer connection | Passed, connected to 1 bootnode peer |
| FNN graph sync | Passed, saw 46 graph nodes and 98 graph channels |
| API health | Passed, returned `ok` with Fiber version `0.8.1` |
| `POST /api/v1/invoices` | Passed, created invoice `3d3085d7-e2ac-4162-b1fa-d2c969a196a4` |
| `GET /api/v1/invoices/:id` | Passed, returned cached merchant invoice with status `pending` |
| Adapter `get_invoice` | Passed, fetched the FNN invoice back as `Open` |

This verifies the end-to-end path from Merchant API route to real FNN testnet RPC. Payment settlement remains the next milestone and requires a funded channel.
