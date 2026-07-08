# Deployment Notes

Fiber Merchant Kit defaults to the same SQLite/sql.js runtime used by the local demo so judges can run it without external services.

## API Container

1. Copy `.env.production.example` to `.env.production`.
2. Set `FIBER_NODE_RPC_URL` or `FIBER_NODE_RPC_URLS`.
3. Set Fiber RPC auth with `FIBER_NODE_RPC_AUTH_TOKEN` or basic auth variables.
4. Run:

```bash
docker compose up --build api
```

The API listens on `http://localhost:3001` and stores SQLite data in the `merchant-data` volume.

GitHub Actions validates this deployment path by rendering the Compose file with the PostgreSQL profile and building the production `api` Docker target.

## Hosted Live Testnet Topology

For live testnet review, deploy these pieces as separate surfaces:

| Surface | Deploy as | Required environment |
| --- | --- | --- |
| Merchant API | Docker web service or VPS container | `NODE_ENV=production`, `FIBER_NODE_RPC_URL`, `FIBER_NODE_CURRENCY=Fibt`, `CORS_ORIGIN` |
| Admin dashboard | Static Vite build | `VITE_MERCHANT_API_URL=https://your-api.example` |
| FiberStore | Static Vite build | `VITE_MERCHANT_API_URL=https://your-api.example` |
| Merchant FNN | Private testnet node | RPC reachable from the API, P2P reachable to Fiber testnet |
| Payer FNN/wallet | Separate funded node | Outbound liquidity/channel route to pay invoices |

The API can create real FNN-backed invoices as soon as `FIBER_NODE_RPC_URL` points to a reachable testnet node. Completing a live payment requires a separate payer node with outbound liquidity; a merchant node with `channels.total = 0` can create invoices but cannot pay or settle them.

For split dashboard/store hosting, configure multiple CORS origins:

```env
CORS_ORIGIN=https://dashboard.example.com,https://store.example.com
```

Build the frontends with the deployed API origin:

```bash
VITE_MERCHANT_API_URL=https://api.example.com npm run build -w packages/admin-dashboard
VITE_MERCHANT_API_URL=https://api.example.com npm run build -w packages/demo-store
```

Then run live checks:

```bash
curl https://api.example.com/api/v1/health
curl -H "Authorization: Bearer fm_sk_..." https://api.example.com/api/v1/fiber/status
```

Use FiberStore to create a `fibt...` invoice address, then pay that invoice from the separate funded payer FNN. The Merchant API settlement worker will poll `get_invoice` and move the invoice from `pending`/`received` to `paid` when the node reports settlement.

## Fiber RPC Failover

Use `FIBER_NODE_RPC_URLS` for multiple private FNN endpoints:

```env
FIBER_NODE_RPC_URLS=http://fiber-node-1:8227,http://fiber-node-2:8227
```

The API tries the configured endpoints in order for Fiber RPC calls. The authenticated `GET /api/v1/fiber/status` response reports sanitized endpoint reachability.

## PostgreSQL Path

`docs/postgres-schema.sql` mirrors the application tables for a production PostgreSQL deployment. The hackathon runtime still defaults to SQLite because it keeps the demo self-contained.

Set these when deploying a Postgres-backed adapter:

```env
FIBER_DB_ENGINE=postgres
DATABASE_URL=postgresql://fiber:secret@postgres:5432/fiber_merchant
```

The included Compose file provides a `postgres` profile that initializes this schema:

```bash
docker compose --profile postgres up postgres
```

## Production Checklist

- Use HTTPS in front of the API.
- Restrict `CORS_ORIGIN` to the dashboard and store origins.
- Store `.env.production` in your secret manager, not in Git.
- Keep the webhook delivery worker enabled.
- Use `FIBER_NODE_RPC_URLS` for failover when more than one Fiber node is available.
