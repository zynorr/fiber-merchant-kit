import { useEffect, useState } from 'react';
import { MerchantClient, MerchantStats } from '@fiber-merchant/sdk';
import { Link } from 'react-router-dom';
import {
  Receipt,
  CheckCircle2,
  CircleDollarSign,
  TrendingUp,
  Plus,
  Webhook,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { StatCard, Card, CardHeader, CardTitle } from '../components/ui';
import { formatCkbAmount } from '../utils/format';

interface DashboardPageProps {
  client: MerchantClient;
}

export default function DashboardPage({ client }: DashboardPageProps) {
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [revenue, setRevenue] = useState<{ date: string; volume: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [client]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, revenueData] = await Promise.all([
        client.stats.get(),
        client.stats.revenueHistory(14),
      ]);
      setStats(statsData);
      setRevenue(revenueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700 text-sm font-medium">Failed to load dashboard</p>
        <p className="text-red-500 text-xs mt-1">{error}</p>
        <button onClick={loadData} className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium">
          Try again
        </button>
      </div>
    );
  }

  const maxVolume = Math.max(...revenue.map((r) => Number(r.volume)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your payment processing activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoices"
          value={stats?.totalInvoices ?? 0}
          icon={<Receipt className="h-5 w-5" />}
          color="fiber"
        />
        <StatCard
          title="Paid Invoices"
          value={stats?.paidInvoices ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
          subtitle={`${stats?.successRate ?? 0}% success rate`}
        />
        <StatCard
          title="Total Volume"
          value={formatCkbAmount(stats?.totalVolume ?? 0)}
          subtitle="CKB"
          icon={<CircleDollarSign className="h-5 w-5" />}
          color="violet"
        />
        <StatCard
          title="Active Channels"
          value={stats?.activeChannels ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
          color="amber"
          subtitle="Payment channels"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/invoices"
            className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-fiber-200 hover:bg-fiber-50/50 transition-all duration-150 group"
          >
            <div className="w-10 h-10 rounded-lg bg-fiber-50 flex items-center justify-center text-fiber-600 group-hover:scale-110 transition-transform">
              <Plus className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Create Invoice</p>
              <p className="text-xs text-gray-500">Generate a new payment request</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-fiber-600 transition-colors" />
          </Link>
          <Link
            to="/webhooks"
            className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-fiber-200 hover:bg-fiber-50/50 transition-all duration-150 group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Webhook className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Configure Webhooks</p>
              <p className="text-xs text-gray-500">Set up payment notifications</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-600 transition-colors" />
          </Link>
          <Link
            to="/balance"
            className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-fiber-200 hover:bg-fiber-50/50 transition-all duration-150 group"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Check Balance</p>
              <p className="text-xs text-gray-500">View channel balances</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-violet-600 transition-colors" />
          </Link>
        </div>
      </Card>

      {/* Revenue Chart */}
      {revenue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue (Last 14 Days)</CardTitle>
            <span className="text-xs text-gray-400">
              {revenue.reduce((s, r) => s + r.count, 0)} payments
            </span>
          </CardHeader>
          <div className="space-y-2">
            {revenue.slice(-7).map((day) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fiber-500 to-fiber-400 transition-all duration-500"
                    style={{
                      width: `${(Number(day.volume) / maxVolume) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-28 text-right flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCkbAmount(day.volume)}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">CKB</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
