/**
 * Fiber Merchant Kit -- Server Entry Point
 *
 * Environment variables:
 *   PORT              -- HTTP port (default: 3001)
 *   FIBER_NODE_RPC_URL -- Fiber node RPC endpoint (set to 'demo' for demo mode)
 *   FIBER_NODE_RPC_AUTH_TOKEN -- Fiber RPC bearer auth token (optional)
 *   FIBER_NODE_RPC_USER -- RPC basic auth user (optional)
 *   FIBER_NODE_RPC_PASSWORD -- RPC basic auth password (optional)
 *   FIBER_NODE_CURRENCY -- Fiber invoice currency: Fibt/Fibb/Fibd (optional)
 *   CORS_ORIGIN       -- Allowed CORS origin (default: *)
 *   FIBER_MERCHANT_DB_PATH -- SQLite database path
 */

import { createApp } from './app';
import { initDatabase, closeDb, seedDemoMerchant } from './db';
import { validateEnv, formatWarnings } from './env';
import { startSettlementWorker, stopSettlementWorker } from './services/settlement-worker';
import { startWebhookDeliveryWorker, stopWebhookDeliveryWorker } from './services/webhook-delivery';

function getServerMode(rpcUrl?: string): string {
  return rpcUrl && rpcUrl !== 'demo' ? 'Live (Fiber Node)' : 'Demo';
}

async function main() {
  // -- Validate environment variables ---------------------------
  const { env, warnings } = validateEnv();

  if (warnings.length > 0) {
    console.log(formatWarnings(warnings));
  }

  // Fail fast on configuration errors
  const errors = warnings.filter((w) => w.severity === 'error');
  if (errors.length > 0) {
    console.error('  Fatal: Fix the above configuration errors and restart the server.');
    process.exit(1);
  }

  // -- Initialise database (loads sql.js WASM + schema) ----------
  console.log('  Initialising database...');
  await initDatabase();
  console.log('  Database ready.');

  // -- Seed demo merchant ----------------------------------------
  if (env.NODE_ENV !== 'production') {
    const demo = seedDemoMerchant();
    console.log(`  Demo Merchant API Key: ${demo.apiKey}`);
  }

  // -- Create and start HTTP server ------------------------------
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    const mode = getServerMode(env.FIBER_NODE_RPC_URL);
    console.log(`
  +----------------------------------------------+
  |      Fiber Merchant Kit -- API Server         |
  |  Server:   http://localhost:${env.PORT}              |
  |  API:      http://localhost:${env.PORT}/api/v1       |
  |  Mode:     ${mode}         |
  +----------------------------------------------+
    `);
    startSettlementWorker();
    startWebhookDeliveryWorker();
  });

  // -- Graceful Shutdown -----------------------------------------

  function shutdown(signal: string) {
    console.log(`\n  Received ${signal}. Shutting down gracefully...`);
    stopSettlementWorker();
    stopWebhookDeliveryWorker();
    server.close(() => {
      closeDb();
      console.log('  Server shut down. Database saved and closed.');
      process.exit(0);
    });

    // Force exit after 5 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('  Forced shutdown after timeout.');
      process.exit(1);
    }, 5_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
    // Use exit code 1 for uncaught errors to signal failure
    stopSettlementWorker();
    stopWebhookDeliveryWorker();
    server.close(() => {
      closeDb();
      process.exit(1);
    });
    setTimeout(() => process.exit(1), 5_000).unref();
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
  });
}

main().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
