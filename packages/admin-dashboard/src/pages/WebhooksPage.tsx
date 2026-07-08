import { useEffect, useState } from 'react';
import {
  MerchantClient,
  WebhookDelivery,
  WebhookDeliveryWorkerStatus,
  WebhookEndpoint,
} from '@fiber-merchant/sdk';
import {
  Activity,
  AlertTriangle,
  Check,
  Clipboard,
  Clock3,
  Eye,
  EyeOff,
  FileJson,
  Loader2,
  Plus,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Webhook,
  X,
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Badge } from '../components/ui';
import Input from '../components/ui/Input';

interface WebhooksPageProps {
  client: MerchantClient;
}

const EVENTS = [
  'invoice.created', 'invoice.received', 'invoice.paid',
  'invoice.expired', 'invoice.cancelled', 'invoice.refunded',
];

function parseWebhookEvents(events: WebhookEndpoint['events']): string[] {
  if (Array.isArray(events)) return events;
  try {
    const parsed = JSON.parse(events);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : 'None scheduled';
}

function formatInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function deliveryState(delivery: WebhookDelivery): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'default';
} {
  if (delivery.success) return { label: 'Delivered', variant: 'success' };
  if (delivery.nextAttemptAt && delivery.attempts > 0) return { label: 'Rescheduled', variant: 'warning' };
  if (delivery.nextAttemptAt) return { label: 'Queued', variant: 'info' };
  return { label: 'Exhausted', variant: 'danger' };
}

function summarizeDeliveries(list: WebhookDelivery[]) {
  return list.reduce(
    (summary, delivery) => {
      const state = deliveryState(delivery).label;
      return {
        total: summary.total + 1,
        delivered: summary.delivered + (delivery.success ? 1 : 0),
        queued: summary.queued + (state === 'Queued' ? 1 : 0),
        rescheduled: summary.rescheduled + (state === 'Rescheduled' ? 1 : 0),
        failed: summary.failed + (state === 'Exhausted' ? 1 : 0),
        attempts: summary.attempts + delivery.attempts,
      };
    },
    { total: 0, delivered: 0, queued: 0, rescheduled: 0, failed: 0, attempts: 0 },
  );
}

