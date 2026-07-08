/**
 * Merchant Routes
 *
 * GET    /api/v1/transactions     — List transactions
 * GET    /api/v1/transactions/:id — Get transaction
 * GET    /api/v1/balance/channels — Channel balances
 * GET    /api/v1/balance/total    — Total balance
 * GET    /api/v1/stats            — Dashboard stats
 * GET    /api/v1/stats/revenue    — Revenue history
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../db';
import { toCamelCase, rowsToCamelCase } from '../lib/utils';
import { getFiberClient } from '../lib/fiber-client';
import { z } from 'zod';
import { listTransactionsQuerySchema, revenueQuerySchema } from '../validation';
import { getFiberNetworkStatus } from '../services/fiber-status';
import { runSettlementSweep } from '../services/settlement-worker';

const router = Router();

// ── List Transactions ─────────────────────────────────────────

router.get('/transactions', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, direction, limit, cursor } = listTransactionsQuerySchema.parse(req.query);
    const result = db.listTransactions({
      status,
      direction,
      limit,
      cursor,
      merchantId: req.merchantId,
    });
    res.json({
      ...result,
      items: rowsToCamelCase(result.items),
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Get Transaction ───────────────────────────────────────────

router.get('/transactions/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = db.getTransaction(req.params.id, req.merchantId);
    if (!row) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json(toCamelCase(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Channel Balances ──────────────────────────────────────────

router.get('/balance/channels', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const fiber = getFiberClient();
    const channels = await fiber.listChannels();
    res.json(channels);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Total Balance ─────────────────────────────────────────────

router.get('/balance/total', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const fiber = getFiberClient();
    const channels = await fiber.listChannels();
    let local = BigInt(0);
    let remote = BigInt(0);
    for (const ch of channels) {
      local += BigInt(ch.localBalance);
      remote += BigInt(ch.remoteBalance);
    }
    res.json({
      local: local.toString(),
      remote: remote.toString(),
      total: (local + remote).toString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Fiber Network Status ─────────────────────────────────────────────────

router.get('/fiber/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await getFiberNetworkStatus());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/fiber/settlement/run', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await runSettlementSweep('manual');
    res.status(result.skipped ? 202 : 200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────

router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = db.getMerchantStats(req.merchantId);
    const fiber = getFiberClient();
    let channels;
    try {
      channels = await fiber.listChannels();
    } catch {
      channels = [] as { localBalance: string; remoteBalance: string }[];
    }

    let local = BigInt(0);
    let remote = BigInt(0);
    for (const ch of channels) {
      local += BigInt(ch.localBalance);
      remote += BigInt(ch.remoteBalance);
    }

    res.json({
      ...stats,
      activeChannels: channels.length,
      channelBalances: { local: local.toString(), remote: remote.toString() },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Revenue History ───────────────────────────────────────────

router.get('/stats/revenue', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { days = 30 } = revenueQuerySchema.parse(req.query);
    const history = db.getRevenueHistory(days, req.merchantId);
    res.json(history);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});



export { router as merchantRouter };
