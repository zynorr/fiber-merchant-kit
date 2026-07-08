/**
 * Fiber Merchant API Server
 *
 * Express application with:
 * - Security headers (helmet)
 * - CORS for dashboard
 * - Request logging
 * - API key authentication on protected routes
 * - All merchant API endpoints
 */

import express from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { authMiddleware } from './middleware/auth';
import { createApiLimiter, createHealthLimiter } from './middleware/rate-limit';
import { invoiceRouter } from './routes/invoices';
import { webhookRouter } from './routes/webhooks';
import { merchantRouter } from './routes/merchant';
import { demoStoreRouter } from './routes/demo-store';
import { getFiberClient } from './lib/fiber-client';

const VERSION = '1.0.0';
const UI_BUILDS = {
  adminDashboard: {
    route: '/dashboard',
    localUrl: 'http://localhost:5173',
    distDir: path.resolve(process.cwd(), 'packages/admin-dashboard/dist'),
  },
  demoStore: {
    route: '/store',
    localUrl: 'http://localhost:5174',
    distDir: path.resolve(process.cwd(), 'packages/demo-store/dist'),
  },
};

function getRuntimeMode() {
  const rpcUrl = process.env.FIBER_NODE_RPC_URL;
  return !rpcUrl || rpcUrl === 'demo' ? 'demo' : 'live';
}

function getCorsOrigin(): CorsOptions['origin'] {
  const configured = process.env.CORS_ORIGIN?.trim();
  if (!configured || configured === '*') return '*';

  const allowed = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowed.length === 1) return allowed[0];

  return (origin, callback) => {
    callback(null, !origin || allowed.includes(origin));
  };
}

function hasStaticBuild(distDir: string): boolean {
  return fs.existsSync(path.join(distDir, 'index.html'));
}

function getUiUrl(ui: (typeof UI_BUILDS)[keyof typeof UI_BUILDS]): string {
  return hasStaticBuild(ui.distDir) ? ui.route : ui.localUrl;
}

function getDiscoveryPayload() {
  const port = process.env.PORT || '3001';
  return {
    name: 'Fiber Merchant Kit',
    version: VERSION,
    mode: getRuntimeMode(),
    description: 'Stripe-style merchant infrastructure for Fiber Network payments.',
    services: {
      api: `http://localhost:${port}/api/v1`,
      health: `http://localhost:${port}/api/v1/health`,
      adminDashboard: getUiUrl(UI_BUILDS.adminDashboard),
      demoStore: getUiUrl(UI_BUILDS.demoStore),
    },
    publicEndpoints: [
      'GET /',
      'GET /api/v1',
      'GET /api/v1/health',
      'GET /api/v1/demo-store/demo-key',
      'POST /api/v1/demo-store/checkout',
      'GET /api/v1/demo-store/invoices/:id',
    ],
    authenticatedResources: [
      'invoices',
      'auth/me',
      'auth/api-key/rotate',
      'webhooks',
      'webhooks/delivery-worker/status',
      'webhooks/delivery-worker/run',
      'transactions',
      'balance',
      'stats',
      'fiber/status',
      'fiber/settlement/run',
    ],
    reviewDocs: [
      'JUDGES.md',
      'README.md',
      'docs/architecture.md',
      'docs/demo-evidence.md',
      'docs/testnet-smoke.md',
      'docs/api-reference.md',
      'docs/openapi.json',
    ],
  };
}

function serveStaticUi(app: express.Express, route: string, distDir: string) {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  app.use(route, express.static(distDir, { index: false }));
  app.get([route, `${route}/*`], (_req, res) => {
    res.sendFile(indexPath);
  });
}

export function createApp() {
  const app = express();

  // ── Global Middleware ────────────────────────────────────────

  app.use(helmet());
  app.use(cors({
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(morgan('short'));
  app.use(express.json());

  // Public discovery routes for judges and integrators.
  app.get('/', (_req, res) => {
    const discovery = getDiscoveryPayload();
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${discovery.name}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    main { max-width: 880px; margin: 0 auto; padding: 48px 20px; }
    h1 { margin: 0 0 8px; font-size: 36px; line-height: 1.1; }
    p { color: #475569; line-height: 1.6; }
    a { color: #0369a1; font-weight: 700; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .panel { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; padding: 20px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc; }
    .label { display: block; margin-bottom: 6px; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; color: #0f172a; }
  </style>
</head>
<body>
  <main>
    <h1>${discovery.name}</h1>
    <p>${discovery.description}</p>
    <div class="panel">
      <div class="grid">
        <div class="item"><span class="label">Mode</span><code>${discovery.mode}</code></div>
        <div class="item"><span class="label">Health</span><a href="/api/v1/health">/api/v1/health</a></div>
        <div class="item"><span class="label">API Discovery</span><a href="/api/v1">/api/v1</a></div>
      </div>
    </div>
    <div class="panel">
      <span class="label">Run With The UI</span>
      <p><a href="${discovery.services.adminDashboard}">Admin Dashboard</a> and <a href="${discovery.services.demoStore}">Demo Store</a> are started by <code>npm run dev</code>.</p>
    </div>
    <div class="panel">
      <span class="label">Judge Fast Path</span>
      <p>Start with <code>JUDGES.md</code>, then inspect <code>docs/architecture.md</code>, <code>docs/demo-evidence.md</code>, and <code>docs/testnet-smoke.md</code> in the repository.</p>
    </div>
  </main>
</body>
</html>`);
  });

  app.get('/api/v1', (_req, res) => {
    res.json(getDiscoveryPayload());
  });

  // ── Rate Limiting ────────────────────────────────────────────
  // Apply rate limiter to all API routes (configurable via env vars)
  if (process.env.DISABLE_RATE_LIMIT !== 'true') {
    app.use('/api/v1', createApiLimiter());
  }

  // ── Public Routes ────────────────────────────────────────────

  // Health check (no auth required, lighter rate limit)
  app.get('/api/v1/health', createHealthLimiter(), async (_req, res) => {
    const fiber = getFiberClient();
    try {
      const nodeInfo = await fiber.getNodeInfo();
      res.json({ status: 'ok', version: VERSION, fiberNode: nodeInfo });
    } catch {
      res.json({ status: 'degraded', version: VERSION, fiberNode: 'unreachable' });
    }
  });

  app.use('/api/v1/demo-store', demoStoreRouter);

  // ── Auth-Protected Routes ────────────────────────────────────

  app.use('/api/v1/invoices', authMiddleware, invoiceRouter);
  app.use('/api/v1/webhooks', authMiddleware, webhookRouter);
  app.use('/api/v1', authMiddleware, merchantRouter);

  // Built Vite apps are served by the API in Docker/Railway deployments.
  serveStaticUi(app, UI_BUILDS.adminDashboard.route, UI_BUILDS.adminDashboard.distDir);
  serveStaticUi(app, UI_BUILDS.demoStore.route, UI_BUILDS.demoStore.distDir);

  // ── 404 Handler ──────────────────────────────────────────────

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Error Handler ────────────────────────────────────────────

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