export default function WebhooksPage({ client }: WebhooksPageProps) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: '', description: '', events: ['invoice.paid', 'invoice.expired'] });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [loadingDeliveriesId, setLoadingDeliveriesId] = useState<string | null>(null);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WebhookDeliveryWorkerStatus | null>(null);
  const [loadingWorker, setLoadingWorker] = useState(false);
  const [runningWorker, setRunningWorker] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadWebhooks = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await client.webhooks.list();
      setWebhooks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    }
    finally { setLoading(false); }
  };

  const loadWorkerStatus = async () => {
    setLoadingWorker(true);
    try {
      setWorkerStatus(await client.webhooks.getDeliveryWorkerStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook worker status');
    } finally {
      setLoadingWorker(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
    loadWorkerStatus();
  }, [client]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.webhooks.register({
        url: form.url,
        events: form.events as any,
        description: form.description,
      });
      setNotice('Webhook endpoint created');
      setShowForm(false);
      setForm({ url: '', description: '', events: ['invoice.paid', 'invoice.expired'] });
      loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await client.webhooks.delete(id);
      setNotice('Webhook endpoint deleted');
      setDeletingId(null);
      setExpandedId((current) => (current === id ? null : current));
      loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await client.webhooks.test(id);
      setNotice('Test event sent');
      await loadDeliveries(id);
      await loadWorkerStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test');
    } finally {
      setTestingId(null);
    }
  };

  const loadDeliveries = async (id: string) => {
    setLoadingDeliveriesId(id);
    try {
      const list = await client.webhooks.getDeliveries(id);
      setDeliveries((current) => ({ ...current, [id]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load delivery logs');
    } finally {
      setLoadingDeliveriesId(null);
    }
  };

  const handleRetryDelivery = async (webhookId: string, deliveryId: string) => {
    setRetryingDeliveryId(deliveryId);
    try {
      await client.webhooks.retryDelivery(webhookId, deliveryId);
      setNotice('Delivery retry queued');
      await loadDeliveries(webhookId);
      await loadWorkerStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry delivery');
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const runDeliveryWorker = async () => {
    setRunningWorker(true);
    try {
      const result = await client.webhooks.runDeliveryWorker();
      setNotice(`Delivery queue checked ${result.summary.checked} item${result.summary.checked === 1 ? '' : 's'}`);
      await loadWorkerStatus();
      if (expandedId) await loadDeliveries(expandedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run webhook delivery queue');
    } finally {
      setRunningWorker(false);
    }
  };

  const copyPayload = async (delivery: WebhookDelivery) => {
    try {
      await navigator.clipboard.writeText(formatPayload(delivery.payload));
      setNotice('Payload copied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy payload');
    }
  };

  const toggleDeliveries = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDeliveryId(null);
      return;
    }
    setExpandedId(id);
    setExpandedDeliveryId(null);
    if (!deliveries[id]) await loadDeliveries(id);
  };

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter((e) => e !== event)
        : [...f.events, event],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">Manage event notifications for your applications</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} icon={<Plus className="h-4 w-4" />}>
          Add Webhook
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

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Delivery Queue</CardTitle>
            <p className="mt-1 text-xs text-gray-400">Durable webhook outbox worker</p>
          </div>
          <Badge variant={workerStatus?.enabled ? (workerStatus.running ? 'warning' : 'success') : 'default'}>
            {workerStatus?.enabled ? (workerStatus.running ? 'Running' : 'Enabled') : 'Disabled'}
          </Badge>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Active</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{workerStatus?.active ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Interval</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {workerStatus ? formatInterval(workerStatus.intervalMs) : '...'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Batch</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{workerStatus?.batchSize ?? '...'}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">Delivered</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">
              {workerStatus?.lastSummary?.delivered ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Rescheduled</p>
            <p className="mt-1 text-sm font-semibold text-amber-700">
              {workerStatus?.lastSummary?.rescheduled ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">Errors</p>
            <p className="mt-1 text-sm font-semibold text-red-700">
              {workerStatus?.lastSummary?.errors ?? 0}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2 text-xs text-gray-500">
            {workerStatus?.lastError ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            ) : (
              <Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            )}
            <span className="truncate">
              {workerStatus?.lastError
                ? workerStatus.lastError
                : `Last run: ${formatDateTime(workerStatus?.lastRunAt)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadWorkerStatus}
              loading={loadingWorker}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runDeliveryWorker}
              loading={runningWorker}
              icon={<PlayCircle className="h-4 w-4" />}
            >
              Run Queue
            </Button>
          </div>
        </div>
      </Card>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Register Webhook Endpoint</CardTitle>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="URL"
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://api.mystore.com/webhooks/fiber"
              required
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Production webhook"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
              <div className="flex flex-wrap gap-2">
                {EVENTS.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                      form.events.includes(event)
                        ? 'bg-fiber-50 border-fiber-300 text-fiber-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {form.events.includes(event) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving}>
                Create Webhook
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Webhook List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-fiber-600" />
            <span className="text-sm">Loading webhooks...</span>
          </div>
        </div>
      ) : webhooks.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Webhook className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No webhooks configured</p>
            <p className="text-xs text-gray-400 mt-1">Receive real-time payment notifications</p>
            <Button onClick={() => setShowForm(true)} className="mt-4" size="sm">
              Add your first webhook
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const events = parseWebhookEvents(wh.events);
            const webhookDeliveries = deliveries[wh.id] || [];
            const deliverySummary = summarizeDeliveries(webhookDeliveries);
            return (
              <Card key={wh.id} hover>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${wh.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <div className="min-w-0">
                      <code className="text-sm font-mono text-gray-800 block truncate">{wh.url}</code>
                      {wh.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{wh.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleDeliveries(wh.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="View delivery logs"
                    >
                      <Activity className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleTest(wh.id)}
                      disabled={testingId === wh.id}
                      className="p-1.5 text-gray-400 hover:text-fiber-600 hover:bg-fiber-50 rounded transition-colors"
                      title="Send test event"
                    >
                      {testingId === wh.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setDeletingId(wh.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete webhook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {events.map((event: string) => (
                    <Badge key={event} variant="default" size="sm">{event}</Badge>
                  ))}
                </div>
                {deletingId === wh.id && (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-red-700">Delete this webhook endpoint?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => handleDelete(wh.id)}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {expandedId === wh.id && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">Delivery logs</h3>
                      <button
                        onClick={() => loadDeliveries(wh.id)}
                        disabled={loadingDeliveriesId === wh.id}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      >
                        {loadingDeliveriesId === wh.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Refresh
                      </button>
                    </div>

                    {webhookDeliveries.length > 0 && (
                      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Total</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{deliverySummary.total}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">Delivered</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-700">{deliverySummary.delivered}</p>
                        </div>
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-sky-600">Queued</p>
                          <p className="mt-1 text-sm font-semibold text-sky-700">{deliverySummary.queued}</p>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Retrying</p>
                          <p className="mt-1 text-sm font-semibold text-amber-700">{deliverySummary.rescheduled}</p>
                        </div>
                        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">Exhausted</p>
                          <p className="mt-1 text-sm font-semibold text-red-700">{deliverySummary.failed}</p>
                        </div>
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-sky-600">Attempts</p>
                          <p className="mt-1 text-sm font-semibold text-sky-700">{deliverySummary.attempts}</p>
                        </div>
                      </div>
                    )}

                    {loadingDeliveriesId === wh.id && !deliveries[wh.id] ? (
                      <p className="py-4 text-sm text-gray-400">Loading delivery logs...</p>
                    ) : webhookDeliveries.length ? (
                      <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                        {webhookDeliveries.map((delivery) => {
                          const payloadExpanded = expandedDeliveryId === delivery.id;
                          const state = deliveryState(delivery);

                          return (
                            <div key={delivery.id} className="px-3 py-3 text-sm">
                              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge size="sm" variant={state.variant}>{state.label}</Badge>
                                    <span className="font-medium text-gray-800">{delivery.event}</span>
                                    <span className="text-xs text-gray-400">HTTP {delivery.status}</span>
                                  </div>
                                  <p className="mt-1 truncate font-mono text-xs text-gray-400">{delivery.id}</p>
                                  {!delivery.success && (
                                    <p className="mt-1 text-xs text-gray-500">
                                      Next attempt: {formatDateTime(delivery.nextAttemptAt)}
                                    </p>
                                  )}
                                  {delivery.error && (
                                    <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
                                      {delivery.error}
                                    </p>
                                  )}
                                </div>
                                <div className="text-left text-xs text-gray-400 sm:text-right">
                                  <p>{delivery.attempts} attempt{delivery.attempts === 1 ? '' : 's'}</p>
                                  <p>{new Date(delivery.deliveredAt).toLocaleString()}</p>
                                  <div className="mt-2 flex items-center gap-3 sm:justify-end">
                                    <button
                                      onClick={() => setExpandedDeliveryId(payloadExpanded ? null : delivery.id)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                                      title={payloadExpanded ? 'Hide payload' : 'View payload'}
                                    >
                                      {payloadExpanded ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                      Payload
                                    </button>
                                    <button
                                      onClick={() => copyPayload(delivery)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                                      title="Copy payload"
                                    >
                                      <Clipboard className="h-3 w-3" />
                                      Copy
                                    </button>
                                  </div>
                                  {!delivery.success && (
                                    <button
                                      onClick={() => handleRetryDelivery(wh.id, delivery.id)}
                                      disabled={retryingDeliveryId === delivery.id}
                                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-fiber-600 hover:text-fiber-700 disabled:opacity-50"
                                      title="Retry delivery"
                                    >
                                      {retryingDeliveryId === delivery.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-3 w-3" />
                                      )}
                                      Retry
                                    </button>
                                  )}
                                </div>
                              </div>
                              {payloadExpanded && (
                                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-950">
                                  <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2 text-xs font-medium text-gray-300">
                                    <FileJson className="h-3.5 w-3.5" />
                                    Event payload
                                  </div>
                                  <pre className="max-h-72 overflow-auto p-3 text-xs leading-relaxed text-gray-100">
                                    {formatPayload(delivery.payload)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="py-4 text-sm text-gray-400">No deliveries recorded yet</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
