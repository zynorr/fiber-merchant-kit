/**
 * Environment Variable Validation
 *
 * Validates required and optional environment variables at startup
 * with clear, actionable error messages to help users configure
 * the server correctly.
 *
 * Usage:
 *   import { validateEnv } from './env';
 *   const env = validateEnv();
 */

import { z } from 'zod';

// ── Schema ────────────────────────────────────────────────────

const envSchema = z.object({
  // Server
  PORT: z
    .string()
    .optional()
    .default('3001')
    .refine((v) => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n >= 1 && n <= 65535;
    }, 'PORT must be a valid port number between 1 and 65535'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),

  // Fiber Node RPC
  FIBER_NODE_RPC_URL: z.string().optional(),

  FIBER_NODE_RPC_URLS: z.string().optional(),

  FIBER_NODE_RPC_USER: z.string().optional(),

  FIBER_NODE_RPC_PASSWORD: z.string().optional(),

  FIBER_NODE_RPC_AUTH_TOKEN: z.string().optional(),

  FIBER_NODE_CURRENCY: z.enum(['Fibt', 'Fibb', 'Fibd']).optional(),

  // Invoice Settlement Worker
  FIBER_SETTLEMENT_WORKER: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || ['true', 'false'].includes(v.toLowerCase()),
      'FIBER_SETTLEMENT_WORKER must be "true" or "false"',
    ),

  FIBER_SETTLEMENT_WORKER_INTERVAL_MS: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0),
      'FIBER_SETTLEMENT_WORKER_INTERVAL_MS must be a positive integer (milliseconds)',
    ),

  FIBER_SETTLEMENT_WORKER_BATCH_SIZE: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0),
      'FIBER_SETTLEMENT_WORKER_BATCH_SIZE must be a positive integer',
    ),

  // Webhook Delivery Worker
  WEBHOOK_DELIVERY_WORKER: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || ['true', 'false'].includes(v.toLowerCase()),
      'WEBHOOK_DELIVERY_WORKER must be "true" or "false"',
    ),

  WEBHOOK_DELIVERY_WORKER_INTERVAL_MS: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0),
      'WEBHOOK_DELIVERY_WORKER_INTERVAL_MS must be a positive integer (milliseconds)',
    ),

  WEBHOOK_DELIVERY_WORKER_BATCH_SIZE: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0),
      'WEBHOOK_DELIVERY_WORKER_BATCH_SIZE must be a positive integer',
    ),

  // CORS
  CORS_ORIGIN: z.string().optional(),

  // Database
  FIBER_DB_ENGINE: z
    .enum(['sqlite', 'postgres'])
    .optional()
    .default('sqlite'),

  FIBER_MERCHANT_DB_PATH: z.string().optional(),

  DATABASE_URL: z.string().optional(),

  // Rate Limiting
  DISABLE_RATE_LIMIT: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0),
      'RATE_LIMIT_WINDOW_MS must be a positive integer (milliseconds)',
    ),

  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0),
      'RATE_LIMIT_MAX_REQUESTS must be a positive integer',
    ),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

// ── Validation errors ─────────────────────────────────────────

