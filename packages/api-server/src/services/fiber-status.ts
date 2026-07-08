import { getFiberClient } from '../lib/fiber-client';
import { getSettlementWorkerConfig } from './settlement-worker';
import type { ChannelInfo } from './fiber-client';

type JsonRecord = Record<string, unknown>;

export interface FiberStatusResponse {
  mode: 'demo' | 'live';
  reachable: boolean;
  rpcUrlConfigured: boolean;
  currency: string;
  checkedAt: string;
  worker: ReturnType<typeof getSettlementWorkerConfig>;
  node: {
    nodeId: string;
    alias?: string;
    version?: string;
    chainHash?: string;
    peersCount: number;
    channelsCount: number;
    pendingChannelsCount: number;
  } | null;
  channels: {
    total: number;
    ready: number;
    pending: number;
    failed: number;
    localBalance: string;
    remoteBalance: string;
    totalCapacity: string;
    items: ChannelInfo[];
  };
  error?: string;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function pickString(source: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  }
  return undefined;
}

function parseCount(source: JsonRecord, ...keys: string[]): number | undefined {
  const value = pickString(source, ...keys);
  if (!value) return undefined;

  try {
    const parsed = value.startsWith('0x') || value.startsWith('0X')
      ? Number(BigInt(value))
      : Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function toBigInt(value: string): bigint {
  try {
    return BigInt(value || '0');
  } catch {
    return BigInt(0);
  }
}

function channelStateBucket(state: string): 'ready' | 'pending' | 'failed' {
  const normalized = state.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('normal')) return 'ready';
  if (
    normalized.includes('failed')
    || normalized.includes('closed')
    || normalized.includes('closing')
    || normalized.includes('abandoned')
  ) {
    return 'failed';
  }
  return 'pending';
}

function summarizeChannels(channels: ChannelInfo[]): FiberStatusResponse['channels'] {
  let localBalance = BigInt(0);
  let remoteBalance = BigInt(0);
  let totalCapacity = BigInt(0);
  let ready = 0;
  let pending = 0;
  let failed = 0;

  for (const channel of channels) {
    localBalance += toBigInt(channel.localBalance);
    remoteBalance += toBigInt(channel.remoteBalance);
    totalCapacity += toBigInt(channel.capacity);

    const bucket = channelStateBucket(channel.state || '');
    if (bucket === 'ready') ready += 1;
    else if (bucket === 'failed') failed += 1;
    else pending += 1;
  }

  return {
    total: channels.length,
    ready,
    pending,
    failed,
    localBalance: localBalance.toString(),
    remoteBalance: remoteBalance.toString(),
    totalCapacity: totalCapacity.toString(),
    items: channels,
  };
}

function normalizeNodeInfo(
  nodeInfo: unknown,
  channelsCount: number,
): FiberStatusResponse['node'] {
  const node = asRecord(nodeInfo);
  const nestedNode = asRecord(node.node_info || node.nodeInfo);
  const source = Object.keys(nestedNode).length > 0 ? nestedNode : node;
  const nodeId = pickString(source, 'node_id', 'nodeId', 'peer_id', 'peerId', 'pubkey', 'public_key');

  if (!nodeId) return null;

  return {
    nodeId,
    alias: pickString(source, 'alias', 'name', 'node_name', 'nodeName'),
    version: pickString(source, 'version', 'fiber_version', 'fiberVersion'),
    chainHash: pickString(source, 'chain_hash', 'chainHash'),
    peersCount: parseCount(source, 'peers_count', 'peersCount', 'peers') ?? 0,
    channelsCount: parseCount(source, 'channels_count', 'channelsCount', 'channels') ?? channelsCount,
    pendingChannelsCount: parseCount(
      source,
      'pending_channels_count',
      'pendingChannelsCount',
      'pending_channels',
      'pendingChannels',
    ) ?? 0,
  };
}

export async function getFiberNetworkStatus(): Promise<FiberStatusResponse> {
  const fiber = getFiberClient();
  const liveMode = Boolean(process.env.FIBER_NODE_RPC_URL && process.env.FIBER_NODE_RPC_URL !== 'demo');
  const errors: string[] = [];
  let nodeInfo: unknown;
  let channels: ChannelInfo[] = [];
  let nodeReachable = false;
  let channelsReachable = false;

  try {
    nodeInfo = await fiber.getNodeInfo();
    nodeReachable = true;
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    channels = await fiber.listChannels();
    channelsReachable = true;
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    mode: liveMode ? 'live' : 'demo',
    reachable: nodeReachable || channelsReachable,
    rpcUrlConfigured: Boolean(process.env.FIBER_NODE_RPC_URL),
    currency: process.env.FIBER_NODE_CURRENCY || 'Fibt',
    checkedAt: new Date().toISOString(),
    worker: getSettlementWorkerConfig(),
    node: nodeReachable ? normalizeNodeInfo(nodeInfo, channels.length) : null,
    channels: summarizeChannels(channels),
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
