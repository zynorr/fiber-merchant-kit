/**
 * Shared Fiber Node client factory
 *
 * Extracted to a shared module to avoid duplication across route files.
 */

import { FiberNodeClient } from '../services/fiber-client';

export function getFiberClient(): FiberNodeClient {
  return new FiberNodeClient({
    rpcUrl: process.env.FIBER_NODE_RPC_URL || 'demo',
    rpcUser: process.env.FIBER_NODE_RPC_USER,
    rpcPassword: process.env.FIBER_NODE_RPC_PASSWORD,
    rpcAuthToken: process.env.FIBER_NODE_RPC_AUTH_TOKEN,
    rpcCurrency: process.env.FIBER_NODE_CURRENCY,
  });
}
