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

This proves the Merchant Kit live RPC adapter can talk to a real FNN testnet node and create invoices. It is a low-risk readiness check, not a funded settlement test. The funded settlement evidence below records the full live payment path.

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

This verifies the end-to-end path from Merchant API route to real FNN testnet RPC.

## Live Demo Store Against FNN Result

On July 8, 2026, the demo store was redeployed against a disposable local FNN `v0.8.1` testnet node using the official Windows release archive and bundled `config/testnet/config.yml`.

Observed result:

| Check | Result |
|---|---|
| FNN startup | Passed, RPC listening on `http://127.0.0.1:8227` and P2P on `8228` |
| FNN peer connection | Passed, connected to 1 bootnode peer |
| Direct `testnet:smoke` | Passed `node_info`, `list_channels`, and optional `new_invoice` |
| Direct smoke invoice | Passed, created amount `1000` invoice with payment hash `181c9cef30dbd9d870e721dc421c9ecd84fb7dde373cf29515e554bac5f82b5a` |
| Merchant API live mode | Passed, `GET /api/v1/health` returned `ok` with Fiber version `0.8.1` |
| Merchant API invoice | Passed, created invoice `e621eed9-5a8c-4d7f-a847-c19180b8ccc7` with payment hash `84c84bf23f60f0c049c1354ba8a918186691c1907136da89647ca4fb614d2c61` |
| Demo store mode badge | Passed, displayed `Live node` |
| Demo store checkout | Passed, created invoice `903492a3-27cc-4927-b19d-2f19496c3c6b` for `Cyber Widget x1` |
| Demo checkout payment hash | `a60c8807ea5d69425fcd36878261fdb6df7287d770946166ec4eb3a4180893f8` |
| Demo checkout status | `pending`, expected because the disposable node had 0 channels and no funded payer |
| Settlement worker | Passed, live worker checked open invoices with 0 errors |

This proves the browser demo can run against a real FNN testnet RPC endpoint and create FNN-backed checkout invoices. It is not a funded payment proof; the funded settlement evidence below remains the payment-completion proof.

## Funded Live Settlement Result

On July 7, 2026, a disposable two-node Fiber testnet setup completed a funded off-chain payment through public Fiber infrastructure.

### Test Topology

| Node | Role | Pubkey |
|---|---|---|
| Node A | Sender | `0312ee9ebfbad59a15d609f024083670e2b48fb5ad840e4b3931fc62bdd1db4d60` |
| Node B | Receiver | `02b7cbbd482b18548ccd137ec6b9b1f0ac31f6ca028cc786ff13ce7034ac8581a8` |
| Public node1 | Relay, `fiber-testnet-public-bottle` | `02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71` |
| Public node2 | Tested relay, `fiber-testnet-public-bracer` | `0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc` |

The originally documented nodeA -> node1 -> node2 -> nodeB route could not complete because the live graph did not expose an enabled CKB bridge between public node1 and public node2 at test time. The successful route used nodeA -> public node1 -> nodeB.

### Faucet Funding

| Node | Faucet Event | Faucet Funding Tx |
|---|---|---|
| Node A | `704045` | `0x8c29d911ec730363dd653a1ea1ef52f5589b4b57bf5444cfc0ad4511f2a882bd` |
| Node B | `704046` | `0xcf7187de28631a792d92576455c6dbeef9ccfa1750282e6e50b5152efdeb0c05` |

### Channel Evidence

| Channel | Status | Funding Tx / Outpoint | Notes |
|---|---|---|---|
| Node A <-> public node1 | `ChannelReady` | `0x7b259a4fae560207d588c3adb37c965856688df6a334e0f6baaa998a0ff14f5100000000` | Initial local balance `0x9502f9000`, remote `0x38407b700` |
| Node B <-> public node2 | `ChannelReady` | `0xded9d30c60ddee74db8ef18fc2cdf4f583b310c5257b3d189c41a296f5029b9f00000000` | Funded successfully, but not used for final payment because node1-node2 bridge was unavailable |
| Node B <-> public node1 | `ChannelReady` | `0xb668281ec596989434578adbeadab8e049efaed55de5979a3392300b420a91b700000000` | Used for final successful payment |

Confirmed committed funding transaction hashes:

- Node A channel: `0x7b259a4fae560207d588c3adb37c965856688df6a334e0f6baaa998a0ff14f51`
- Node B to node2 channel: `0xded9d30c60ddee74db8ef18fc2cdf4f583b310c5257b3d189c41a296f5029b9f`
- Node B to node1 channel: `0xb668281ec596989434578adbeadab8e049efaed55de5979a3392300b420a91b7`

### Payment Evidence

| Field | Value |
|---|---|
| Route | Node A -> public node1 -> Node B |
| Currency | `Fibt` |
| Amount | `0x5f5e100` (1 CKB, 100,000,000 shannons) |
| Payment hash | `0xe28512a5139dcd8ce648d6ab8e2a6924f4ce1f64d1ce52a45212689dca859864` |
| Payment status | `Success` |
| Fee | `0x186a0` (100,000 shannons) |
| Sender final local balance | `0x94a382860` |
| Receiver final local balance | `0x956257100` |

The sender balance moved from `0x9502f9000` to `0x94a382860`, which equals the 1 CKB payment plus the `0x186a0` relay fee. The receiver balance moved from `0x9502f9000` to `0x956257100`, which equals a 1 CKB receipt.

This proves real funded Fiber testnet settlement with live public relay infrastructure, beyond the local demo payment simulation and beyond read-only RPC smoke checks.
