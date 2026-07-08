import { useEffect, useState } from 'react';
import { MerchantClient, ChannelBalance } from '@fiber-merchant/sdk';
import { Wallet, Banknote, ArrowDownUp, RotateCw } from 'lucide-react';
import { StatCard, Card, CardHeader, CardTitle, Button } from '../components/ui';
import { formatCkbAmount } from '../utils/format';

interface BalancePageProps {
  client: MerchantClient;
}

export default function BalancePage({ client }: BalancePageProps) {
  const [channels, setChannels] = useState<ChannelBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState<{ local: string; remote: string; total: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBalance = async () => {
    setLoading(true);
    setError('');
    try {
      const [ch, total] = await Promise.all([
        client.balance.getChannels(),
        client.balance.getTotal(),
      ]);
      setChannels(ch);
      setTotalBalance(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balance data');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBalance(); }, [client]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Channel Balance</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your payment channel capacity</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
            <span className="text-sm">Loading balance data...</span>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">Failed to load balance data</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
          <Button size="sm" variant="ghost" onClick={loadBalance} className="mt-3 text-red-700 hover:bg-red-100">
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* Total Balance */}
          {totalBalance && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Local Balance"
                value={formatCkbAmount(totalBalance.local)}
                subtitle="CKB"
                icon={<ArrowDownUp className="h-5 w-5" />}
                color="emerald"
              />
              <StatCard
                title="Remote Balance"
                value={formatCkbAmount(totalBalance.remote)}
                subtitle="CKB"
                icon={<Banknote className="h-5 w-5" />}
                color="sky"
              />
              <StatCard
                title="Total Capacity"
                value={formatCkbAmount(totalBalance.total)}
                subtitle="CKB"
                icon={<Wallet className="h-5 w-5" />}
                color="fiber"
              />
            </div>
          )}

          {/* Channel List */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Channels</CardTitle>
              <button
                onClick={loadBalance}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCw className="h-3 w-3" />
                Refresh
              </button>
            </CardHeader>

            {channels.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Wallet className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No active channels</p>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map((ch, i) => {
                  const localPct = Number(ch.capacity) > 0
                    ? Math.min(100, Math.max(0, (Number(ch.localBalance) / Number(ch.capacity)) * 100))
                    : 50;
                  const ready = ch.state.toLowerCase().includes('ready');
                  return (
                    <div
                      key={ch.channelId || i}
                      className="bg-gray-50 rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <code className="text-xs font-mono text-gray-600">
                            {ch.channelId ? `${ch.channelId.slice(0, 8)}...${ch.channelId.slice(-4)}` : 'Demo Channel'}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">{ch.asset}</span>
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-medium">{ch.state}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                            <span>Local: {formatCkbAmount(ch.localBalance)}</span>
                            <span>Remote: {formatCkbAmount(ch.remoteBalance)}</span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-500"
                              style={{ width: `${localPct}%` }}
                            />
                            <div
                              className="bg-fiber-400 h-full transition-all duration-500"
                              style={{ width: `${100 - localPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span>Local</span>
                            <span>{formatCkbAmount(ch.capacity)} total</span>
                            <span>Remote</span>
                          </div>
                        </div>
                      </div>

                      {ch.peerPubkey && (
                        <p className="text-[10px] text-gray-400 mt-2 font-mono truncate">
                          Peer: {ch.peerPubkey.slice(0, 16)}...
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
