import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MerchantClient, Invoice } from '@fiber-merchant/sdk';
import { Plus, Receipt, RotateCw, Search, X } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, StatusBadge } from '../components/ui';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Input';

interface InvoicesPageProps {
  client: MerchantClient;
}

export default function InvoicesPage({ client }: InvoicesPageProps) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ amount: '', description: '', currency: 'CKB' });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const loadInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await client.invoices.list({ limit: 50 });
      setInvoices(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoices(); }, [client]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError('');
    try {
      await client.invoices.create({
        amount: createForm.amount,
        currency: createForm.currency,
        description: createForm.description,
      });
      setNotice('Invoice created');
      setShowCreate(false);
      setCreateForm({ amount: '', description: '', currency: 'CKB' });
      loadInvoices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const filtered = search
    ? invoices.filter(
        (inv) =>
          inv.id.toLowerCase().includes(search.toLowerCase()) ||
          inv.description?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage payment requests</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-4 w-4" />}>
          New Invoice
        </Button>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Invoice</CardTitle>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Amount"
                value={createForm.amount}
                onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                placeholder="1000"
                required
              />
              <Select
                label="Currency"
                value={createForm.currency}
                onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                options={[
                  { value: 'CKB', label: 'CKB' },
                  { value: 'RUSD', label: 'RUSD' },
                ]}
              />
            </div>
            <Input
              label="Description"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Order #1234 - Premium Widget"
            />
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={creating}>
                {creating ? 'Creating...' : 'Create Invoice'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoices by ID or description..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-fiber-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
            <span className="text-sm">Loading invoices...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">{search ? 'No matching invoices' : 'No invoices yet'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? 'Try a different search term' : 'Create your first invoice to get started'}
            </p>
            {!search && (
              <Button onClick={() => setShowCreate(true)} className="mt-4" size="sm">
                Create Invoice
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3.5">
                    <code className="text-sm font-mono text-fiber-600 bg-fiber-50 px-2 py-0.5 rounded text-xs">
                      {inv.id.slice(0, 8)}
                    </code>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {(Number(inv.amount) / 1e8).toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">{inv.currency}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[200px] truncate">
                    {inv.description || <span className="italic text-gray-300">No description</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Showing {filtered.length} of {invoices.length} invoices
            </span>
            <button
              onClick={loadInvoices}
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
