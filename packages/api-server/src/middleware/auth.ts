/**
 * API key authentication middleware
 *
 * Validates the Bearer token against the merchants table.
 * Attaches merchant ID to the request if valid.
 */

import { Request, Response, NextFunction } from 'express';
import { findMerchantByApiKey } from '../db';
import type { MerchantRole } from '../db/types';

export interface AuthenticatedRequest extends Request {
  merchantId?: string;
  merchantRole?: MerchantRole;
  merchantLabel?: string | null;
}

const ROLE_RANK: Record<MerchantRole, number> = {
  viewer: 1,
  developer: 2,
  admin: 3,
  owner: 4,
};

export const ROLE_PERMISSIONS: Record<MerchantRole, string[]> = {
  owner: ['read', 'write', 'manage_webhooks', 'manage_keys', 'manage_users', 'run_settlement'],
  admin: ['read', 'write', 'manage_webhooks', 'manage_keys', 'manage_users', 'run_settlement'],
  developer: ['read', 'write', 'manage_webhooks', 'run_settlement'],
  viewer: ['read'],
};

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
  req.merchantRole = (merchant.role || 'owner') as MerchantRole;
  req.merchantLabel = merchant.label;
  next();
}

export function requireRole(roles: MerchantRole[]) {
  const minimum = Math.min(...roles.map((role) => ROLE_RANK[role]));
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.merchantRole || 'viewer';
    if (ROLE_RANK[role] < minimum) {
      res.status(403).json({ error: 'Insufficient role for this operation' });
      return;
    }
    next();
  };
}
