import { dispatchWebhookEvent } from './webhook-delivery';
import { getFiberClient } from '../lib/fiber-client';
import * as db from '../db';
import type { DbInvoice } from '../db/types';

export type InvoiceSettlementOutcome =
  | 'skipped'
  | 'unchanged'
  | 'received'
  | 'paid'
  | 'expired'
  | 'error';

export interface InvoiceSettlementResult {
  invoiceId: string;
  previousStatus: string;
  status: string;
  outcome: InvoiceSettlementOutcome;
  changed: boolean;
  nodeStatus?: string;
  error?: string;
}

export interface OpenInvoiceSettlementSummary {
  checked: number;
  paid: number;
  received: number;
  expired: number;
  unchanged: number;
  errors: number;
}

function eventMerchantId(invoice: DbInvoice, merchantId?: string): string | undefined {
  return merchantId || invoice.merchant_id || undefined;
}

function metadataForTransaction(invoice: DbInvoice): Record<string, string> | undefined {
  return typeof invoice.metadata === 'string'
    ? undefined
    : invoice.metadata || undefined;
}

export function emitInvoiceWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
  merchantId?: string,
): void {
  void Promise.resolve(dispatchWebhookEvent(event, payload, { merchantId })).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Invoices] Failed to dispatch ${event}:`, message);
  });
}

export function markInvoicePaid(invoice: DbInvoice, merchantId?: string): boolean {
  const ownerId = eventMerchantId(invoice, merchantId);
  const changed = db.updateInvoiceStatus(invoice.id, 'paid', ownerId);
  if (!changed) return false;

  db.upsertIncomingPaymentTransaction({
    paymentHash: invoice.payment_hash,
    invoiceId: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    description: invoice.description,
    metadata: metadataForTransaction(invoice),
  });

  emitInvoiceWebhookEvent('invoice.paid', {
    id: invoice.id,
    paymentHash: invoice.payment_hash,
    amount: invoice.amount,
    currency: invoice.currency,
    status: 'paid',
    paidAt: new Date().toISOString(),
  }, ownerId);

  return true;
}

function markInvoiceReceived(invoice: DbInvoice, merchantId?: string): boolean {
  const ownerId = eventMerchantId(invoice, merchantId);
  const changed = db.updateInvoiceStatus(invoice.id, 'received', ownerId);
  if (!changed) return false;

  emitInvoiceWebhookEvent('invoice.received', {
    id: invoice.id,
    paymentHash: invoice.payment_hash,
    amount: invoice.amount,
    currency: invoice.currency,
    status: 'received',
  }, ownerId);

  return true;
}

function markInvoiceExpired(invoice: DbInvoice, merchantId?: string): boolean {
  const ownerId = eventMerchantId(invoice, merchantId);
  const changed = db.updateInvoiceStatus(invoice.id, 'expired', ownerId);
  if (!changed) return false;

  emitInvoiceWebhookEvent('invoice.expired', {
    id: invoice.id,
    paymentHash: invoice.payment_hash,
    amount: invoice.amount,
    currency: invoice.currency,
    status: 'expired',
  }, ownerId);

  return true;
}

function buildResult(
  invoice: DbInvoice,
  outcome: InvoiceSettlementOutcome,
  changed: boolean,
  nodeStatus?: string,
  error?: string,
): InvoiceSettlementResult {
  const latest = db.getInvoice(invoice.id, eventMerchantId(invoice));
  return {
    invoiceId: invoice.id,
    previousStatus: invoice.status,
    status: latest?.status || invoice.status,
    outcome,
    changed,
    nodeStatus,
    error,
  };
}

function localExpiryElapsed(invoice: DbInvoice): boolean {
  return invoice.status === 'pending'
    && new Date(invoice.expires_at).getTime() <= Date.now();
}

export async function refreshInvoiceSettlement(
  invoice: DbInvoice,
  merchantId?: string,
): Promise<InvoiceSettlementResult> {
  if (invoice.status !== 'pending' && invoice.status !== 'received') {
    return buildResult(invoice, 'skipped', false);
  }

  const ownerId = eventMerchantId(invoice, merchantId);
  let nodeError: string | undefined;

  try {
    const nodeStatus = await getFiberClient().getInvoiceStatus(invoice.payment_hash);

    if (nodeStatus.status === 'Paid') {
      const changed = markInvoicePaid(invoice, ownerId);
      return buildResult(invoice, 'paid', changed, nodeStatus.status);
    }

    if (nodeStatus.status === 'Received' && invoice.status === 'pending') {
      const changed = markInvoiceReceived(invoice, ownerId);
      return buildResult(invoice, 'received', changed, nodeStatus.status);
    }

    if (nodeStatus.status === 'Expired' && invoice.status === 'pending') {
      const changed = markInvoiceExpired(invoice, ownerId);
      return buildResult(invoice, 'expired', changed, nodeStatus.status);
    }
  } catch (err: unknown) {
    nodeError = err instanceof Error ? err.message : String(err);
  }

  const latest = db.getInvoice(invoice.id, ownerId) || invoice;
  if (localExpiryElapsed(latest)) {
    const changed = markInvoiceExpired(latest, ownerId);
    return buildResult(latest, 'expired', changed, undefined, nodeError);
  }

  return buildResult(invoice, nodeError ? 'error' : 'unchanged', false, undefined, nodeError);
}

export async function refreshOpenInvoices(params: {
  limit?: number;
} = {}): Promise<OpenInvoiceSettlementSummary> {
  const limit = Math.max(1, params.limit || 25);
  const pending = db.listInvoices({ status: 'pending', limit }).items;
  const remaining = Math.max(0, limit - pending.length);
  const received = remaining > 0
    ? db.listInvoices({ status: 'received', limit: remaining }).items
    : [];

  const seen = new Set<string>();
  const invoices = [...pending, ...received].filter((invoice) => {
    if (seen.has(invoice.id)) return false;
    seen.add(invoice.id);
    return true;
  });

  const summary: OpenInvoiceSettlementSummary = {
    checked: 0,
    paid: 0,
    received: 0,
    expired: 0,
    unchanged: 0,
    errors: 0,
  };

  for (const invoice of invoices) {
    const result = await refreshInvoiceSettlement(invoice, invoice.merchant_id || undefined);
    summary.checked += 1;

    if (result.outcome === 'paid') summary.paid += 1;
    else if (result.outcome === 'received') summary.received += 1;
    else if (result.outcome === 'expired') summary.expired += 1;
    else if (result.outcome === 'error') summary.errors += 1;
    else summary.unchanged += 1;
  }

  return summary;
}
