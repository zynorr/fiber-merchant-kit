/**
 * Shared Fiber Node client factory
 *
 * Extracted to a shared module to avoid duplication across route files.
 */

import { FiberNodeClient } from '../services/fiber-client';

export function getConfiguredFiberRpcUrls(): string[] {
  const multi = process.env.FIBER_NODE_RPC_URLS
    ?.split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (multi && multi.length > 0) return multi;
  return [process.env.FIBER_NODE_RPC_URL || 'demo'];
}

export function getFiberClient(): FiberNodeClient {
  const rpcUrls = getConfiguredFiberRpcUrls();
  return new FiberNodeClient({
    rpcUrl: rpcUrls[0],
    rpcUrls,
    rpcUser: process.env.FIBER_NODE_RPC_USER,
    rpcPassword: process.env.FIBER_NODE_RPC_PASSWORD,
    rpcAuthToken: process.env.FIBER_NODE_RPC_AUTH_TOKEN,
    rpcCurrency: process.env.FIBER_NODE_CURRENCY,
  });
}
