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
import * as db from '../db';
import crypto from 'crypto';
import { toCamelCase, rowsToCamelCase } from '../lib/utils';
import { getFiberClient } from '../lib/fiber-client';
import { z } from 'zod';
import { createInvoiceSchema, listInvoicesQuerySchema, refundInvoiceSchema } from '../validation';
import {
  emitInvoiceWebhookEvent,
  markInvoicePaid,
  refreshInvoiceSettlement,
} from '../services/invoice-settlement';
import { createMerchantInvoice } from '../services/invoice-creation';

const router = Router();
const CREATE_INVOICE_IDEMPOTENCY_ROUTE = '/api/v1/invoices';

function isDemoSimulationEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
    && (!process.env.FIBER_NODE_RPC_URL || process.env.FIBER_NODE_RPC_URL === 'demo');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashRequestBody(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function readIdempotencyKey(req: AuthenticatedRequest): string | undefined {
  const value = req.get('Idempotency-Key');
  if (!value) return undefined;
  return value.trim();
}

function validateIdempotencyKey(key: string): string | undefined {
  if (key.length < 1 || key.length > 255) {
    return 'Idempotency-Key must be between 1 and 255 characters';
  }
  if (!/^[\x21-\x7E]+$/.test(key)) {
    return 'Idempotency-Key must use printable ASCII characters without spaces';
  }
  return undefined;
}

// ── Create Invoice ────────────────────────────────────────────

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  let idempotencyRecordId: string | undefined;
  try {
    const parsed = createInvoiceSchema.parse(req.body);
    const requestHash = hashRequestBody(parsed);
    const idempotencyKey = readIdempotencyKey(req);

    if (idempotencyKey !== undefined) {
      const keyError = validateIdempotencyKey(idempotencyKey);
      if (keyError) {
        res.status(400).json({ error: keyError });
        return;
      }

      const idempotency = db.beginIdempotencyRequest({
        merchantId: req.merchantId!,
        key: idempotencyKey,
        requestHash,
        method: 'POST',
        route: CREATE_INVOICE_IDEMPOTENCY_ROUTE,
      });

      if (!idempotency.created) {
        if (idempotency.record.request_hash !== requestHash) {
          res.status(409).json({ error: 'Idempotency-Key was already used with a different create-invoice request' });
          return;
        }

        if (!idempotency.record.resource_id) {
          res.status(409).json({ error: 'Idempotency-Key is already processing' });
          return;
        }

        const existing = db.getInvoice(idempotency.record.resource_id, req.merchantId);
        if (!existing) {
          res.status(409).json({ error: 'Idempotent invoice result is no longer available' });
          return;
        }

        res.set('Idempotency-Replayed', 'true');
        res.status(idempotency.record.status_code || 200).json(toCamelCase(existing));
        return;
      }

      idempotencyRecordId = idempotency.record.id;
    }

    const invoice = await createMerchantInvoice(parsed, req.merchantId!);
    if (idempotencyRecordId) {
      db.completeIdempotencyRequest(idempotencyRecordId, {
        resourceType: 'invoice',
        resourceId: invoice.id,
        statusCode: 201,
      });
    }
    res.status(201).json(toCamelCase(invoice));
  } catch (err: unknown) {
    if (idempotencyRecordId) {
      try {
        db.deleteIdempotencyRequest(idempotencyRecordId);
      } catch {
        // Keep the original create-invoice error as the response source.
      }
    }
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

    await refreshInvoiceSettlement(invoice, req.merchantId);

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
    emitInvoiceWebhookEvent('invoice.cancelled', {
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

      emitInvoiceWebhookEvent('invoice.refunded', {
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
