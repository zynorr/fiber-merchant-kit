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

In this development environment, the smoke command was verified for the missing-config path. It correctly refuses to run without a real `FIBER_NODE_RPC_URL`. A live testnet pass still requires an actual FNN RPC URL/token from the project operator.
