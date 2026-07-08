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
- Restrict `CORS_ORIGIN` to the dashboard origin.
- Store `.env.production` in your secret manager, not in Git.
- Keep the webhook delivery worker enabled.
- Use `FIBER_NODE_RPC_URLS` for failover when more than one Fiber node is available.
