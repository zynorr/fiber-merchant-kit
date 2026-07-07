import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MerchantClient, Invoice } from '@fiber-merchant/sdk';
import { ArrowLeft, Copy, Ban, RotateCcw, ClipboardCopy } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, StatusBadge } from '../components/ui';

interface InvoiceDetailPageProps {
  client: MerchantClient;
}

export default function InvoiceDetailPage({ client }: InvoiceDetailPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadInvoice = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const inv = await client.invoices.get(id);
      setInvoice(inv);
      try {
        const qr = await client.invoices.getQrCode(id);
        setQrData(qr.invoiceAddress);
      } catch { /* QR might not be available */ }
    } catch {
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoice(); }, [id]);

  const handleCancel = async () => {
    if (!id || !confirm('Cancel this invoice?')) return;
    setActionLoading(true);
    try {
      await client.invoices.cancel(id);
      loadInvoice();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!id || !confirm('Issue a refund for this payment?')) return;
    setActionLoading(true);
    try {
      await client.invoices.refund(id);
      loadInvoice();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to refund');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
          <span className="text-sm">Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
      </div>
    );
  }

  const detailFields = [
    { label: 'Invoice ID', value: invoice.id, mono: true },
    { label: 'Payment Hash', value: invoice.paymentHash, mono: true },
    { label: 'Description', value: invoice.description || <span className="italic text-gray-300">No description</span> },
    { label: 'Amount', value: `${(Number(invoice.amount) / 1e8).toFixed(2)} ${invoice.currency}`, large: true },
    { label: 'Status', value: <StatusBadge status={invoice.status} /> },
    { label: 'Created', value: new Date(invoice.createdAt).toLocaleString() },
    { label: 'Expires', value: new Date(invoice.expiresAt).toLocaleString() },
    ...(invoice.paidAt ? [{ label: 'Paid At', value: new Date(invoice.paidAt).toLocaleString() }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/invoices')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Invoices
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Invoice Details</CardTitle>
                <StatusBadge status={invoice.status} />
              </div>
            </CardHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              {detailFields.map((field) => (
                <div key={field.label} className={field.label === 'Amount' ? 'col-span-2' : ''}>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{field.label}</dt>
                  <dd className={`mt-1 ${field.large ? 'text-xl font-bold text-gray-900' : 'text-sm text-gray-900'} ${field.mono ? 'font-mono text-xs break-all' : ''}`}>
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Invoice Address */}
          {invoice.invoiceAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Invoice Address</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(invoice.invoiceAddress)}
                  icon={copied ? <span className="text-xs text-emerald-600">Copied!</span> : <ClipboardCopy className="h-3.5 w-3.5" />}
                />
              </CardHeader>
              <code className="block bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-xs font-mono break-all text-gray-700">
                {invoice.invoiceAddress}
              </code>
            </Card>
          )}

          {/* Actions */}
          {invoice.status === 'pending' && (
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleCancel}
                loading={actionLoading}
                icon={<Ban className="h-4 w-4" />}
              >
                Cancel Invoice
              </Button>
            </div>
          )}
          {invoice.status === 'paid' && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleRefund}
                loading={actionLoading}
                icon={<RotateCcw className="h-4 w-4" />}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                Issue Refund
              </Button>
            </div>
          )}
        </div>

        {/* QR Code Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pay with Fiber</CardTitle>
            </CardHeader>
            {qrData ? (
              <div className="text-center">
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 mb-4">
                  <div className="w-48 h-48 mx-auto bg-white rounded-lg border border-gray-100 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-40 h-40">
                      <rect x="5" y="5" width="20" height="20" fill="#0c8ee7" rx="2" />
                      <rect x="30" y="5" width="15" height="20" fill="#0c8ee7" rx="2" />
                      <rect x="50" y="5" width="20" height="20" fill="#0c8ee7" rx="2" />
                      <rect x="5" y="30" width="25" height="15" fill="#0c8ee7" rx="2" />
                      <rect x="35" y="30" width="40" height="15" fill="#0c8ee7" rx="2" />
                      <rect x="5" y="50" width="20" height="25" fill="#0c8ee7" rx="2" />
                      <rect x="30" y="50" width="15" height="25" fill="#0c8ee7" rx="2" />
                      <rect x="50" y="50" width="20" height="25" fill="#0c8ee7" rx="2" />
                      <rect x="75" y="5" width="20" height="90" fill="#0c8ee7" rx="2" />
                      <rect x="5" y="80" width="40" height="15" fill="#0c8ee7" rx="2" />
                      <rect x="50" y="80" width="20" height="15" fill="#0c8ee7" rx="2" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Scan with any Fiber wallet</p>
                </div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Invoice Address:</p>
                <code className="text-xs bg-gray-50 px-2 py-1.5 rounded block truncate border border-gray-100">
                  {qrData}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(qrData)}
                  icon={<Copy className="h-3 w-3" />}
                  className="mt-2"
                >
                  Copy
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">QR code not available</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
