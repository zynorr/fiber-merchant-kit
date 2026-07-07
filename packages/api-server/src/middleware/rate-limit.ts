/**
 * Rate Limiting Middleware
 *
 * Limits the number of requests per API key within a time window.
 * Uses an in-memory store (sufficient for single-server deployments).
 * For multi-server setups, swap in an external store (Redis, etc.).
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;    // 100 requests per window
const HEALTH_CHECK_MAX = 20;         // health check is cheaper

/**
 * Create a rate limiter for general API endpoints
 */
export function createApiLimiter() {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(DEFAULT_WINDOW_MS), 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || String(DEFAULT_MAX_REQUESTS), 10),
    standardHeaders: true,  // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,   // Disable the `X-RateLimit-*` headers
    keyGenerator: (req: Request) => {
      // Rate limit by API key if available, otherwise by IP
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
      }
      // Normalize IPv6 loopback to IPv4 for consistent keying
      return (req.ip || 'unknown').replace(/^::ffff:/, '');
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Too many requests. Please slow down and try again later.',
      });
    },
  });
}

/**
 * Create a less restrictive rate limiter for the health check endpoint
 */
export function createHealthLimiter() {
  return rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    max: HEALTH_CHECK_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many health check requests.' },
  });
}
