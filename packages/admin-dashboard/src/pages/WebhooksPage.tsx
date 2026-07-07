import { useEffect, useState } from 'react';
import { MerchantClient, WebhookEndpoint } from '@fiber-merchant/sdk';
import { Plus, Webhook, Trash2, Send, Check, X, Loader2 } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Badge } from '../components/ui';
import Input from '../components/ui/Input';

interface WebhooksPageProps {
  client: MerchantClient;
}

const EVENTS = [
  'invoice.created', 'invoice.received', 'invoice.paid',
  'invoice.expired', 'invoice.cancelled', 'invoice.refunded',
];

export default function WebhooksPage({ client }: WebhooksPageProps) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: '', description: '', events: ['invoice.paid', 'invoice.expired'] });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const list = await client.webhooks.list();
      setWebhooks(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadWebhooks(); }, [client]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.webhooks.register({
        url: form.url,
        events: form.events as any,
        description: form.description,
      });
      setShowForm(false);
      setForm({ url: '', description: '', events: ['invoice.paid', 'invoice.expired'] });
      loadWebhooks();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await client.webhooks.delete(id);
      loadWebhooks();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await client.webhooks.test(id);
      alert('Test event sent! Check delivery logs.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send test');
    } finally {
      setTestingId(null);
    }
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
            const events = typeof wh.events === 'string' ? JSON.parse(wh.events) : wh.events;
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
                      onClick={() => handleDelete(wh.id)}
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
