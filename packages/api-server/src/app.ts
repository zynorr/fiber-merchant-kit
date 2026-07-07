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
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authMiddleware } from './middleware/auth';
import { invoiceRouter } from './routes/invoices';
import { webhookRouter } from './routes/webhooks';
import { merchantRouter } from './routes/merchant';

export function createApp() {
  const app = express();

  // ── Global Middleware ────────────────────────────────────────

  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(morgan('short'));
  app.use(express.json());

  // ── Public Routes ────────────────────────────────────────────

  // Health check (no auth required)
  app.get('/api/v1/health', async (_req, res) => {
    const { FiberNodeClient } = await import('./services/fiber-client');
    const fiber = new FiberNodeClient({
      rpcUrl: process.env.FIBER_NODE_RPC_URL || 'demo',
    });
    try {
      const nodeInfo = await fiber.getNodeInfo();
      res.json({ status: 'ok', version: '1.0.0', fiberNode: nodeInfo });
    } catch {
      res.json({ status: 'degraded', version: '1.0.0', fiberNode: 'unreachable' });
    }
  });

  // ── Auth-Protected Routes ────────────────────────────────────

  app.use('/api/v1/invoices', authMiddleware, invoiceRouter);
  app.use('/api/v1/webhooks', authMiddleware, webhookRouter);
  app.use('/api/v1', authMiddleware, merchantRouter);

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
