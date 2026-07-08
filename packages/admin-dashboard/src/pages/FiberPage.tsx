import { useEffect, useState } from 'react';
import { MerchantClient, FiberStatus, SettlementRunResult } from '@fiber-merchant/sdk';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Layers,
  Network,
  PlayCircle,
  RefreshCw,
  Server,
  WifiOff,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, CardTitle, StatCard } from '../components/ui';
import { formatCkbAmount } from '../utils/format';

interface FiberPageProps {
  client: MerchantClient;
}

function shortId(value?: string, head = 14, tail = 6): string {
  if (!value) return 'Unavailable';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function pct(part: string, total: string): number {
  const partNumber = Number(part);
  const totalNumber = Number(total);
  if (!Number.isFinite(partNumber) || !Number.isFinite(totalNumber) || totalNumber <= 0) return 0;
  return Math.min(100, Math.max(0, (partNumber / totalNumber) * 100));
}

function stateVariant(state: string): 'success' | 'warning' | 'danger' | 'default' {
  const normalized = state.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('normal')) return 'success';
  if (normalized.includes('failed') || normalized.includes('closed')) return 'danger';
  if (normalized) return 'warning';
  return 'default';
}

export default function FiberPage({ client }: FiberPageProps) {
  const [status, setStatus] = useState<FiberStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlementRun, setSettlementRun] = useState<SettlementRunResult | null>(null);
  const [settlementError, setSettlementError] = useState('');
  const [error, setError] = useState('');

  const loadStatus = async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      setStatus(await client.fiber.getStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Fiber status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runSettlement = async () => {
    setSettling(true);
    setSettlementError('');

    try {
      const result = await client.fiber.runSettlement();
      setSettlementRun(result);
      setStatus(await client.fiber.getStatus());
    } catch (err) {
      setSettlementError(err instanceof Error ? err.message : 'Failed to run settlement');
    } finally {
      setSettling(false);
    }
  };

  useEffect(() => { loadStatus(); }, [client]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
          <span className="text-sm">Loading network status...</span>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700 text-sm font-medium">Failed to load network status</p>
        <p className="text-red-500 text-xs mt-1">{error}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => loadStatus()}
          className="mt-3 text-red-700 hover:bg-red-100"
        >
          Try again
        </Button>
      </div>
    );
  }

  const localPct = pct(status.channels.localBalance, status.channels.totalCapacity);
  const remotePct = pct(status.channels.remoteBalance, status.channels.totalCapacity);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fiber Network</h1>
          <p className="text-sm text-gray-500 mt-1">Node, channel, and settlement status</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runSettlement}
            loading={settling}
            icon={<PlayCircle className="h-4 w-4" />}
          >
            Run Settlement
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadStatus(true)}
            loading={refreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Network Mode"
          value={status.mode === 'live' ? 'Live' : 'Demo'}
          subtitle={status.reachable ? 'Reachable' : 'Unreachable'}
          icon={status.reachable ? <CheckCircle2 className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
          color={status.reachable ? 'emerald' : 'amber'}
        />
        <StatCard
          title="Node"
          value={status.node?.alias || shortId(status.node?.nodeId, 8, 4)}
          subtitle={status.node?.version || status.currency}
          icon={<Server className="h-5 w-5" />}
          color="fiber"
        />
        <StatCard
          title="Channels"
          value={`${status.channels.ready}/${status.channels.total}`}
          subtitle={`${status.channels.pending} pending, ${status.channels.failed} closed`}
          icon={<Network className="h-5 w-5" />}
          color="sky"
        />
        <StatCard
          title="Settlement Worker"
          value={status.worker.enabled ? 'Enabled' : 'Disabled'}
          subtitle={`${formatInterval(status.worker.intervalMs)} interval, ${status.worker.batchSize} batch`}
          icon={<Activity className="h-5 w-5" />}
          color={status.worker.enabled ? 'emerald' : 'amber'}
        />
      </div>

      {status.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Fiber RPC warning</p>
          <p className="text-xs text-amber-700 mt-1">{status.error}</p>
        </div>
      )}

      {settlementError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Settlement run failed</p>
          <p className="text-xs text-red-500 mt-1">{settlementError}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>RPC Endpoints</CardTitle>
          <Badge variant={status.rpcEndpoints.some((endpoint) => endpoint.reachable) ? 'success' : 'warning'}>
            {status.rpcEndpoints.filter((endpoint) => endpoint.reachable).length}/{status.rpcEndpoints.length} reachable
          </Badge>
        </CardHeader>
        <div className="space-y-3">
          {status.rpcEndpoints.map((endpoint) => (
            <div
              key={endpoint.url}
              className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={endpoint.reachable ? 'success' : 'danger'} size="sm">
                    {endpoint.reachable ? 'Reachable' : 'Offline'}
                  </Badge>
                  <span className="truncate font-mono text-xs text-gray-600">{endpoint.url}</span>
                </div>
                {endpoint.error && (
                  <p className="mt-1 truncate text-xs text-red-500">{endpoint.error}</p>
                )}
              </div>
              <div className="text-left text-xs text-gray-400 sm:text-right">
                <p>{shortId(endpoint.nodeId, 10, 4)}</p>
                <p>{endpoint.version || status.currency}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settlement Activity</CardTitle>
          <Badge variant={status.worker.running ? 'warning' : 'default'}>
            {status.worker.running ? 'Running' : 'Idle'}
          </Badge>
        </CardHeader>
        {(() => {
          const summary = settlementRun?.summary || status.worker.lastSummary;
          const runAt = settlementRun?.finishedAt || status.worker.lastSuccessAt || status.worker.lastRunAt;

          return summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Checked</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{summary.checked}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Paid</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">{summary.paid}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Received</p>
                <p className="mt-1 text-lg font-semibold text-sky-700">{summary.received}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Expired</p>
                <p className="mt-1 text-lg font-semibold text-amber-700">{summary.expired}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Errors</p>
                <p className="mt-1 text-lg font-semibold text-red-700">{summary.errors}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Run</p>
                <p className="mt-1 text-sm font-medium text-gray-700">
                  {runAt ? new Date(runAt).toLocaleTimeString() : 'Unavailable'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <Activity className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-500">No settlement runs recorded</p>
            </div>
          );
        })()}
        {settlementRun?.error && (
          <p className="mt-3 text-xs text-amber-700">{settlementRun.error}</p>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Node Details</CardTitle>
            <Badge variant={status.reachable ? 'success' : 'warning'}>
              {status.reachable ? 'Online' : 'Offline'}
            </Badge>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Node ID</p>
              <p className="mt-1 text-sm font-mono text-gray-700 break-all">{status.node?.nodeId || 'Unavailable'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Version</p>
              <p className="mt-1 text-sm text-gray-700">{status.node?.version || 'Unavailable'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Peers</p>
              <p className="mt-1 text-sm text-gray-700">{status.node?.peersCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Chain Hash</p>
              <p className="mt-1 text-sm font-mono text-gray-700 break-all">
                {status.node?.chainHash || 'Unavailable'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
            <Layers className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Local</span>
                <span>{formatCkbAmount(status.channels.localBalance)} CKB</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${localPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Remote</span>
                <span>{formatCkbAmount(status.channels.remoteBalance)} CKB</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-fiber-500" style={{ width: `${remotePct}%` }} />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">Total Capacity</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCkbAmount(status.channels.totalCapacity)} CKB
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(status.checkedAt).toLocaleTimeString()}
          </div>
        </CardHeader>

        {status.channels.items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Network className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No channels reported</p>
          </div>
        ) : (
          <div className="space-y-3">
            {status.channels.items.map((channel, index) => {
              const channelLocalPct = pct(channel.localBalance, channel.capacity);
              return (
                <div
                  key={channel.channelId || `${channel.peerPubkey}-${index}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={stateVariant(channel.state)}>{channel.state || 'Unknown'}</Badge>
                        <span className="text-xs font-medium text-gray-500">{channel.asset}</span>
                      </div>
                      <p className="mt-2 text-xs font-mono text-gray-600 truncate">
                        {shortId(channel.channelId || channel.peerPubkey, 22, 8)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCkbAmount(channel.capacity)} CKB
                      </p>
                      <p className="text-xs text-gray-400">capacity</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Local: {formatCkbAmount(channel.localBalance)}</span>
                      <span>Remote: {formatCkbAmount(channel.remoteBalance)}</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${channelLocalPct}%` }} />
                      <div className="bg-fiber-400 h-full" style={{ width: `${100 - channelLocalPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
