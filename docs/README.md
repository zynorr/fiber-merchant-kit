# Documentation Index

Start here if you are reviewing Fiber Merchant Kit from the `docs/` folder.

## Recommended Judge Path

1. Read [../JUDGES.md](../JUDGES.md) for the problem, solution, demo script, and evidence map.
2. Run the local demo from [getting-started.md](getting-started.md).
3. Skim [architecture.md](architecture.md) to understand trust boundaries, invoice flow, webhook flow, and Fiber RPC integration.
4. Inspect [demo-evidence.md](demo-evidence.md) for a completed local demo checkout.
5. Inspect [testnet-smoke.md](testnet-smoke.md) for real FNN testnet smoke checks and funded settlement evidence.
6. Review [deployment.md](deployment.md) for Docker, failover, PostgreSQL, and production env notes.

## Documentation Map

| Document | Use It For |
|---|---|
| [../JUDGES.md](../JUDGES.md) | Fast hackathon judging path, product thesis, demo script, and evidence |
| [getting-started.md](getting-started.md) | Local runbook, API key rules, demo checkout, verification commands, and live testnet path |
| [architecture.md](architecture.md) | System design, data flows, state model, trust boundary, and tradeoffs |
| [api-reference.md](api-reference.md) | REST endpoint request/response reference |
| [../API.md](../API.md) | One-page API quick sheet |
| [openapi.json](openapi.json) | Machine-readable OpenAPI 3.0 contract |
| [demo-evidence.md](demo-evidence.md) | Completed demo checkout evidence with paid invoice and transaction ID |
| [testnet-smoke.md](testnet-smoke.md) | Real FNN testnet smoke path, live invoice notes, and funded settlement evidence |
| [deployment.md](deployment.md) | Docker, hosted deployment, Fiber RPC failover, and PostgreSQL path |

## Quick Evaluation Notes

| Question | Short Answer |
|---|---|
| Does the shopper need an API key? | No. The demo store uses a public server-side checkout route. |
| Who uses `fm_sk_...`? | The merchant dashboard and backend SDK integrations. |
| Can judges run without a Fiber node? | Yes. Demo mode runs the full merchant workflow locally. |
| Can it touch real FNN testnet? | Yes. Configure `FIBER_NODE_RPC_URL` and follow [testnet-smoke.md](testnet-smoke.md). |
| What does funded settlement require? | A separate funded payer node/channel, not just invoice creation. |
