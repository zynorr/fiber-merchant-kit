/**
 * Invoice Routes
 *
 * POST   /api/v1/invoices          — Create a new invoice
 * GET    /api/v1/invoices           — List invoices
 * GET    /api/v1/invoices/:id       — Get invoice details
 * POST   /api/v1/invoices/:id/cancel — Cancel an invoice
 * POST   /api/v1/invoices/:id/refund — Refund a paid invoice
 * GET    /api/v1/invoices/:id/qr    — Get QR code data
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { dispatchWebhookEvent } from '../services/webhook-delivery';
import * as db from '../db';
import crypto from 'crypto';
import { toCamelCase, rowsToCamelCase } from '../lib/utils';
import { getFiberClient } from '../lib/fiber-client';
import { z } from 'zod';
import { createInvoiceSchema, listInvoicesQuerySchema, refundInvoiceSchema } from '../validation';
import type { DbInvoice } from '../db/types';

const router = Router();

function emitWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
  merchantId?: string,
): void {
  void Promise.resolve(dispatchWebhookEvent(event, payload, { merchantId })).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Invoices] Failed to dispatch ${event}:`, message);
  });
}

function isDemoSimulationEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
    && (!process.env.FIBER_NODE_RPC_URL || process.env.FIBER_NODE_RPC_URL === 'demo');
}

function markInvoicePaid(invoice: DbInvoice, merchantId?: string): void {
  const changed = db.updateInvoiceStatus(invoice.id, 'paid', merchantId);
  if (!changed) return;

  db.upsertIncomingPaymentTransaction({
    paymentHash: invoice.payment_hash,
    invoiceId: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    description: invoice.description,
    metadata: typeof invoice.metadata === 'string' ? undefined : invoice.metadata,
  });

  emitWebhookEvent('invoice.paid', {
    id: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    status: 'paid',
    paidAt: new Date().toISOString(),
  }, merchantId);
}

// ── Create Invoice ────────────────────────────────────────────

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createInvoiceSchema.parse(req.body);
    const { amount, currency, description, metadata, expiry, webhookUrl, udtTypeScript } = parsed;

    const fiber = getFiberClient();

    // Create invoice on the Fiber node
    const invoiceResult = await fiber.createInvoice({
      amount: String(amount),
      currency: currency || 'CKB',
      description,
      expiry: expiry || 3600,
      udtTypeScript,
      allowMpp: true,
    });

    // Store in local database
    const invoiceId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (expiry || 3600) * 1000).toISOString();

    const invoiceData = {
      id: invoiceId,
      paymentHash: invoiceResult.paymentHash,
      preimage: invoiceResult.preimage,
      invoiceAddress: invoiceResult.invoiceAddress,
      amount: String(amount),
      currency: currency || 'CKB',
      description,
      metadata: metadata as Record<string, string> | undefined,
      expiresAt,
      webhookUrl,
      merchantId: req.merchantId,
    };

    db.createInvoice(invoiceData);

    // Also create a pending transaction
    db.createTransaction({
      id: crypto.randomUUID(),
      paymentHash: invoiceResult.paymentHash,
      invoiceId,
      direction: 'incoming',
      amount: String(amount),
      currency: currency || 'CKB',
      status: 'Pending',
      description,
      metadata: metadata as Record<string, string> | undefined,
    });

    // Fire webhook event asynchronously
    emitWebhookEvent('invoice.created', {
      id: invoiceId,
      amount: String(amount),
      currency: currency || 'CKB',
      status: 'pending',
      invoiceAddress: invoiceResult.invoiceAddress,
      expiresAt,
    }, req.merchantId);

    // Return invoice to merchant (camelCase)
    const invoice = db.getInvoice(invoiceId, req.merchantId);
    res.status(201).json(toCamelCase(invoice!));
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Invoices] Create error:', message);
    res.status(500).json({ error: message });
  }
});

// ── List Invoices ─────────────────────────────────────────────

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit, cursor } = listInvoicesQuerySchema.parse(req.query);
    const result = db.listInvoices({
      status,
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

// ── Get Invoice ───────────────────────────────────────────────

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = db.getInvoice(req.params.id, req.merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Poll Fiber node for latest status on pending invoices
    if (invoice.status === 'pending' || invoice.status === 'received') {
      const fiber = getFiberClient();
      try {
        const nodeStatus = await fiber.getInvoiceStatus(invoice.payment_hash);
        if (nodeStatus.status === 'Paid') {
          markInvoicePaid(invoice, req.merchantId);
        } else if (nodeStatus.status === 'Received' && invoice.status === 'pending') {
          const changed = db.updateInvoiceStatus(invoice.id, 'received', req.merchantId);
          if (changed) {
            emitWebhookEvent('invoice.received', {
              id: invoice.id,
              amount: invoice.amount,
              currency: invoice.currency,
              status: 'received',
            }, req.merchantId);
          }
        } else if (nodeStatus.status === 'Expired' && invoice.status === 'pending') {
          const changed = db.updateInvoiceStatus(invoice.id, 'expired', req.merchantId);
          if (changed) {
            emitWebhookEvent('invoice.expired', {
              id: invoice.id,
              amount: invoice.amount,
              currency: invoice.currency,
              status: 'expired',
            }, req.merchantId);
          }
        }
      } catch {
        // Node unreachable — return cached status
      }

      const latest = db.getInvoice(invoice.id, req.merchantId);
      if (
        latest?.status === 'pending' &&
        new Date(latest.expires_at).getTime() <= Date.now()
      ) {
        const changed = db.updateInvoiceStatus(invoice.id, 'expired', req.merchantId);
        if (changed) {
          emitWebhookEvent('invoice.expired', {
            id: invoice.id,
            paymentHash: invoice.payment_hash,
            amount: invoice.amount,
            currency: invoice.currency,
            status: 'expired',
          }, req.merchantId);
        }
      }
    }

    const updated = db.getInvoice(req.params.id, req.merchantId);
    res.json(toCamelCase(updated!));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Cancel Invoice ────────────────────────────────────────────

router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = db.getInvoice(req.params.id, req.merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    if (invoice.status !== 'pending') {
      res.status(400).json({ error: `Cannot cancel invoice with status: ${invoice.status}` });
      return;
    }

    db.updateInvoiceStatus(invoice.id, 'cancelled', req.merchantId);
    emitWebhookEvent('invoice.cancelled', {
      id: invoice.id,
      status: 'cancelled',
    }, req.merchantId);

    res.json(toCamelCase(db.getInvoice(invoice.id, req.merchantId)!));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Refund Invoice ────────────────────────────────────────────

router.post('/:id/simulate-payment', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isDemoSimulationEnabled()) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const invoice = db.getInvoice(req.params.id, req.merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status !== 'pending' && invoice.status !== 'received') {
      res.status(400).json({ error: `Cannot simulate payment for invoice with status: ${invoice.status}` });
      return;
    }

    markInvoicePaid(invoice, req.merchantId);
    res.json(toCamelCase(db.getInvoice(invoice.id, req.merchantId)!));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/:id/refund', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = refundInvoiceSchema.parse(req.body);
    const invoice = db.getInvoice(req.params.id, req.merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    if (invoice.status !== 'paid') {
      res.status(400).json({ error: `Cannot refund invoice with status: ${invoice.status}` });
      return;
    }

    // Send payment back to the original payer via Fiber node
    const fiber = getFiberClient();
    const refundResult = await fiber.sendPayment({
      invoice: invoice.invoice_address,
      amount: invoice.amount,
    });

    if (refundResult.success) {
      db.updateInvoiceStatus(invoice.id, 'refunded', req.merchantId);
      db.createTransaction({
        id: crypto.randomUUID(),
        paymentHash: refundResult.paymentHash,
        invoiceId: invoice.id,
        direction: 'outgoing',
        amount: invoice.amount,
        currency: invoice.currency,
        fee: refundResult.fee || '0',
        status: 'Succeeded',
        description: parsed.reason || 'Refund',
      });

      emitWebhookEvent('invoice.refunded', {
        id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        status: 'refunded',
        reason: parsed.reason,
      }, req.merchantId);
    } else {
      res.status(500).json({ error: refundResult.error || 'Refund failed' });
      return;
    }

    res.json(toCamelCase(db.getInvoice(invoice.id, req.merchantId)!));
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Get QR Code ───────────────────────────────────────────────

router.get('/:id/qr', (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = db.getInvoice(req.params.id, req.merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // QR data is the Bech32m-encoded invoice address
    res.json({
      invoiceAddress: invoice.invoice_address,
      qrData: invoice.invoice_address,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as invoiceRouter };
