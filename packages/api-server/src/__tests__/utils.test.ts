import { describe, it, expect } from 'vitest';
import { toCamelCase, rowsToCamelCase } from '../lib/utils';

describe('toCamelCase', () => {
  it('converts snake_case keys to camelCase', () => {
    const result = toCamelCase({ payment_hash: 'abc', invoice_address: 'fibt1...' });
    expect(result).toEqual({ paymentHash: 'abc', invoiceAddress: 'fibt1...' });
  });

  it('leaves already camelCase keys unchanged', () => {
    const result = toCamelCase({ paymentHash: 'abc', invoiceAddress: 'fibt1...' });
    expect(result).toEqual({ paymentHash: 'abc', invoiceAddress: 'fibt1...' });
  });

  it('handles empty object', () => {
    const result = toCamelCase({});
    expect(result).toEqual({});
  });

  it('handles single key', () => {
    const result = toCamelCase({ created_at: '2024-01-01' });
    expect(result).toEqual({ createdAt: '2024-01-01' });
  });

  it('handles nested snake_case (single level only)', () => {
    const result = toCamelCase({ merchant_id: 'm1', last_used_at: null });
    expect(result).toEqual({ merchantId: 'm1', lastUsedAt: null });
  });
});

describe('rowsToCamelCase', () => {
  it('converts an array of rows', () => {
    const rows = [
      { payment_hash: 'abc', amount: '1000' },
      { payment_hash: 'def', amount: '2000' },
    ];
    const result = rowsToCamelCase(rows);
    expect(result).toEqual([
      { paymentHash: 'abc', amount: '1000' },
      { paymentHash: 'def', amount: '2000' },
    ]);
  });

  it('handles empty array', () => {
    const result = rowsToCamelCase([]);
    expect(result).toEqual([]);
  });
});
