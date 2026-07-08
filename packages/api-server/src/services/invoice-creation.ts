import crypto from 'crypto';
import * as db from '../db';
import { getFiberClient } from '../lib/fiber-client';
import type { DbInvoice } from '../db/types';
import type { CreateInvoiceInput } from '../validation';
import { emitInvoiceWebhookEvent } from './invoice-settlement';

export async function createMerchantInvoice(
  input: CreateInvoiceInput,
  merchantId: string,
): Promise<DbInvoice> {
  const {
    amount,
    currency,
    description,
    metadata,
    expiry,
    webhookUrl,
    udtTypeScript,
  } = input;
  const normalizedCurrency = currency || 'CKB';
  const normalizedExpiry = expiry || 3600;

  const invoiceResult = await getFiberClient().createInvoice({
    amount: String(amount),
    currency: normalizedCurrency,
    description,
    expiry: normalizedExpiry,
    udtTypeScript,
    allowMpp: true,
  });

  const invoiceId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + normalizedExpiry * 1000).toISOString();

  db.createInvoice({
    id: invoiceId,
    paymentHash: invoiceResult.paymentHash,
    preimage: invoiceResult.preimage,
    invoiceAddress: invoiceResult.invoiceAddress,
    amount: String(amount),
    currency: normalizedCurrency,
    description,
    metadata: metadata as Record<string, string> | undefined,
    expiresAt,
    webhookUrl,
    merchantId,
  });

  db.createTransaction({
    id: crypto.randomUUID(),
    paymentHash: invoiceResult.paymentHash,
    invoiceId,
    direction: 'incoming',
    amount: String(amount),
    currency: normalizedCurrency,
    status: 'Pending',
    description,
    metadata: metadata as Record<string, string> | undefined,
  });

  emitInvoiceWebhookEvent('invoice.created', {
    id: invoiceId,
    amount: String(amount),
    currency: normalizedCurrency,
    status: 'pending',
    invoiceAddress: invoiceResult.invoiceAddress,
    expiresAt,
  }, merchantId);

  const invoice = db.getInvoice(invoiceId, merchantId);
  if (!invoice) {
    throw new Error('Invoice was created but could not be read back from storage');
  }
  return invoice;
}
