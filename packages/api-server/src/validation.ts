/**
 * Request validation schemas using Zod
 *
 * Provides type-safe validation for all POST/PATCH request bodies.
 */

import { z } from 'zod';

// ── Currency type ─────────────────────────────────────────────

export const currencySchema = z.enum(['CKB', 'RUSD']).default('CKB');

// ── UDT Type Script ───────────────────────────────────────────

export const udtTypeScriptSchema = z.object({
  codeHash: z.string().min(1),
  hashType: z.string().min(1),
  args: z.string().min(1),
}).optional();

// ── Create Invoice ────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  amount: z.union([z.string(), z.number()]).refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    { message: 'amount must be a positive number' },
  ),
  currency: currencySchema.optional().default('CKB'),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  expiry: z.number().int().positive().max(86400).optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  allowMpp: z.boolean().optional(),
  udtTypeScript: udtTypeScriptSchema,
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ── Webhook Events ────────────────────────────────────────────

const validEvents = [
  'invoice.created', 'invoice.received', 'invoice.paid',
  'invoice.expired', 'invoice.cancelled', 'invoice.refunded',
  'payment.failed', 'channel.updated',
] as const;

export const webhookEventSchema = z.enum(validEvents);

// ── Register Webhook ──────────────────────────────────────────

export const registerWebhookSchema = z.object({
  url: z.string().url({ message: 'url must be a valid URL (e.g. https://api.mystore.com/webhooks/fiber)' }),
  events: z.array(webhookEventSchema).nonempty({ message: 'events must be a non-empty array' }),
  description: z.string().max(200).optional(),
});

export type RegisterWebhookInput = z.infer<typeof registerWebhookSchema>;

// ── Update Webhook ────────────────────────────────────────────

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(webhookEventSchema).nonempty().optional(),
  description: z.string().max(200).optional(),
  active: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ── Refund Invoice ────────────────────────────────────────────

export const refundInvoiceSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type RefundInvoiceInput = z.infer<typeof refundInvoiceSchema>;

// ── List Query Helpers ────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

export const listInvoicesQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
});

export const listTransactionsQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  direction: z.enum(['incoming', 'outgoing']).optional(),
});

export const revenueQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
});
