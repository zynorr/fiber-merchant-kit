/**
 * Fiber Merchant Kit -- Server Entry Point
 *
 * Environment variables:
 *   PORT              -- HTTP port (default: 3001)
 *   FIBER_NODE_RPC_URL -- Fiber node RPC endpoint (set to 'demo' for demo mode)
 *   FIBER_NODE_RPC_USER -- RPC user (optional)
 *   FIBER_NODE_RPC_PASSWORD -- RPC password (optional)
 *   CORS_ORIGIN       -- Allowed CORS origin (default: *)
 *   FIBER_MERCHANT_DB_PATH -- SQLite database path
 */

import { createApp } from './app';
import { initDatabase, closeDb, seedDemoMerchant } from './db';

const PORT = process.env.PORT || 3001;

async function main() {
  // -- Initialise database (loads sql.js WASM + schema) ----------
  console.log('  Initialising database...');
  await initDatabase();
  console.log('  Database ready.');

  // -- Seed demo merchant ----------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const demo = seedDemoMerchant();
    console.log(`  Demo Merchant API Key: ${demo.apiKey}`);
  }

  // -- Create and start HTTP server ------------------------------
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`
  +----------------------------------------------+
  |      Fiber Merchant Kit -- API Server         |
  |  Server:   http://localhost:${PORT}              |
  |  API:      http://localhost:${PORT}/api/v1       |
  |  Mode:     ${process.env.FIBER_NODE_RPC_URL ? 'Live (Fiber Node)' : 'Demo'}         |
  +----------------------------------------------+
    `);
  });

  // -- Graceful Shutdown -----------------------------------------

  function shutdown(signal: string) {
    console.log(`\n  Received ${signal}. Shutting down gracefully...`);
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
