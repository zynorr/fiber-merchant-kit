/**
 * API key authentication middleware
 *
 * Validates the Bearer token against the merchants table.
 * Attaches merchant ID to the request if valid.
 */

import { Request, Response, NextFunction } from 'express';
import { findMerchantByApiKey } from '../db';

export interface AuthenticatedRequest extends Request {
  merchantId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header. Use: Bearer fm_sk_...' });
    return;
  }

  const apiKey = authHeader.slice(7).trim();

  if (!apiKey.startsWith('fm_sk_')) {
    res.status(401).json({ error: 'Invalid API key format' });
    return;
  }

  const merchant = findMerchantByApiKey(apiKey);

  if (!merchant) {
    res.status(401).json({ error: 'Invalid or inactive API key' });
    return;
  }

  req.merchantId = merchant.id as string;
  next();
}