export interface EnvWarning {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate environment variables and return warnings/errors.
 * Does not call process.exit() — leaves that to the caller.
 */
export function validateEnv(): { env: ValidatedEnv; warnings: EnvWarning[] } {
  const warnings: EnvWarning[] = [];

  // ── Zod parse ────────────────────────────────────────────────
  // Collect errors for individual fields instead of throwing

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      warnings.push({
        field: issue.path.join('.') || 'unknown',
        message: issue.message,
        severity: 'error',
      });
    }
  }

  const env = parsed.success ? parsed.data : (envSchema.parse({}) as ValidatedEnv);

  // ── Custom validations beyond Zod schema ────────────────────

  // Production requires a real Fiber node URL
  const rpcUrls = [
    ...(env.FIBER_NODE_RPC_URLS ? env.FIBER_NODE_RPC_URLS.split(',').map((url) => url.trim()).filter(Boolean) : []),
    ...(env.FIBER_NODE_RPC_URL ? [env.FIBER_NODE_RPC_URL] : []),
  ];
  const hasLiveRpcUrl = rpcUrls.some((url) => url && url !== 'demo');

  if (env.NODE_ENV === 'production') {
    if (!hasLiveRpcUrl) {
      warnings.push({
        field: 'FIBER_NODE_RPC_URL',
        message:
          'FIBER_NODE_RPC_URL or FIBER_NODE_RPC_URLS is required in production mode. ' +
          'Set it to your Fiber Network Node RPC endpoint (e.g. http://localhost:8227). ' +
          'For development/demo mode, leave it unset or set NODE_ENV=development.',
        severity: 'error',
      });
    } else if (env.FIBER_NODE_RPC_URL === 'demo' && !env.FIBER_NODE_RPC_URLS) {
      warnings.push({
        field: 'FIBER_NODE_RPC_URL',
        message:
          'FIBER_NODE_RPC_URL is set to "demo" but NODE_ENV is "production". ' +
          'Production mode requires a real Fiber Network Node RPC endpoint ' +
          '(e.g. http://localhost:8227). Set NODE_ENV=development for demo mode.',
        severity: 'error',
      });
    }
  }

  // FIBER_NODE_RPC_URL set but URL format seems wrong
  for (const rpcUrl of rpcUrls) {
    if (!rpcUrl || rpcUrl === 'demo') continue;
    try {
      new URL(rpcUrl);
    } catch {
      warnings.push({
        field: env.FIBER_NODE_RPC_URLS ? 'FIBER_NODE_RPC_URLS' : 'FIBER_NODE_RPC_URL',
        message:
          `"${rpcUrl}" does not appear to be a valid URL. ` +
          'Expected format: http://localhost:8227. ' +
          'If you meant to use demo mode, leave FIBER_NODE_RPC_URL unset.',
        severity: 'warning',
      });
    }
  }

  if (rpcUrls.some((url) => url && url !== 'demo')) {
    // RPC user set but password missing (or vice versa).
    // Bearer tokens are preferred for protected/public Fiber RPC endpoints.
    if (!env.FIBER_NODE_RPC_AUTH_TOKEN && env.FIBER_NODE_RPC_USER && !env.FIBER_NODE_RPC_PASSWORD) {
      warnings.push({
        field: 'FIBER_NODE_RPC_PASSWORD',
        message:
          'FIBER_NODE_RPC_USER is set but FIBER_NODE_RPC_PASSWORD is missing. ' +
          'Either set both credentials, set FIBER_NODE_RPC_AUTH_TOKEN, or leave auth unset for a private node.',
        severity: 'warning',
      });
    }
    if (!env.FIBER_NODE_RPC_AUTH_TOKEN && !env.FIBER_NODE_RPC_USER && env.FIBER_NODE_RPC_PASSWORD) {
      warnings.push({
        field: 'FIBER_NODE_RPC_USER',
        message:
          'FIBER_NODE_RPC_PASSWORD is set but FIBER_NODE_RPC_USER is missing. ' +
          'Either set both credentials, set FIBER_NODE_RPC_AUTH_TOKEN, or leave auth unset for a private node.',
        severity: 'warning',
      });
    }
  }

  if (env.FIBER_DB_ENGINE === 'postgres') {
    if (!env.DATABASE_URL) {
      warnings.push({
        field: 'DATABASE_URL',
        message: 'DATABASE_URL is required when FIBER_DB_ENGINE=postgres.',
        severity: 'error',
      });
    } else {
      try {
        const parsed = new URL(env.DATABASE_URL);
        if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
          warnings.push({
            field: 'DATABASE_URL',
            message: 'DATABASE_URL must use postgres:// or postgresql:// when FIBER_DB_ENGINE=postgres.',
            severity: 'error',
          });
        }
      } catch {
        warnings.push({
          field: 'DATABASE_URL',
          message: 'DATABASE_URL must be a valid PostgreSQL connection URL.',
          severity: 'error',
        });
      }
    }
  }

  return { env, warnings };
}

// ── Formatting helpers ────────────────────────────────────────

/**
 * Format validation warnings into a human-readable string
 * suitable for printing to the console.
 */
export function formatWarnings(warnings: EnvWarning[]): string {
  if (warnings.length === 0) return '';

  const lines: string[] = [];
  lines.push('');

  for (const w of warnings) {
    const prefix = w.severity === 'error' ? '  ✗' : '  ⚠';
    lines.push(`${prefix} ${w.field}: ${w.message}`);
  }

  lines.push('');
  return lines.join('\n');
}
