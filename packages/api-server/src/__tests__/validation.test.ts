import { describe, it, expect } from 'vitest';
import {
  createInvoiceSchema,
  registerWebhookSchema,
  updateWebhookSchema,
  refundInvoiceSchema,
} from '../validation';

describe('createInvoiceSchema', () => {
  it('accepts a valid invoice request', () => {
    const result = createInvoiceSchema.parse({
      amount: '5000',
      currency: 'CKB',
      description: 'Order #1234',
      metadata: { orderId: 'ORD-001' },
      expiry: 3600,
    });
    expect(result.amount).toBe('5000');
    expect(result.currency).toBe('CKB');
    expect(result.description).toBe('Order #1234');
  });

  it('accepts numeric amount', () => {
    const result = createInvoiceSchema.parse({ amount: 5000 });
    expect(result.amount).toBe(5000);
  });

  it('rejects empty amount', () => {
    expect(() => createInvoiceSchema.parse({})).toThrow();
  });

  it('rejects zero amount', () => {
    expect(() => createInvoiceSchema.parse({ amount: '0' })).toThrow();
  });

  it('rejects negative amount', () => {
    expect(() => createInvoiceSchema.parse({ amount: '-100' })).toThrow();
  });

  it('defaults currency to CKB', () => {
    const result = createInvoiceSchema.parse({ amount: '1000' });
    expect(result.currency).toBe('CKB');
  });

  it('accepts RUSD currency', () => {
    const result = createInvoiceSchema.parse({ amount: '1000', currency: 'RUSD' });
    expect(result.currency).toBe('RUSD');
  });

  it('rejects invalid currency', () => {
    expect(() => createInvoiceSchema.parse({ amount: '1000', currency: 'BTC' })).toThrow();
  });

  it('rejects expiry > 86400', () => {
    expect(() => createInvoiceSchema.parse({ amount: '1000', expiry: 999999 })).toThrow();
  });

  it('accepts optional webhookUrl', () => {
    const result = createInvoiceSchema.parse({
      amount: '1000',
      webhookUrl: 'https://api.mystore.com/webhooks/fiber',
    });
    expect(result.webhookUrl).toBe('https://api.mystore.com/webhooks/fiber');
  });

  it('rejects invalid webhookUrl', () => {
    expect(() =>
      createInvoiceSchema.parse({ amount: '1000', webhookUrl: 'not-a-url' })
    ).toThrow();
  });
});

describe('registerWebhookSchema', () => {
  it('accepts a valid webhook registration', () => {
    const result = registerWebhookSchema.parse({
      url: 'https://api.mystore.com/webhooks/fiber',
      events: ['invoice.paid', 'invoice.expired'],
      description: 'Production webhook',
    });
    expect(result.url).toBe('https://api.mystore.com/webhooks/fiber');
    expect(result.events).toEqual(['invoice.paid', 'invoice.expired']);
  });

  it('rejects empty events array', () => {
    expect(() =>
      registerWebhookSchema.parse({
        url: 'https://example.com',
        events: [],
      })
    ).toThrow();
  });

  it('rejects missing url', () => {
    expect(() =>
      registerWebhookSchema.parse({ events: ['invoice.paid'] })
    ).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() =>
      registerWebhookSchema.parse({ url: 'not-a-url', events: ['invoice.paid'] })
    ).toThrow();
  });

  it('rejects invalid event type', () => {
    expect(() =>
      registerWebhookSchema.parse({
        url: 'https://example.com',
        events: ['invalid.event'],
      })
    ).toThrow();
  });
});

describe('updateWebhookSchema', () => {
  it('accepts partial update', () => {
    const result = updateWebhookSchema.parse({ active: false });
    expect(result.active).toBe(false);
  });

  it('accepts full update', () => {
    const result = updateWebhookSchema.parse({
      url: 'https://example.com/new',
      events: ['invoice.paid'],
      active: true,
    });
    expect(result.url).toBe('https://example.com/new');
  });

  it('rejects invalid events in update', () => {
    expect(() =>
      updateWebhookSchema.parse({ events: ['bad.event'] })
    ).toThrow();
  });
});

describe('refundInvoiceSchema', () => {
  it('accepts empty body', () => {
    const result = refundInvoiceSchema.parse({});
    expect(result.reason).toBeUndefined();
  });

  it('accepts reason', () => {
    const result = refundInvoiceSchema.parse({ reason: 'Customer requested refund' });
    expect(result.reason).toBe('Customer requested refund');
  });
});
