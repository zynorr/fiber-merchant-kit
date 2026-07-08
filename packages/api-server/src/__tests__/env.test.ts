import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateEnv, formatWarnings } from '../env';

function stubEnvExample(relativePath: string) {
  const contents = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    vi.stubEnv(key.trim(), rest.join('=').trim());
  }
}

describe('validateEnv', () => {
  beforeEach(() => {
    // Only stub env vars that would interfere with tests.
    // Leave others unset so Zod defaults and optionals work correctly.
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns no errors for minimal valid env (demo mode)', () => {
    const { env, warnings } = validateEnv();
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    expect(env.PORT).toBe('3001');
    expect(env.NODE_ENV).toBe('development');
    expect(env.FIBER_NODE_RPC_URL).toBeUndefined();
  });

  it('returns default PORT when not set', () => {
    const { env } = validateEnv();
    expect(env.PORT).toBe('3001');
  });

  it('accepts a valid custom PORT', () => {
    vi.stubEnv('PORT', '8080');
    const { env, warnings } = validateEnv();
    expect(env.PORT).toBe('8080');
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('errors on invalid PORT', () => {
    vi.stubEnv('PORT', 'abc');
    const { warnings } = validateEnv();
    const portErr = warnings.find((w) => w.field === 'PORT');
    expect(portErr).toBeDefined();
    expect(portErr!.severity).toBe('error');
    expect(portErr!.message).toContain('valid port number');
  });

  it('errors on PORT out of range', () => {
    vi.stubEnv('PORT', '999999');
    const { warnings } = validateEnv();
    const portErr = warnings.find((w) => w.field === 'PORT');
    expect(portErr).toBeDefined();
    expect(portErr!.severity).toBe('error');
  });

  it('errors when FIBER_NODE_RPC_URL is missing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { warnings } = validateEnv();
    const urlErr = warnings.find((w) => w.field === 'FIBER_NODE_RPC_URL');
    expect(urlErr).toBeDefined();
    expect(urlErr!.severity).toBe('error');
    expect(urlErr!.message).toContain('required in production mode');
  });

  it('errors when FIBER_NODE_RPC_URL is set to demo in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FIBER_NODE_RPC_URL', 'demo');
    const { warnings } = validateEnv();
    const urlErr = warnings.find((w) => w.field === 'FIBER_NODE_RPC_URL');
    expect(urlErr).toBeDefined();
    expect(urlErr!.severity).toBe('error');
    expect(urlErr!.message).toContain('production');
    expect(urlErr!.message).toContain('demo');
  });

  it('accepts FIBER_NODE_RPC_URL in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
    const { warnings } = validateEnv();
    const urlErr = warnings.find((w) => w.field === 'FIBER_NODE_RPC_URL');
    expect(urlErr).toBeUndefined();
  });

  it('accepts bearer auth token and Fiber network currency', () => {
    vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
    vi.stubEnv('FIBER_NODE_RPC_AUTH_TOKEN', 'test-biscuit-token');
    vi.stubEnv('FIBER_NODE_CURRENCY', 'Fibt');
    const { env, warnings } = validateEnv();
    expect(env.FIBER_NODE_RPC_AUTH_TOKEN).toBe('test-biscuit-token');
    expect(env.FIBER_NODE_CURRENCY).toBe('Fibt');
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('accepts settlement worker configuration', () => {
    vi.stubEnv('FIBER_SETTLEMENT_WORKER', 'true');
    vi.stubEnv('FIBER_SETTLEMENT_WORKER_INTERVAL_MS', '15000');
    vi.stubEnv('FIBER_SETTLEMENT_WORKER_BATCH_SIZE', '10');
    const { env, warnings } = validateEnv();
    expect(env.FIBER_SETTLEMENT_WORKER).toBe('true');
    expect(env.FIBER_SETTLEMENT_WORKER_INTERVAL_MS).toBe('15000');
    expect(env.FIBER_SETTLEMENT_WORKER_BATCH_SIZE).toBe('10');
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('errors on invalid settlement worker interval', () => {
    vi.stubEnv('FIBER_SETTLEMENT_WORKER_INTERVAL_MS', '-1');
    const { warnings } = validateEnv();
    const intervalErr = warnings.find((w) => w.field === 'FIBER_SETTLEMENT_WORKER_INTERVAL_MS');
    expect(intervalErr).toBeDefined();
    expect(intervalErr!.severity).toBe('error');
  });

  it('does not require basic auth password when bearer token is set', () => {
    vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
    vi.stubEnv('FIBER_NODE_RPC_AUTH_TOKEN', 'test-biscuit-token');
    vi.stubEnv('FIBER_NODE_RPC_USER', 'ckb');
    const { warnings } = validateEnv();
    const pwWarn = warnings.find((w) => w.field === 'FIBER_NODE_RPC_PASSWORD');
    expect(pwWarn).toBeUndefined();
  });

  it('warns on invalid FIBER_NODE_RPC_URL format', () => {
    vi.stubEnv('FIBER_NODE_RPC_URL', 'not-a-url');
    const { warnings } = validateEnv();
    const urlWarn = warnings.find(
      (w) => w.field === 'FIBER_NODE_RPC_URL' && w.severity === 'warning',
    );
    expect(urlWarn).toBeDefined();
    expect(urlWarn!.message).toContain('valid URL');
  });

  it('warns when FIBER_NODE_RPC_USER is set but PASSWORD is missing', () => {
    vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
    vi.stubEnv('FIBER_NODE_RPC_USER', 'ckb');
    const { warnings } = validateEnv();
    const pwWarn = warnings.find((w) => w.field === 'FIBER_NODE_RPC_PASSWORD');
    expect(pwWarn).toBeDefined();
    expect(pwWarn!.severity).toBe('warning');
    expect(pwWarn!.message).toContain('FIBER_NODE_RPC_PASSWORD is missing');
  });

  it('warns when FIBER_NODE_RPC_PASSWORD is set but USER is missing', () => {
    vi.stubEnv('FIBER_NODE_RPC_URL', 'http://localhost:8227');
    vi.stubEnv('FIBER_NODE_RPC_PASSWORD', 'secret');
    const { warnings } = validateEnv();
    const userWarn = warnings.find((w) => w.field === 'FIBER_NODE_RPC_USER');
    expect(userWarn).toBeDefined();
    expect(userWarn!.severity).toBe('warning');
    expect(userWarn!.message).toContain('FIBER_NODE_RPC_USER is missing');
  });

  it('accepts DISABLE_RATE_LIMIT as true', () => {
    vi.stubEnv('DISABLE_RATE_LIMIT', 'true');
    const { warnings } = validateEnv();
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('accepts DISABLE_RATE_LIMIT as false', () => {
    vi.stubEnv('DISABLE_RATE_LIMIT', 'false');
    const { warnings } = validateEnv();
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('accepts DISABLE_RATE_LIMIT as any string value (runtime handles it)', () => {
    vi.stubEnv('DISABLE_RATE_LIMIT', '1');
    const { warnings } = validateEnv();
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('errors on negative RATE_LIMIT_WINDOW_MS', () => {
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '-100');
    const { warnings } = validateEnv();
    const winErr = warnings.find((w) => w.field === 'RATE_LIMIT_WINDOW_MS');
    expect(winErr).toBeDefined();
    expect(winErr!.severity).toBe('error');
  });

  it('accepts valid RATE_LIMIT_WINDOW_MS', () => {
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '60000');
    const { warnings } = validateEnv();
    expect(warnings.filter((w) => w.field === 'RATE_LIMIT_WINDOW_MS')).toHaveLength(0);
  });

  it('accepts webhook delivery worker settings', () => {
    vi.stubEnv('WEBHOOK_DELIVERY_WORKER', 'false');
    vi.stubEnv('WEBHOOK_DELIVERY_WORKER_INTERVAL_MS', '5000');
    vi.stubEnv('WEBHOOK_DELIVERY_WORKER_BATCH_SIZE', '25');

    const { warnings } = validateEnv();

    expect(warnings.filter((w) => w.field.startsWith('WEBHOOK_DELIVERY_WORKER'))).toHaveLength(0);
  });

  it('errors on invalid webhook delivery worker settings', () => {
    vi.stubEnv('WEBHOOK_DELIVERY_WORKER', 'sometimes');
    vi.stubEnv('WEBHOOK_DELIVERY_WORKER_INTERVAL_MS', '-1');
    vi.stubEnv('WEBHOOK_DELIVERY_WORKER_BATCH_SIZE', '0');

    const { warnings } = validateEnv();

    expect(warnings.find((w) => w.field === 'WEBHOOK_DELIVERY_WORKER')?.severity).toBe('error');
    expect(warnings.find((w) => w.field === 'WEBHOOK_DELIVERY_WORKER_INTERVAL_MS')?.severity).toBe('error');
    expect(warnings.find((w) => w.field === 'WEBHOOK_DELIVERY_WORKER_BATCH_SIZE')?.severity).toBe('error');
  });

  it('accepts demo as FIBER_NODE_RPC_URL in development without validation', () => {
    vi.stubEnv('FIBER_NODE_RPC_URL', 'demo');
    const { warnings } = validateEnv();
    const urlWarn = warnings.find((w) => w.field === 'FIBER_NODE_RPC_URL');
    expect(urlWarn).toBeUndefined();
  });

  it('accepts the checked-in API .env.example defaults', () => {
    stubEnvExample('.env.example');

    const { env, warnings } = validateEnv();

    expect(env.FIBER_NODE_RPC_URL).toBe('demo');
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });
});

describe('formatWarnings', () => {
  it('returns empty string for no warnings', () => {
    expect(formatWarnings([])).toBe('');
  });

  it('formats error warnings with bullet prefix', () => {
    const result = formatWarnings([
      { field: 'PORT', message: 'Invalid port number', severity: 'error' },
    ]);
    expect(result).toContain('✗');
    expect(result).toContain('PORT: Invalid port number');
  });

  it('formats warning severity with bullet prefix', () => {
    const result = formatWarnings([
      { field: 'FIBER_NODE_RPC_URL', message: 'Check URL format', severity: 'warning' },
    ]);
    expect(result).toContain('⚠');
    expect(result).toContain('FIBER_NODE_RPC_URL: Check URL format');
  });

  it('handles mixed errors and warnings', () => {
    const result = formatWarnings([
      { field: 'PORT', message: 'Invalid', severity: 'error' },
      { field: 'FIBER_NODE_RPC_URL', message: 'Check format', severity: 'warning' },
    ]);
    expect(result).toContain('✗');
    expect(result).toContain('⚠');
    expect(result).toContain('PORT: Invalid');
    expect(result).toContain('FIBER_NODE_RPC_URL: Check format');
  });
});
