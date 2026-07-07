/**
 * Webhook Management Routes
 *
 * POST   /api/v1/webhooks              — Register a webhook
 * GET    /api/v1/webhooks               — List webhooks
 * GET    /api/v1/webhooks/:id           — Get webhook details
 * PATCH  /api/v1/webhooks/:id           — Update webhook
 * DELETE /api/v1/webhooks/:id           — Delete webhook
 * GET    /api/v1/webhooks/:id/deliveries — Get delivery logs
 * POST   /api/v1/webhooks/:id/test      — Send test event
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as db from '../db';
import { dispatchWebhookEvent } from '../services/webhook-delivery';
import crypto from 'crypto';
import { toCamelCase } from '../lib/utils';
import { z } from 'zod';
import { registerWebhookSchema, updateWebhookSchema } from '../validation';

const router = Router();

// ── Register Webhook ──────────────────────────────────────────

router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = registerWebhookSchema.parse(req.body);
    const { url, events, description } = parsed;

    // Generate a unique webhook secret for HMAC signing
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

    const webhook = db.createWebhook({
      id: crypto.randomUUID(),
      url,
      events,
      secret,
      description,
      merchantId: req.merchantId,
    });

    res.status(201).json(toCamelCase(webhook));
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── List Webhooks ─────────────────────────────────────────────

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhooks = db.listWebhooks(req.merchantId);
    res.json(webhooks.map(toCamelCase));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Get Webhook ───────────────────────────────────────────────

router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhook = db.getWebhook(req.params.id);
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json(toCamelCase(webhook));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Update Webhook ────────────────────────────────────────────

router.patch('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateWebhookSchema.parse(req.body);
    const webhook = db.updateWebhook(req.params.id, { ...parsed });
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json(toCamelCase(webhook));
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Delete Webhook ────────────────────────────────────────────

router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    db.deleteWebhook(req.params.id);
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Get Delivery Logs ─────────────────────────────────────────

router.get('/:id/deliveries', (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveries = db.getDeliveries(req.params.id);
    res.json(deliveries);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Test Webhook ──────────────────────────────────────────────

router.post('/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhook = db.getWebhook(req.params.id);
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    await dispatchWebhookEvent('invoice.paid', {
      id: 'test-event',
      amount: '1000',
      currency: 'CKB',
      status: 'paid',
      paidAt: new Date().toISOString(),
      _test: true,
    });

    res.json({ message: 'Test event sent', webhookId: req.params.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as webhookRouter };
