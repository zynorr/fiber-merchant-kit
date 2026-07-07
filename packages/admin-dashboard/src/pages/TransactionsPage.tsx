import { useEffect, useState } from 'react';
import { MerchantClient, Transaction } from '@fiber-merchant/sdk';
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, RotateCw } from 'lucide-react';
import { Card, StatusBadge, Button } from '../components/ui';

interface TransactionsPageProps {
  client: MerchantClient;
}

export default function TransactionsPage({ client }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await client.transactions.list({
        direction: filter === 'all' ? undefined : filter,
        limit: 50,
      });
      setTransactions(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [client, filter]);

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'incoming', label: 'Incoming' },
    { value: 'outgoing', label: 'Outgoing' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Payment history and activity</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              filter === f.value
                ? 'bg-fiber-50 text-fiber-700 border border-fiber-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
            <span className="text-sm">Loading transactions...</span>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">Failed to load transactions</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
          <Button size="sm" variant="ghost" onClick={load} className="mt-3 text-red-700 hover:bg-red-100">
            Try again
          </Button>
        </div>
      ) : transactions.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No transactions yet</p>
            <p className="text-xs text-gray-400 mt-1">Transactions will appear here once payments are processed</p>
          </div>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      tx.direction === 'incoming' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {tx.direction === 'incoming' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                      {tx.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {(Number(tx.amount) / 1e8).toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">{tx.currency}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">
                    {tx.fee && Number(tx.fee) > 0 ? `${(Number(tx.fee) / 1e8).toFixed(2)} CKB` : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Showing {transactions.length} transactions
            </span>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
